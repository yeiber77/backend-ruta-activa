const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const {
  normalizeEstado,
  isEstadoRutaPermitido,
  isEstadoChoferPermitido,
  ESTADOS_RUTA,
  ESTADOS_CHOFER,
} = require('../utils/rutaEstado');

const router = express.Router();

function parseRutaId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

function choferId(req) {
  return req.choferActor.id;
}

async function fetchRutaIfAssigned(rutaId, driverId) {
  const { data, error } = await supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('id', rutaId)
    .eq('chofer_id', driverId)
    .maybeSingle();
  return { ruta: data, error };
}

router.get('/reportes', async (req, res) => {
  const id = choferId(req);

  const { data: rutas, error } = await supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('chofer_id', id)
    .order('id', { ascending: false });

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo obtener rutas para reportes',
      detalle: error.message,
    });
  }

  const list = rutas || [];
  const porEstado = {};
  let sinCoordinador = 0;

  for (const r of list) {
    const e = r.estado != null ? String(r.estado) : '(sin estado)';
    porEstado[e] = (porEstado[e] || 0) + 1;
    if (r.coordinador_id == null) {
      sinCoordinador += 1;
    }
  }

  const ultimas = list.slice(0, 5);

  return res.status(200).json({
    ok: true,
    resumen: {
      total: list.length,
      por_estado: porEstado,
    },
    sin_coordinador: sinCoordinador,
    ultimas_actualizadas: ultimas,
  });
});

router.get('/', async (req, res) => {
  const id = choferId(req);
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let q = supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('chofer_id', id)
    .order('id', { ascending: false });

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

  const { data, error } = await q.range(offset, offset + limit - 1);

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

  const { ruta, error } = await fetchRutaIfAssigned(rutaId, choferId(req));
  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la ruta',
      detalle: error.message,
    });
  }
  if (!ruta) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada o no te esta asignada' });
  }

  return res.status(200).json({ ok: true, ruta });
});

router.patch('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  const bodyKeys = Object.keys(req.body || {});
  if (!bodyKeys.includes('estado')) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Debes enviar estado en el cuerpo (unico campo permitido)',
    });
  }

  const extra = bodyKeys.filter((k) => k !== 'estado');
  if (extra.length > 0) {
    return res.status(400).json({
      ok: false,
      mensaje: `Solo se permite actualizar estado. Campos no permitidos: ${extra.join(', ')}`,
    });
  }

  const nuevo = normalizeEstado(req.body.estado);
  if (!isEstadoChoferPermitido(nuevo)) {
    return res.status(403).json({
      ok: false,
      mensaje: `El chofer no puede poner Completada. Valores permitidos: ${ESTADOS_CHOFER.join(', ')}`,
    });
  }

  const driverId = choferId(req);
  const { data, error } = await supabaseAdmin
    .from('rutas')
    .update({ estado: nuevo })
    .eq('id', rutaId)
    .eq('chofer_id', driverId)
    .select('*')
    .maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo actualizar la ruta',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada o no te esta asignada' });
  }

  return res.status(200).json({ ok: true, mensaje: 'Estado actualizado', ruta: data });
});

module.exports = router;
