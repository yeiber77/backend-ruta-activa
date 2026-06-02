const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const requireRepresentanteBearer = require('../middleware/requireRepresentanteBearer');
const { listarRutasAdicionales } = require('../utils/rutaAdicional');
const { aplicarFiltroAdicional, tieneColumnaAdicional } = require('../utils/rutaAdicionalSchema');
const {
  aplicarFiltroVisibleListaEnQuery,
  tieneColumnaVisibleLista,
} = require('../utils/rutaVisibleListaSchema');
const { listarRutasHistorial } = require('../utils/rutaHistorial');
const { normalizeEstado } = require('../utils/rutaEstado');

const router = express.Router();

function representanteId(req) {
  return req.representanteActor.id;
}

function parseRutaId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

async function fetchRutaIfAssigned(rutaId, repId) {
  const { data, error } = await supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('id', rutaId)
    .eq('representante_id', repId)
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

router.use(requireRepresentanteBearer);

router.get('/reportes', async (req, res) => {
  const repId = representanteId(req);
  const { data: rutas, error: rutasError } = await supabaseAdmin
    .from('rutas')
    .select('id, comunidad_nombre, estado, representante_id')
    .eq('representante_id', repId)
    .order('id', { ascending: false });

  if (rutasError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron leer rutas para reportes',
      detalle: rutasError.message,
    });
  }

  const list = rutas || [];
  const rutaIds = list.map((r) => r.id);
  const { rows: verificaciones, error: verifError } = await fetchVerificacionesByRutaIds(rutaIds);
  if (verifError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron leer verificaciones para reportes',
      detalle: verifError.message,
    });
  }

  const verifByRuta = pickLatestByRuta(verificaciones);
  let totalPendientesConfirmacionRepresentante = 0;
  let totalConfirmadasRepresentante = 0;
  let totalConfirmadasSupervisor = 0;
  const ultimasConfirmaciones = [];

  for (const ruta of list) {
    const verif = verifByRuta.get(ruta.id) || null;
    if (!verif || verif.confirmado_representante == null) {
      totalPendientesConfirmacionRepresentante += 1;
    }
    if (verif?.confirmado_representante === true) {
      totalConfirmadasRepresentante += 1;
      ultimasConfirmaciones.push({
        ruta_id: ruta.id,
        comunidad_nombre: ruta.comunidad_nombre,
        fecha_confirmacion_representante: verif.fecha_confirmacion_representante,
        comentario_representante: verif.comentario_representante,
      });
    }
    if (verif?.confirmado === true) {
      totalConfirmadasSupervisor += 1;
    }
  }

  ultimasConfirmaciones.sort((a, b) => {
    const aTime = a.fecha_confirmacion_representante
      ? new Date(a.fecha_confirmacion_representante).getTime()
      : 0;
    const bTime = b.fecha_confirmacion_representante
      ? new Date(b.fecha_confirmacion_representante).getTime()
      : 0;
    return bTime - aTime;
  });

  return res.status(200).json({
    ok: true,
    total_rutas_asignadas: list.length,
    total_pendientes_confirmacion_representante: totalPendientesConfirmacionRepresentante,
    total_confirmadas_representante: totalConfirmadasRepresentante,
    total_confirmadas_supervisor: totalConfirmadasSupervisor,
    ultimas_confirmaciones: ultimasConfirmaciones.slice(0, 5),
  });
});

router.get('/rutas', async (req, res) => {
  const repId = representanteId(req);
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const columnaExiste = await tieneColumnaAdicional();
  const colVisible = await tieneColumnaVisibleLista();

  let rutasQuery = supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('representante_id', repId);
  rutasQuery = aplicarFiltroAdicional(rutasQuery, false, columnaExiste);
  rutasQuery = aplicarFiltroVisibleListaEnQuery(rutasQuery, colVisible);
  rutasQuery = rutasQuery.order('id', { ascending: false });

  if (req.query.estado != null && String(req.query.estado).trim() !== '') {
    rutasQuery = rutasQuery.eq('estado', normalizeEstado(req.query.estado));
  }

  const { data: rutas, error: rutasError } = await rutasQuery.range(offset, offset + limit - 1);
  if (rutasError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar rutas del representante',
      detalle: rutasError.message,
    });
  }

  const list = rutas || [];
  const rutaIds = list.map((r) => r.id);
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

