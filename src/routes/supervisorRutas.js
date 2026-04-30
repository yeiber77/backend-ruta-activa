const express = require('express');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

function parseRutaId(param) {
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
    .from('rutas')
    .select('*')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar rutas',
      detalle: error.message,
    });
  }

  return res.status(200).json({
    ok: true,
    rutas: data || [],
    limit,
    offset,
  });
});

router.get('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  const { data, error } = await supabaseAdmin.from('rutas').select('*').eq('id', rutaId).maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la ruta',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
  }

  return res.status(200).json({ ok: true, ruta: data });
});

module.exports = router;
