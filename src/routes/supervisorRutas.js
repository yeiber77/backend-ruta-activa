const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { listarRutasHistorial } = require('../utils/rutaHistorial');
const { listarRutasAdicionales } = require('../utils/rutaAdicional');
const { aplicarFiltroAdicional, tieneColumnaAdicional } = require('../utils/rutaAdicionalSchema');
const {
  aplicarFiltroVisibleListaEnQuery,
  tieneColumnaVisibleLista,
} = require('../utils/rutaVisibleListaSchema');

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
  const columnaExiste = await tieneColumnaAdicional();
  const colVisible = await tieneColumnaVisibleLista();

  let q = supabaseAdmin.from('rutas').select('*');
  q = aplicarFiltroAdicional(q, false, columnaExiste);
  q = aplicarFiltroVisibleListaEnQuery(q, colVisible);
  const { data, error } = await q
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

router.get('/historial', async (req, res) => {
  const limit = req.query.limit;
  const columnaExiste = await tieneColumnaAdicional();
  const colVisible = await tieneColumnaVisibleLista();
  let q = supabaseAdmin.from('rutas').select('*');
  q = aplicarFiltroAdicional(q, false, columnaExiste);
  q = aplicarFiltroVisibleListaEnQuery(q, colVisible);
  const result = await listarRutasHistorial(q, limit);
  return res.status(result.status).json(result.body);
});

router.get('/adicionales', async (req, res) => {
  const limit = req.query.limit;
  const colVisible = await tieneColumnaVisibleLista();
  let qAd = supabaseAdmin.from('rutas').select('*');
  qAd = aplicarFiltroVisibleListaEnQuery(qAd, colVisible);
  const result = await listarRutasAdicionales(qAd, limit);
  return res.status(result.status).json(result.body);
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
