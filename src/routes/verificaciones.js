const express = require('express');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

function parseVerificacionId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const { data, error } = await supabaseAdmin
    .from('verificaciones')
    .select('*')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar verificaciones',
      detalle: error.message,
    });
  }

  return res.status(200).json({
    ok: true,
    verificaciones: data || [],
    limit,
    offset,
  });
});

router.get('/:verificacionId', async (req, res) => {
  const id = parseVerificacionId(req.params.verificacionId);
  if (id == null) {
    return res.status(400).json({ ok: false, mensaje: 'verificacionId debe ser un entero positivo' });
  }

  const { data, error } = await supabaseAdmin
    .from('verificaciones')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la verificacion',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Verificacion no encontrada' });
  }

  return res.status(200).json({ ok: true, verificacion: data });
});

router.delete('/:verificacionId', async (req, res) => {
  const id = parseVerificacionId(req.params.verificacionId);
  if (id == null) {
    return res.status(400).json({ ok: false, mensaje: 'verificacionId debe ser un entero positivo' });
  }

  const { data, error } = await supabaseAdmin.from('verificaciones').delete().eq('id', id).select('id');

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo eliminar la verificacion',
      detalle: error.message,
    });
  }

  if (!data?.length) {
    return res.status(404).json({ ok: false, mensaje: 'Verificacion no encontrada' });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Verificacion eliminada',
    eliminado: data[0],
  });
});

router.patch('/:verificacionId/representante', async (req, res) => {
  const id = parseVerificacionId(req.params.verificacionId);
  if (id == null) {
    return res.status(400).json({ ok: false, mensaje: 'verificacionId debe ser un entero positivo' });
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'comentario_representante')) {
    if (req.body.comentario_representante !== null && typeof req.body.comentario_representante !== 'string') {
      return res.status(400).json({ ok: false, mensaje: 'comentario_representante debe ser string o null' });
    }
    patch.comentario_representante = req.body.comentario_representante;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'confirmado_representante')) {
    if (req.body.confirmado_representante !== null && req.body.confirmado_representante !== true) {
      return res.status(400).json({
        ok: false,
        mensaje: 'confirmado_representante solo puede ser true o null',
      });
    }
    patch.confirmado_representante = req.body.confirmado_representante;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Envia al menos comentario_representante o confirmado_representante',
    });
  }

  if (patch.confirmado_representante === null) {
    patch.verificador_representante_id = null;
    patch.fecha_confirmacion_representante = null;
  }

  const { data, error } = await supabaseAdmin
    .from('verificaciones')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo actualizar la confirmacion de representante',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Verificacion no encontrada' });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Confirmacion de representante actualizada',
    verificacion: data,
  });
});

router.delete('/:verificacionId/representante', async (req, res) => {
  const id = parseVerificacionId(req.params.verificacionId);
  if (id == null) {
    return res.status(400).json({ ok: false, mensaje: 'verificacionId debe ser un entero positivo' });
  }

  const patch = {
    confirmado_representante: null,
    verificador_representante_id: null,
    comentario_representante: null,
    fecha_confirmacion_representante: null,
  };

  const { data, error } = await supabaseAdmin
    .from('verificaciones')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo limpiar la confirmacion de representante',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Verificacion no encontrada' });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Confirmacion de representante eliminada',
    verificacion: data,
  });
});

module.exports = router;
