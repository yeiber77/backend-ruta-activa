const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const requireUserBearer = require('../middleware/requireUserBearer');
const { registrarEvento } = require('../utils/auditLog');

const router = express.Router();

const adminRoleId = Number(process.env.ROLE_ADMIN_ID || process.env.ROL_ADMIN_ID || 1);
const coordinadorRoleId = Number(
  process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2
);

const SQL_DENUNCIAS = 'backend-ruta-activa-main/sql/denuncias_comentarios.sql';

function errorTablaDenunciasFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('denuncias') &&
    (msg.includes('could not find the table') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist'))
  );
}

function errorTablaComentariosFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('comentarios') &&
    (msg.includes('could not find the table') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist'))
  );
}

const MOTIVOS_DENUNCIA = [
  'Retraso en la ruta',
  'Comportamiento inadecuado',
  'Problema con el vehículo',
  'Incumplimiento de horario',
  'Falta de comunicación',
  'Condiciones inseguras',
  'Otro',
];

function rolEtiqueta(rolId) {
  switch (Number(rolId)) {
    case adminRoleId:
      return 'Administrador';
    case coordinadorRoleId:
      return 'Coordinador';
    case Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3):
      return 'Chofer';
    case Number(process.env.ROLE_SUPERVISOR_ID || process.env.ROL_SUPERVISOR_ID || 4):
      return 'Supervisor';
    case Number(process.env.ROLE_REPRESENTANTE_ID || process.env.ROL_REPRESENTANTE_ID || 5):
      return 'Representante';
    case Number(process.env.ROLE_OBRERO_ID || process.env.ROL_OBRERO_ID || 6):
      return 'Obrero';
    default:
      return rolId != null ? `Rol ${rolId}` : 'Sin rol';
  }
}

function puedeResponderComentarios(rolId) {
  const rid = Number(rolId);
  return rid === adminRoleId || rid === coordinadorRoleId;
}

function puedeCrearComentarios() {
  return true;
}

function normalizeUserId(id) {
  return typeof id === 'string' ? id.trim().toLowerCase() : '';
}

function mismoUsuarioId(a, b) {
  const na = normalizeUserId(a);
  const nb = normalizeUserId(b);
  return Boolean(na && nb && na === nb);
}

function esComentarioAjeno(row, userId) {
  return row?.usuario_id && !mismoUsuarioId(row.usuario_id, userId);
}

function actor(req) {
  return req.userActor;
}

async function enrichDenuncias(rows) {
  if (!rows?.length) return [];
  const userIds = [...new Set(rows.map((r) => r.usuario_id).filter(Boolean))];
  const { data: usuarios } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, rol_id')
    .in('id', userIds);

  const byId = new Map((usuarios || []).map((u) => [u.id, u]));

  return rows.map((row) => {
    const u = byId.get(row.usuario_id);
    return {
      ...row,
      autor_nombre: u?.nombre || u?.email || 'Usuario',
      autor_rol_id: row.rol_id ?? u?.rol_id ?? null,
      autor_rol_nombre: rolEtiqueta(row.rol_id ?? u?.rol_id),
    };
  });
}

