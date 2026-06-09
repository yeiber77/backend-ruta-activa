const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const requireUserBearer = require('../middleware/requireUserBearer');
const {
  HORARIOS_RUTAS_DEFAULT,
  DIA_IDS,
  rowToHorario,
  parseZonasInput,
} = require('../utils/horariosRutasDefault');
const { registrarEvento } = require('../utils/auditLog');

const router = express.Router();

const coordinadorRoleId = Number(
  process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2
);

function esCoordinador(rolId) {
  return Number(rolId) === coordinadorRoleId;
}

const SQL_HORARIOS = 'backend-ruta-activa-main/sql/horarios_rutas.sql';

function errorTablaHorariosFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || '').toLowerCase();
  return (
    msg.includes('horarios_rutas_dia') &&
    (msg.includes('schema cache') ||
      msg.includes('does not exist') ||
      msg.includes('could not find'))
  );
}

function horariosPorDefecto() {
  return HORARIOS_RUTAS_DEFAULT.map((d) =>
    rowToHorario({
      id: d.id,
      dia_label: d.dia_label,
      zonas: d.zonas,
      nota: d.nota,
    })
  );
}

async function asegurarHorariosSemilla() {
  const { count, error: countError } = await supabaseAdmin
    .from('horarios_rutas_dia')
    .select('id', { count: 'exact', head: true });

  if (countError) {
    if (errorTablaHorariosFaltante(countError)) {
      const err = new Error('TABLA_HORARIOS_NO_EXISTE');
      err.code = 'TABLA_HORARIOS_NO_EXISTE';
      throw err;
    }
    throw countError;
  }

  if ((count ?? 0) >= HORARIOS_RUTAS_DEFAULT.length) {
    return;
  }

  const rows = HORARIOS_RUTAS_DEFAULT.map((d) => ({
    id: d.id,
    dia_label: d.dia_label,
    zonas: d.zonas,
    nota: d.nota,
    orden: d.orden,
  }));

  const { error } = await supabaseAdmin
    .from('horarios_rutas_dia')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}

async function listarHorarios() {
  await asegurarHorariosSemilla();

  const { data, error } = await supabaseAdmin
    .from('horarios_rutas_dia')
    .select('*')
    .order('orden', { ascending: true });

  if (error) {
    if (errorTablaHorariosFaltante(error)) {
      const err = new Error('TABLA_HORARIOS_NO_EXISTE');
      err.code = 'TABLA_HORARIOS_NO_EXISTE';
      throw err;
    }
    throw error;
  }

  return (data || []).map(rowToHorario);
}

router.use(requireUserBearer);

router.get('/', async (_req, res) => {
  try {
    const horarios = await listarHorarios();
    return res.status(200).json({ ok: true, horarios, total: horarios.length });
  } catch (error) {
    if (error.code === 'TABLA_HORARIOS_NO_EXISTE' || errorTablaHorariosFaltante(error)) {
      const horarios = horariosPorDefecto();
      return res.status(200).json({
        ok: true,
        horarios,
        total: horarios.length,
        aviso:
          `Falta crear la tabla en Supabase. Ejecuta el SQL: ${SQL_HORARIOS}. Mientras tanto se muestran los horarios por defecto.`,
        solo_lectura: true,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar horarios y rutas',
      detalle: error.message,
    });
  }
});

router.patch('/:diaId', async (req, res) => {
  const user = req.userActor;

  if (!esCoordinador(user.rol_id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo el coordinador puede editar horarios y rutas',
    });
  }

  const diaId = String(req.params.diaId || '').trim().toLowerCase();
  if (!DIA_IDS.has(diaId)) {
    return res.status(400).json({ ok: false, mensaje: 'diaId no válido' });
  }

  const patch = {
    actualizado_en: new Date().toISOString(),
    actualizado_por: user.id,
  };

  if (Object.prototype.hasOwnProperty.call(req.body, 'zonas')) {
    patch.zonas = parseZonasInput(req.body.zonas);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'nota')) {
    const nota = req.body.nota;
    patch.nota = nota == null || String(nota).trim() === '' ? null : String(nota).trim();
  }

  if (!Object.prototype.hasOwnProperty.call(patch, 'zonas') && !Object.prototype.hasOwnProperty.call(patch, 'nota')) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Envía zonas (array o texto) y/o nota para actualizar',
    });
  }

  try {
    await asegurarHorariosSemilla();

    const { data, error } = await supabaseAdmin
      .from('horarios_rutas_dia')
      .update(patch)
      .eq('id', diaId)
      .select('*')
      .maybeSingle();

    if (error) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se pudo actualizar el horario',
        detalle: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Día no encontrado' });
    }

    void registrarEvento({
      req,
      eventType: 'horario.updated',
      entityType: 'horarios_rutas_dia',
      entityId: diaId,
      accion: 'update',
      resumen: `Coordinador actualizó horario del ${data.dia_label || diaId}`,
      despues: rowToHorario(data),
    });
    return res.status(200).json({
      ok: true,
      mensaje: 'Horario actualizado',
      horario: rowToHorario(data),
    });
  } catch (err) {
    if (err.code === 'TABLA_HORARIOS_NO_EXISTE' || errorTablaHorariosFaltante(err)) {
      return res.status(503).json({
        ok: false,
        mensaje: 'No se puede guardar hasta crear la tabla en Supabase',
        detalle: `Ejecuta en SQL Editor: ${SQL_HORARIOS}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo actualizar horarios y rutas',
      detalle: err.message,
    });
  }
});

module.exports = router;
