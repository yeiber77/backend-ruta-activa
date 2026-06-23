const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { normalizeEstado, isEstadoRutaPermitido, ESTADOS_RUTA } = require('../utils/rutaEstado');
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

async function fetchRutaById(rutaId) {
  const { data, error } = await supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('id', rutaId)
    .maybeSingle();
  return { ruta: data, error };
}

async function fetchVerificacionesByRutaIds(rutaIds) {
  if (!rutaIds.length) {
    return { rows: [], error: null };
  }

  const { data, error } = await supabaseAdmin
    .from('verificaciones')
    .select('*')
    .in('ruta_id', rutaIds)
    .order('id', { ascending: false });

  return { rows: data || [], error };
}

function pickLatestByRuta(verificaciones) {
  const byRuta = new Map();
  for (const row of verificaciones) {
    if (!byRuta.has(row.ruta_id)) {
      byRuta.set(row.ruta_id, row);
    }
  }
  return byRuta;
}

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const columnaExiste = await tieneColumnaAdicional();
  const colVisible = await tieneColumnaVisibleLista();

  let q = supabaseAdmin.from('rutas').select('*');
  q = aplicarFiltroAdicional(q, false, columnaExiste);
  q = aplicarFiltroVisibleListaEnQuery(q, colVisible);
  q = q.order('id', { ascending: false });

  if (req.query.estado != null && String(req.query.estado).trim() !== '') {
    const canon = normalizeEstado(req.query.estado);
    if (!isEstadoRutaPermitido(canon)) {
      return res.status(400).json({
        ok: false,
        mensaje: `estado no valido. Valores permitidos: ${ESTADOS_RUTA.join(', ')}`,
      });
    }
    q = q.eq('estado', canon);
  }

  const { data: rutas, error } = await q.range(offset, offset + limit - 1);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar rutas',
      detalle: error.message,
    });
  }

  const list = rutas || [];
  const rutaIds = list.map((ruta) => ruta.id);
  const { rows: verificaciones, error: verifError } = await fetchVerificacionesByRutaIds(rutaIds);
  if (verifError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron leer verificaciones asociadas',
      detalle: verifError.message,
    });
  }

  const verifByRuta = pickLatestByRuta(verificaciones);
  const rutasConVerificacion = list.map((ruta) => ({
    ...ruta,
    verificacion: verifByRuta.get(ruta.id) || null,
  }));

  return res.status(200).json({
    ok: true,
    rutas: rutasConVerificacion,
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
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }

  const list = result.body.rutas || [];
  const rutaIds = list.map((ruta) => ruta.id);
  const { rows: verificaciones, error: verifError } = await fetchVerificacionesByRutaIds(rutaIds);
  if (verifError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron leer verificaciones del historial',
      detalle: verifError.message,
    });
  }

  const verifByRuta = pickLatestByRuta(verificaciones);
  const rutasConVerificacion = list.map((ruta) => ({
    ...ruta,
    verificacion: verifByRuta.get(ruta.id) || null,
  }));

  return res.status(200).json({
    ok: true,
    rutas: rutasConVerificacion,
    total: rutasConVerificacion.length,
  });
});

router.get('/adicionales', async (req, res) => {
  const limit = req.query.limit;
  const colVisible = await tieneColumnaVisibleLista();
  let qAd = supabaseAdmin.from('rutas').select('*');
  qAd = aplicarFiltroVisibleListaEnQuery(qAd, colVisible);
  const result = await listarRutasAdicionales(qAd, limit);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }

  const list = result.body.rutas || [];
  const rutaIds = list.map((ruta) => ruta.id);
  const { rows: verificaciones, error: verifError } = await fetchVerificacionesByRutaIds(rutaIds);
  if (verifError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron leer verificaciones de rutas adicionales',
      detalle: verifError.message,
    });
  }

  const verifByRuta = pickLatestByRuta(verificaciones);
  const rutasConVerificacion = list.map((ruta) => ({
    ...ruta,
    verificacion: verifByRuta.get(ruta.id) || null,
  }));

  return res.status(200).json({
    ok: true,
    rutas: rutasConVerificacion,
    total: rutasConVerificacion.length,
  });
});

router.get('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  const { ruta, error } = await fetchRutaById(rutaId);
  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la ruta',
      detalle: error.message,
    });
  }
  if (!ruta) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
  }

  return res.status(200).json({ ok: true, ruta });
});

module.exports = router;