async function enrichComentarios(rows) {
  if (!rows?.length) return [];
  const userIds = new Set();
  for (const row of rows) {
    if (row.usuario_id) userIds.add(row.usuario_id);
    if (row.respondido_por_id) userIds.add(row.respondido_por_id);
  }

  let byId = new Map();
  if (userIds.size > 0) {
    const { data: usuarios, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, email, rol_id')
      .in('id', [...userIds]);

    if (error) {
      console.warn('[denunciasComentarios] enrich usuarios:', error.message);
    } else {
      byId = new Map((usuarios || []).map((u) => [u.id, u]));
    }
  }

  return rows.map((row) => {
    const autor = byId.get(row.usuario_id);
    const respondedor = row.respondido_por_id ? byId.get(row.respondido_por_id) : null;
    const respondidoRolId = row.respondido_por_rol_id ?? respondedor?.rol_id ?? null;
    return {
      ...row,
      autor_nombre: autor?.nombre || autor?.email || 'Usuario',
      autor_rol_id: row.rol_id ?? autor?.rol_id ?? null,
      autor_rol_nombre: rolEtiqueta(row.rol_id ?? autor?.rol_id),
      respondido_por_nombre: respondedor?.nombre || respondedor?.email || null,
      respondido_por_rol_nombre: respondidoRolId != null ? rolEtiqueta(respondidoRolId) : null,
    };
  });
}

router.use(requireUserBearer);

router.get('/motivos-denuncia', (_req, res) => {
  return res.status(200).json({ ok: true, motivos: MOTIVOS_DENUNCIA });
});

router.get('/denuncias', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);

  const { data, error } = await supabaseAdmin
    .from('denuncias')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    if (errorTablaDenunciasFaltante(error)) {
      return res.status(200).json({
        ok: true,
        denuncias: [],
        total: 0,
        aviso: `Falta crear las tablas en Supabase. Ejecuta: ${SQL_DENUNCIAS}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron listar las denuncias',
      detalle: error.message,
    });
  }

  const denuncias = await enrichDenuncias(data || []);
  return res.status(200).json({ ok: true, denuncias, total: denuncias.length });
});

router.post('/denuncias', async (req, res) => {
  const user = actor(req);
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  const descripcion =
    typeof req.body.descripcion === 'string' ? req.body.descripcion.trim() : null;

  if (!motivo) {
    return res.status(400).json({ ok: false, mensaje: 'motivo es obligatorio' });
  }

  if (!MOTIVOS_DENUNCIA.includes(motivo)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'motivo no válido',
      motivos_validos: MOTIVOS_DENUNCIA,
    });
  }

  if (motivo === 'Otro' && !descripcion) {
    return res.status(400).json({
      ok: false,
      mensaje: 'descripcion es obligatoria cuando el motivo es Otro',
    });
  }

  const payload = {
    usuario_id: user.id,
    rol_id: user.rol_id,
    motivo,
    descripcion: descripcion || null,
  };

  const { data, error } = await supabaseAdmin.from('denuncias').insert(payload).select('*').single();

  if (error) {
    if (errorTablaDenunciasFaltante(error)) {
      return res.status(503).json({
        ok: false,
        mensaje: 'Denuncias no disponibles hasta ejecutar el SQL en Supabase',
        detalle: SQL_DENUNCIAS,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo registrar la denuncia',
      detalle: error.message,
    });
  }

  const [denuncia] = await enrichDenuncias([data]);
  void registrarEvento({
    req,
    eventType: 'denuncia.created',
    entityType: 'denuncias',
    entityId: denuncia?.id,
    accion: 'create',
    resumen: `${denuncia.autor_nombre || 'Usuario'} registró denuncia: ${motivo}`,
    despues: denuncia,
  });
  return res.status(201).json({ ok: true, mensaje: 'Denuncia registrada', denuncia });
});

router.get('/comentarios', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);

  const { data, error } = await supabaseAdmin
    .from('comentarios')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    if (errorTablaComentariosFaltante(error)) {
      return res.status(200).json({
        ok: true,
        comentarios: [],
        total: 0,
        aviso: `Falta crear las tablas en Supabase. Ejecuta: ${SQL_DENUNCIAS}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron listar los comentarios',
      detalle: error.message,
    });
  }

  const comentarios = await enrichComentarios(data || []);
  return res.status(200).json({ ok: true, comentarios, total: comentarios.length });
});

router.post('/comentarios', async (req, res) => {
  const user = actor(req);

  const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto) {
    return res.status(400).json({ ok: false, mensaje: 'texto es obligatorio' });
  }

  const payload = {
    usuario_id: user.id,
    rol_id: user.rol_id,
    texto,
  };

  const { data, error } = await supabaseAdmin.from('comentarios').insert(payload).select('*').single();

  if (error) {
    if (errorTablaComentariosFaltante(error)) {
      return res.status(503).json({
        ok: false,
        mensaje: 'Comentarios no disponibles hasta ejecutar el SQL en Supabase',
        detalle: SQL_DENUNCIAS,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo registrar el comentario',
      detalle: error.message,
    });
  }

  const [comentario] = await enrichComentarios([data]);
  void registrarEvento({
    req,
    eventType: 'comentario.created',
    entityType: 'comentarios',
    entityId: comentario?.id,
    accion: 'create',
    resumen: `${comentario.autor_nombre || 'Usuario'} publicó un comentario`,
    despues: { id: comentario.id, texto: texto.slice(0, 120) },
  });
  return res.status(201).json({ ok: true, mensaje: 'Comentario registrado', comentario });
});

