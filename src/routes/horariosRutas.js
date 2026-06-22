const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const requireUserBearer = require('../middleware/requireUserBearer');
const { DIA_IDS, rowToHorario, parseZonasInput } = require('../utils/horariosRutasDefault');
const {
  SQL_HORARIOS,
  errorTablaHorariosFaltante,
  asegurarHorariosSemilla,
  enviarListadoHorarios,
} = require('../utils/horariosRutasService');
const { registrarEvento } = require('../utils/auditLog');

const router = express.Router();

const coordinadorRoleId = Number(
  process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2
);

function esCoordinador(rolId) {
  return Number(rolId) === coordinadorRoleId;
}

router.use(requireUserBearer);

router.get('/', enviarListadoHorarios);

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
