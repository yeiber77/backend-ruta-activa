const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { normalizeEstado } = require('../utils/rutaEstado');

const router = express.Router();

function actorId(req) {
  return req.supervisorActor.id;
}

function parseVerificacionId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

function parseRutaIdBody(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

async function marcarRutaCompletadaSiCorresponde(rutaId) {
  const { data: ruta, error } = await supabaseAdmin
    .from('rutas')
    .select('id, estado')
    .eq('id', rutaId)
    .maybeSingle();

  if (error || !ruta) {
    return { ok: false, detalle: error?.message };
  }

  if (normalizeEstado(ruta.estado) !== 'En Proceso') {
    return { ok: true, skipped: true };
  }

  const ahora = new Date().toISOString();
  const { error: updErr } = await supabaseAdmin
    .from('rutas')
    .update({ estado: 'Completada', finalizado_en: ahora })
    .eq('id', rutaId);

  if (updErr) {
    return { ok: false, detalle: updErr.message };
  }
  return { ok: true, skipped: false };
}

router.get('/reportes', async (req, res) => {
  const sid = actorId(req);

  const { data: rows, error } = await supabaseAdmin
    .from('verificaciones')
    .select('*')
    .eq('verificador_id', sid)
    .order('id', { ascending: false });

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo obtener verificaciones para reportes',
      detalle: error.message,
    });
  }

  const list = rows || [];
  const porConfirmado = { true: 0, false: 0 };
  for (const v of list) {
    if (v.confirmado === true) {
      porConfirmado.true += 1;
    } else {
      porConfirmado.false += 1;
    }
  }

  return res.status(200).json({
    ok: true,
    resumen: {
      total: list.length,
      por_confirmado: porConfirmado,
    },
    ultimas: list.slice(0, 10),
  });
});

router.get('/', async (req, res) => {
  const sid = actorId(req);
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let q = supabaseAdmin
    .from('verificaciones')
    .select('*')
    .eq('verificador_id', sid)
    .order('id', { ascending: false });

  const rutaFilter = req.query.ruta_id;
  if (rutaFilter != null && String(rutaFilter).trim() !== '') {
    const rid = parseRutaIdBody(rutaFilter);
    if (rid == null) {
      return res.status(400).json({ ok: false, mensaje: 'ruta_id en query debe ser un entero positivo' });
    }
    q = q.eq('ruta_id', rid);
  }

  const { data, error } = await q.range(offset, offset + limit - 1);

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

router.post('/', async (req, res) => {
  const { ruta_id, confirmado, comentario } = req.body;
  const rutaId = parseRutaIdBody(ruta_id);

  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'ruta_id es obligatorio y debe ser un entero positivo' });
  }

  if (typeof confirmado !== 'boolean') {
    return res.status(400).json({
      ok: false,
      mensaje: 'confirmado es obligatorio y debe ser boolean (true o false)',
    });
  }

  if (comentario === undefined) {
    return res.status(400).json({
      ok: false,
      mensaje: 'comentario es obligatorio (puede ser string vacio)',
    });
  }

  if (typeof comentario !== 'string') {
    return res.status(400).json({
      ok: false,
      mensaje: 'comentario debe ser string',
    });
  }

  const { data: existente, error: exErr } = await supabaseAdmin
    .from('verificaciones')
    .select('id')
    .eq('ruta_id', rutaId)
    .maybeSingle();

  if (exErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo comprobar verificaciones existentes',
      detalle: exErr.message,
    });
  }

  if (existente) {
    return res.status(409).json({
      ok: false,
      mensaje: 'Ya existe una verificacion para esta ruta. Usa PATCH /api/supervisor/verificaciones/:id',
      verificacion_id: existente.id,
    });
  }

  const { data: ruta, error: rutaErr } = await supabaseAdmin
    .from('rutas')
    .select('id, estado')
    .eq('id', rutaId)
    .maybeSingle();

  if (rutaErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la ruta',
      detalle: rutaErr.message,
    });
  }

  if (!ruta) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
  }

  if (confirmado === true && normalizeEstado(ruta.estado) !== 'En Proceso') {
    return res.status(400).json({
      ok: false,
      mensaje: 'Solo se puede confirmar (completar la ruta) si la ruta esta en estado En Proceso',
    });
  }

  const ahora = new Date().toISOString();
  const insertRow = {
    ruta_id: rutaId,
    verificador_id: actorId(req),
    confirmado,
    comentario,
    fecha_confirmacion: confirmado ? ahora : null,
  };

  const { data: created, error: insErr } = await supabaseAdmin
    .from('verificaciones')
    .insert(insertRow)
    .select('*')
    .maybeSingle();

  if (insErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo crear la verificacion',
      detalle: insErr.message,
    });
  }

  if (confirmado === true) {
    const comp = await marcarRutaCompletadaSiCorresponde(rutaId);
    if (!comp.ok) {
      return res.status(500).json({
        ok: false,
        mensaje: 'Verificacion creada pero fallo actualizar la ruta a Completada',
        detalle: comp.detalle,
        verificacion: created,
      });
    }
  }

  const { data: rutaActualizada } = await supabaseAdmin.from('rutas').select('*').eq('id', rutaId).maybeSingle();

  return res.status(201).json({
    ok: true,
    mensaje: 'Verificacion creada',
    verificacion: created,
    ...(rutaActualizada && { ruta: rutaActualizada }),
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
    .eq('verificador_id', actorId(req))
    .maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la verificacion',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Verificacion no encontrada o no es tuya' });
  }

  return res.status(200).json({ ok: true, verificacion: data });
});