router.patch('/comentarios/:comentarioId/responder', async (req, res) => {
  const user = actor(req);

  if (!puedeResponderComentarios(user.rol_id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo administrador o coordinador pueden responder comentarios',
    });
  }

  const comentarioId = Number(req.params.comentarioId);
  if (!Number.isInteger(comentarioId) || comentarioId < 1) {
    return res.status(400).json({ ok: false, mensaje: 'comentarioId debe ser un entero positivo' });
  }

  const respuesta = typeof req.body.respuesta === 'string' ? req.body.respuesta.trim() : '';
  if (!respuesta) {
    return res.status(400).json({ ok: false, mensaje: 'respuesta es obligatoria' });
  }

  const { data: existente, error: readErr } = await supabaseAdmin
    .from('comentarios')
    .select('id, usuario_id')
    .eq('id', comentarioId)
    .maybeSingle();

  if (readErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer el comentario',
      detalle: readErr.message,
    });
  }

  if (!existente) {
    return res.status(404).json({ ok: false, mensaje: 'Comentario no encontrado' });
  }

  if (!esComentarioAjeno(existente, user.id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'No puedes responder tu propio comentario',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('comentarios')
    .update({
      respuesta,
      respondido_por_id: user.id,
      respondido_por_rol_id: user.rol_id,
      respondido_en: new Date().toISOString(),
    })
    .eq('id', comentarioId)
    .select('*')
    .maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo guardar la respuesta',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Comentario no encontrado' });
  }

  const [comentario] = await enrichComentarios([data]);
  void registrarEvento({
    req,
    eventType: 'comentario.responded',
    entityType: 'comentarios',
    entityId: comentarioId,
    accion: 'update',
    resumen: `${user.nombre || user.email || 'Staff'} respondió comentario #${comentarioId}`,
    despues: { respuesta: respuesta.slice(0, 200) },
  });
  return res.status(200).json({ ok: true, mensaje: 'Respuesta guardada', comentario });
});

router.delete('/comentarios/:comentarioId', async (req, res) => {
  const user = actor(req);
  const comentarioId = Number(req.params.comentarioId);
  if (!Number.isInteger(comentarioId) || comentarioId < 1) {
    return res.status(400).json({ ok: false, mensaje: 'comentarioId debe ser un entero positivo' });
  }

  const { data: existente, error: readErr } = await supabaseAdmin
    .from('comentarios')
    .select('id, usuario_id')
    .eq('id', comentarioId)
    .maybeSingle();

  if (readErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer el comentario',
      detalle: readErr.message,
    });
  }

  if (!existente) {
    return res.status(200).json({
      ok: true,
      mensaje: 'Comentario eliminado',
      ya_no_existia: true,
    });
  }

  if (!mismoUsuarioId(existente.usuario_id, user.id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo puedes eliminar comentarios que publicaste tú',
    });
  }

  const { error, count } = await supabaseAdmin
    .from('comentarios')
    .delete({ count: 'exact' })
    .eq('id', comentarioId);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo eliminar el comentario',
      detalle: error.message,
    });
  }

  void registrarEvento({
    req,
    eventType: 'comentario.deleted',
    entityType: 'comentarios',
    entityId: comentarioId,
    accion: 'delete',
    resumen: `${user.nombre || user.email || 'Usuario'} eliminó su comentario #${comentarioId}`,
  });
  return res.status(200).json({
    ok: true,
    mensaje: 'Comentario eliminado',
    ...(count === 0 && { ya_no_existia: true }),
  });
});

module.exports = router;
