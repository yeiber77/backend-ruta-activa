const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { crearTrabajadorEquipo, choferRoleId, obreroRoleId } = require('../utils/crearTrabajadorEquipo');
const { registrarEvento } = require('../utils/auditLog');

const router = express.Router();

const DIAS_PLAZO_REINTEGRACION = 10;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const SQL_DESPIDOS = 'backend-ruta-activa-main/sql/despidos_choferes.sql';

function puedeDespedirRol(rolId) {
  const rid = Number(rolId);
  return rid === choferRoleId || rid === obreroRoleId;
}

function errorTablaDespidosFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('despidos_choferes') &&
    (msg.includes('could not find the table') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist'))
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function expiraEnDespido(creadoEn) {
  return new Date(new Date(creadoEn).getTime() + DIAS_PLAZO_REINTEGRACION * MS_POR_DIA);
}

function diasRestantesDespido(creadoEn) {
  const diff = expiraEnDespido(creadoEn).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / MS_POR_DIA));
}

function enrichDespidoRow(row) {
  const dias = diasRestantesDespido(row.creado_en);
  return {
    ...row,
    dias_restantes: dias,
    puede_reintegrar: dias > 0,
    expira_en: expiraEnDespido(row.creado_en).toISOString(),
  };
}

async function purgarDespidosExpirados() {
  const cutoff = new Date(Date.now() - DIAS_PLAZO_REINTEGRACION * MS_POR_DIA).toISOString();
  const { error } = await supabaseAdmin.from('despidos_choferes').delete().lt('creado_en', cutoff);
  if (error && !errorTablaDespidosFaltante(error)) {
    console.warn('[despidos] purga expirados:', error.message);
  }
}