router.patch('/:verificacionId', async (req, res) => {
  const id = parseVerificacionId(req.params.verificacionId);
  if (id == null) {
    return res.status(400).json({ ok: false, mensaje: 'verificacionId debe ser un entero positivo' });
  }

  const sid = actorId(req);
  const { data: row, error: readErr } = await supabaseAdmin
    .from('verificaciones')
    .select('*')
    .eq('id', id)
    .eq('verificador_id', sid)
    .maybeSingle();

  if (readErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la verificacion',
      detalle: readErr.message,
    });
  }

  if (!row) {
    return res.status(404).json({ ok: false, mensaje: 'Verificacion no encontrada o no es tuya' });
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'confirmado')) {
    if (typeof req.body.confirmado !== 'boolean') {
      return res.status(400).json({ ok: false, mensaje: 'confirmado debe ser boolean' });
    }
    patch.confirmado = req.body.confirmado;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'comentario')) {
    if (typeof req.body.comentario !== 'string') {
      return res.status(400).json({ ok: false, mensaje: 'comentario debe ser string' });
    }
    patch.comentario = req.body.comentario;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Envia al menos confirmado o comentario',
    });
  }

  const seActivaConfirmacion =
    Object.prototype.hasOwnProperty.call(patch, 'confirmado') &&
    patch.confirmado === true &&
    row.confirmado !== true;

  if (seActivaConfirmacion) {
    const { data: ruta, error: rutaErr } = await supabaseAdmin
      .from('rutas')
      .select('id, estado')
      .eq('id', row.ruta_id)
      .maybeSingle();

    if (rutaErr || !ruta) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se pudo validar la ruta asociada',
        detalle: rutaErr?.message,
      });
    }

    if (normalizeEstado(ruta.estado) !== 'En Proceso') {
      return res.status(400).json({
        ok: false,
        mensaje: 'Solo se puede confirmar (completar la ruta) si la ruta esta en estado En Proceso',
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'confirmado')) {
    patch.fecha_confirmacion = patch.confirmado ? new Date().toISOString() : null;
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('verificaciones')
    .update(patch)
    .eq('id', id)
    .eq('verificador_id', sid)
    .select('*')
    .maybeSingle();

  if (updErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo actualizar la verificacion',
      detalle: updErr.message,
    });
  }

  if (!updated) {
    return res.status(404).json({ ok: false, mensaje: 'Verificacion no encontrada o no es tuya' });
  }

  if (updated.confirmado === true) {
    const comp = await marcarRutaCompletadaSiCorresponde(row.ruta_id);
    if (!comp.ok) {
      return res.status(500).json({
        ok: false,
        mensaje: 'Verificacion actualizada pero fallo actualizar la ruta a Completada',
        detalle: comp.detalle,
        verificacion: updated,
      });
    }
  }

  const { data: rutaFin } = await supabaseAdmin.from('rutas').select('*').eq('id', row.ruta_id).maybeSingle();

  return res.status(200).json({
    ok: true,
    mensaje: 'Verificacion actualizada',
    verificacion: updated,
    ...(rutaFin && { ruta: rutaFin }),
  });
});

module.exports = router;