router.get('/rutas/historial', async (req, res) => {
  const repId = representanteId(req);
  const limit = req.query.limit;
  const columnaExiste = await tieneColumnaAdicional();
  const colVisible = await tieneColumnaVisibleLista();
  let q = supabaseAdmin.from('rutas').select('*').eq('representante_id', repId);
  q = aplicarFiltroAdicional(q, false, columnaExiste);
  q = aplicarFiltroVisibleListaEnQuery(q, colVisible);
  const result = await listarRutasHistorial(q, limit);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }

  const list = result.body.rutas || [];
  const rutaIds = list.map((r) => r.id);
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

router.get('/rutas/adicionales', async (req, res) => {
  const repId = representanteId(req);
  const limit = req.query.limit;
  const colVisible = await tieneColumnaVisibleLista();
  let qAd = supabaseAdmin.from('rutas').select('*').eq('representante_id', repId);
  qAd = aplicarFiltroVisibleListaEnQuery(qAd, colVisible);
  const result = await listarRutasAdicionales(qAd, limit);
  if (!result.ok) {
    return res.status(result.status).json(result.body);
  }

  const list = result.body.rutas || [];
  const rutaIds = list.map((r) => r.id);
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

router.post('/rutas/:rutaId/confirmacion', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'comentario_representante')) {
    if (
      req.body.comentario_representante !== null &&
      typeof req.body.comentario_representante !== 'string'
    ) {
      return res.status(400).json({
        ok: false,
        mensaje: 'comentario_representante debe ser string o null',
      });
    }
  }

  const comentarioRepresentante =
    req.body.comentario_representante === undefined ? null : req.body.comentario_representante;

  const repId = representanteId(req);
  const { ruta, error: rutaError } = await fetchRutaIfAssigned(rutaId, repId);
  if (rutaError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo validar la ruta',
      detalle: rutaError.message,
    });
  }

  if (!ruta) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada o no te esta asignada' });
  }

  const { data: existente, error: existenteErr } = await supabaseAdmin
    .from('verificaciones')
    .select('*')
    .eq('ruta_id', rutaId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existenteErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo validar la verificacion actual de la ruta',
      detalle: existenteErr.message,
    });
  }

  if (existente && existente.confirmado_representante === true) {
    return res.status(409).json({
      ok: false,
      mensaje: 'La ruta ya fue confirmada por representante',
      verificacion_id: existente.id,
    });
  }

  if (existente && existente.confirmado !== true) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El representante solo puede confirmar despues de la confirmacion del supervisor',
    });
  }

  const estadoCanon = normalizeEstado(ruta.estado);
  if (!existente && estadoCanon !== 'Completada') {
    return res.status(400).json({
      ok: false,
      mensaje: 'Solo puedes confirmar cuando la ruta ya fue completada por supervisor',
    });
  }

  const ahora = new Date().toISOString();
  const patchRepresentante = {
    confirmado_representante: true,
    verificador_representante_id: repId,
    comentario_representante: comentarioRepresentante,
    fecha_confirmacion_representante: ahora,
  };

  let verificacion;
  if (existente) {
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('verificaciones')
      .update(patchRepresentante)
      .eq('id', existente.id)
      .select('*')
      .maybeSingle();

    if (updErr) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se pudo registrar la confirmacion del representante',
        detalle: updErr.message,
      });
    }
    verificacion = updated;
  } else {
    const insertPayload = {
      ruta_id: rutaId,
      ...patchRepresentante,
    };
    const { data: created, error: insErr } = await supabaseAdmin
      .from('verificaciones')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (insErr) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se pudo crear la verificacion con confirmacion de representante',
        detalle: insErr.message,
      });
    }
    verificacion = created;
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Confirmacion de representante registrada',
    verificacion,
  });
});

module.exports = router;