router.get('/choferes', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  await purgarDespidosExpirados();

  const { data, error } = await supabaseAdmin
    .from('despidos_choferes')
    .select('*')
    .order('creado_en', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (errorTablaDespidosFaltante(error)) {
      return res.status(200).json({
        ok: true,
        despidos: [],
        limit,
        offset,
        plazo_reintegracion_dias: DIAS_PLAZO_REINTEGRACION,
        aviso: `Falta crear la tabla en Supabase. Ejecuta: ${SQL_DESPIDOS}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar el historial de despidos',
      detalle: error.message,
    });
  }

  const despidos = (data || []).map(enrichDespidoRow);
  return res.status(200).json({
    ok: true,
    despidos,
    limit,
    offset,
    plazo_reintegracion_dias: DIAS_PLAZO_REINTEGRACION,
  });
});

router.post('/trabajadores', async (req, res) => {
  const nombre = req.body?.nombre;
  const email = req.body?.email;
  const telefono = req.body?.telefono;
  const tipo = req.body?.tipo;
  const password = req.body?.password;

  const result = await crearTrabajadorEquipo({ nombre, email, telefono, tipo, password });
  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      mensaje: result.mensaje,
      ...(result.detalle && { detalle: result.detalle }),
    });
  }

  void registrarEvento({
    req,
    eventType: 'admin.worker_created',
    entityType: 'usuarios',
    entityId: result.perfil?.id,
    accion: 'create',
    resumen: `Admin agregó ${tipo || 'trabajador'} «${result.perfil?.nombre || result.perfil?.email}» al equipo`,
    despues: result.perfil,
  });
  return res.status(201).json({
    ok: true,
    mensaje: 'Trabajador agregado al equipo',
    perfil: result.perfil,
    password_inicial: result.password_inicial,
  });
});

router.post('/registro/:despidoId/reintegrar', async (req, res) => {
  const despidoId = Number(req.params.despidoId);
  if (!Number.isInteger(despidoId) || despidoId < 1) {
    return res.status(400).json({ ok: false, mensaje: 'despidoId debe ser un entero positivo' });
  }

  const { data: registro, error: readErr } = await supabaseAdmin
    .from('despidos_choferes')
    .select('*')
    .eq('id', despidoId)
    .maybeSingle();

  if (readErr) {
    if (errorTablaDespidosFaltante(readErr)) {
      return res.status(503).json({
        ok: false,
        mensaje: 'Tabla de despidos no configurada',
        detalle: SQL_DESPIDOS,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer el registro',
      detalle: readErr.message,
    });
  }

  if (!registro) {
    return res.status(404).json({
      ok: false,
      mensaje: 'Registro no encontrado o ya expiró del historial (plazo de 10 días)',
    });
  }

  if (diasRestantesDespido(registro.creado_en) < 1) {
    await supabaseAdmin.from('despidos_choferes').delete().eq('id', despidoId);
    return res.status(410).json({
      ok: false,
      mensaje: `El plazo de ${DIAS_PLAZO_REINTEGRACION} días para reintegrar ya venció`,
    });
  }

  let tipo = typeof req.body?.tipo === 'string' ? req.body.tipo.trim().toLowerCase() : '';
  if (!tipo) {
    if (Number(registro.rol_id) === obreroRoleId) tipo = 'obrero';
    else if (Number(registro.rol_id) === choferRoleId) tipo = 'chofer';
    else tipo = 'chofer';
  }

  const result = await crearTrabajadorEquipo({
    nombre: registro.nombre,
    email: registro.email,
    telefono: registro.telefono,
    tipo,
    password: req.body?.password,
  });

  if (!result.ok) {
    return res.status(result.status).json({
      ok: false,
      mensaje: result.mensaje,
      ...(result.detalle && { detalle: result.detalle }),
    });
  }

  const { error: delErr } = await supabaseAdmin.from('despidos_choferes').delete().eq('id', despidoId);
  if (delErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Usuario creado pero no se pudo quitar del historial de despidos',
      detalle: delErr.message,
      perfil: result.perfil,
    });
  }

  void registrarEvento({
    req,
    eventType: 'admin.worker_reintegrated',
    entityType: 'usuarios',
    entityId: result.perfil?.id,
    accion: 'create',
    resumen: `Admin reintegró «${registro.nombre || registro.email}» al equipo`,
    antes: registro,
    despues: result.perfil,
  });
  return res.status(200).json({
    ok: true,
    mensaje: 'Trabajador reintegrado al equipo',
    perfil: result.perfil,
    password_inicial: result.password_inicial,
  });
});

router.post('/choferes/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!isUuid(userId)) {
    return res.status(400).json({ ok: false, mensaje: 'userId debe ser un UUID valido' });
  }

  const admin = req.adminActor;
  if (admin.id === userId) {
    return res.status(400).json({ ok: false, mensaje: 'No puedes despedirte a ti mismo' });
  }

  const { data: miembro, error: readErr } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, telefono, rol_id')
    .eq('id', userId)
    .maybeSingle();

  if (readErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer el miembro del equipo',
      detalle: readErr.message,
    });
  }

  if (!miembro) {
    return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
  }

  if (!puedeDespedirRol(miembro.rol_id)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Solo se pueden despedir choferes u obreros del equipo operativo',
    });
  }

  const motivo =
    typeof req.body?.motivo === 'string' && req.body.motivo.trim()
      ? req.body.motivo.trim()
      : null;

  const payloadDespido = {
    chofer_id: miembro.id,
    nombre: miembro.nombre,
    email: miembro.email,
    telefono: miembro.telefono,
    rol_id: miembro.rol_id,
    despido_por: admin.id,
    admin_nombre: admin.nombre,
    admin_email: admin.email,
    motivo,
  };

  let despidoRegistro = null;
  let insertErr = null;

  const first = await supabaseAdmin.from('despidos_choferes').insert(payloadDespido).select('*').maybeSingle();
  despidoRegistro = first.data;
  insertErr = first.error;

  if (insertErr && /rol_id|column/i.test(insertErr.message || '')) {
    const { rol_id: _r, ...sinRol } = payloadDespido;
    const second = await supabaseAdmin.from('despidos_choferes').insert(sinRol).select('*').maybeSingle();
    despidoRegistro = second.data;
    insertErr = second.error;
  }

  if (insertErr) {
    if (errorTablaDespidosFaltante(insertErr)) {
      return res.status(503).json({
        ok: false,
        mensaje: 'Despidos no disponibles hasta ejecutar el SQL en Supabase',
        detalle: SQL_DESPIDOS,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo registrar el despido',
      detalle: insertErr.message,
    });
  }

  if (Number(miembro.rol_id) === choferRoleId) {
    const { error: rutasErr } = await supabaseAdmin
      .from('rutas')
      .update({ chofer_id: null })
      .eq('chofer_id', userId);

    if (rutasErr) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Despido registrado pero no se pudieron liberar las rutas asignadas',
        detalle: rutasErr.message,
      });
    }
  }

  const { error: deleteErr } = await supabaseAdmin.from('usuarios').delete().eq('id', userId);

  if (deleteErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Despido registrado pero no se pudo quitar el perfil del usuario',
      detalle: deleteErr.message,
    });
  }

  const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  const auditDespido = () =>
    void registrarEvento({
      req,
      eventType: 'admin.worker_dismissed',
      entityType: 'usuarios',
      entityId: userId,
      accion: 'delete',
      resumen: `Admin despidió «${miembro.nombre || miembro.email}»${motivo ? ` — ${motivo}` : ''}`,
      antes: miembro,
      despues: despidoRegistro,
    });

  if (authDeleteErr) {
    auditDespido();
    return res.status(200).json({
      ok: true,
      mensaje:
        'Miembro despedido y registrado en historial. No se pudo borrar la cuenta Auth (revisar manualmente).',
      despido: despidoRegistro,
      advertencia: authDeleteErr.message,
    });
  }

  auditDespido();
  return res.status(200).json({
    ok: true,
    mensaje: 'Miembro del equipo despedido correctamente',
    despido: despidoRegistro,
    plazo_reintegracion_dias: DIAS_PLAZO_REINTEGRACION,
  });
});

module.exports = router;
