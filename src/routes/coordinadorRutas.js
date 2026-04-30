const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { normalizeEstado } = require('../utils/rutaEstado');

const router = express.Router();

const PATCHABLE = new Set(['comunidad_nombre', 'chofer_id', 'representante_id', 'estado', 'finalizado_en']);

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);
const representanteRoleId = Number(
  process.env.ROLE_REPRESENTANTE_ID || process.env.ROL_REPRESENTANTE_ID || 5
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function parseRutaId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

function coordinadorId(req) {
  return req.coordinadorActor.id;
}

async function fetchRutaIfOwned(rutaId, coordId) {
  const { data, error } = await supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('id', rutaId)
    .eq('coordinador_id', coordId)
    .maybeSingle();
  return { ruta: data, error };
}

async function assertChoferRol(choferId) {
  if (!choferId) {
    return { ok: true };
  }
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, rol_id')
    .eq('id', choferId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 400, mensaje: 'No se pudo validar el chofer', detalle: error.message };
  }
  if (!data) {
    return { ok: false, status: 400, mensaje: 'chofer_id no corresponde a un usuario existente' };
  }
  if (Number(data.rol_id) !== choferRoleId) {
    return { ok: false, status: 400, mensaje: 'chofer_id debe ser un usuario con rol Chofer' };
  }
  return { ok: true };
}

async function assertRepresentanteRol(representanteId) {
  if (!representanteId) {
    return { ok: true };
  }
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, rol_id')
    .eq('id', representanteId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 400,
      mensaje: 'No se pudo validar el representante',
      detalle: error.message,
    };
  }
  if (!data) {
    return { ok: false, status: 400, mensaje: 'representante_id no corresponde a un usuario existente' };
  }
  if (Number(data.rol_id) !== representanteRoleId) {
    return { ok: false, status: 400, mensaje: 'representante_id debe ser un usuario con rol Representante' };
  }
  return { ok: true };
}

router.get('/reportes', async (req, res) => {
  const coordId = coordinadorId(req);

  const { data: rutas, error } = await supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('coordinador_id', coordId)
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
  let sinChofer = 0;

  for (const r of list) {
    const e = r.estado != null ? String(r.estado) : '(sin estado)';
    porEstado[e] = (porEstado[e] || 0) + 1;
    if (r.chofer_id == null) {
      sinChofer += 1;
    }
  }

  const ultimas = list.slice(0, 5);

  return res.status(200).json({
    ok: true,
    resumen: {
      total: list.length,
      por_estado: porEstado,
    },
    sin_chofer: sinChofer,
    ultimas_actualizadas: ultimas,
  });
});

router.get('/', async (req, res) => {
  const coordId = coordinadorId(req);
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let q = supabaseAdmin
    .from('rutas')
    .select('*')
    .eq('coordinador_id', coordId)
    .order('id', { ascending: false });

  if (req.query.estado != null && String(req.query.estado).trim() !== '') {
    q = q.eq('estado', normalizeEstado(req.query.estado));
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

router.post('/', async (req, res) => {
  const coordId = coordinadorId(req);
  const { comunidad_nombre, chofer_id, representante_id } = req.body;

  if (!comunidad_nombre || typeof comunidad_nombre !== 'string' || !comunidad_nombre.trim()) {
    return res.status(400).json({
      ok: false,
      mensaje: 'comunidad_nombre es obligatorio',
    });
  }

  let choferUuid = null;
  const choferRaw = chofer_id === '' ? null : chofer_id;
  if (choferRaw !== undefined && choferRaw !== null) {
    if (!isUuid(choferRaw)) {
      return res.status(400).json({ ok: false, mensaje: 'chofer_id debe ser un UUID valido o null' });
    }
    choferUuid = choferRaw;
    const chk = await assertChoferRol(choferUuid);
    if (!chk.ok) {
      return res.status(chk.status).json({
        ok: false,
        mensaje: chk.mensaje,
        ...(chk.detalle && { detalle: chk.detalle }),
      });
    }
  }

  let representanteUuid = null;
  const representanteRaw = representante_id === '' ? null : representante_id;
  if (representanteRaw !== undefined && representanteRaw !== null) {
    if (!isUuid(representanteRaw)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'representante_id debe ser un UUID valido o null',
      });
    }
    representanteUuid = representanteRaw;
    const chk = await assertRepresentanteRol(representanteUuid);
    if (!chk.ok) {
      return res.status(chk.status).json({
        ok: false,
        mensaje: chk.mensaje,
        ...(chk.detalle && { detalle: chk.detalle }),
      });
    }
  }

  const estadoInicial = normalizeEstado(req.body.estado);

  const insertPayload = {
    comunidad_nombre: comunidad_nombre.trim(),
    chofer_id: choferUuid,
    representante_id: representanteUuid,
    coordinador_id: coordId,
    estado: estadoInicial,
  };

  const { data, error } = await supabaseAdmin.from('rutas').insert(insertPayload).select('*').maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo crear la ruta',
      detalle: error.message,
    });
  }

  return res.status(201).json({
    ok: true,
    mensaje: 'Ruta creada',
    ruta: data,
  });
});

router.get('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  const { ruta, error } = await fetchRutaIfOwned(rutaId, coordinadorId(req));
  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la ruta',
      detalle: error.message,
    });
  }
  if (!ruta) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada o no es tuya' });
  }

  return res.status(200).json({ ok: true, ruta });
});

router.patch('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  const coordId = coordinadorId(req);
  const { ruta: existing, error: readErr } = await fetchRutaIfOwned(rutaId, coordId);
  if (readErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer la ruta',
      detalle: readErr.message,
    });
  }
  if (!existing) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada o no es tuya' });
  }

  const patch = {};
  for (const key of PATCHABLE) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      patch[key] = req.body[key];
    }
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      ok: false,
      mensaje: `Nada que actualizar. Campos permitidos: ${[...PATCHABLE].join(', ')}`,
    });
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'chofer_id')) {
    if (patch.chofer_id === '') {
      patch.chofer_id = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'representante_id')) {
    if (patch.representante_id === '') {
      patch.representante_id = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'chofer_id') && patch.chofer_id != null) {
    if (!isUuid(patch.chofer_id)) {
      return res.status(400).json({ ok: false, mensaje: 'chofer_id debe ser un UUID valido' });
    }
    const chk = await assertChoferRol(patch.chofer_id);
    if (!chk.ok) {
      return res.status(chk.status).json({
        ok: false,
        mensaje: chk.mensaje,
        ...(chk.detalle && { detalle: chk.detalle }),
      });
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(patch, 'representante_id') &&
    patch.representante_id != null
  ) {
    if (!isUuid(patch.representante_id)) {
      return res.status(400).json({ ok: false, mensaje: 'representante_id debe ser un UUID valido' });
    }
    const chk = await assertRepresentanteRol(patch.representante_id);
    if (!chk.ok) {
      return res.status(chk.status).json({
        ok: false,
        mensaje: chk.mensaje,
        ...(chk.detalle && { detalle: chk.detalle }),
      });
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'estado')) {
    patch.estado = normalizeEstado(patch.estado);
  }

  const { data, error } = await supabaseAdmin
    .from('rutas')
    .update(patch)
    .eq('id', rutaId)
    .eq('coordinador_id', coordId)
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
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada o no es tuya' });
  }

  return res.status(200).json({ ok: true, mensaje: 'Ruta actualizada', ruta: data });
});

router.delete('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  const coordId = coordinadorId(req);
  const { data, error } = await supabaseAdmin
    .from('rutas')
    .delete()
    .eq('id', rutaId)
    .eq('coordinador_id', coordId)
    .select('id');

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo eliminar la ruta',
      detalle: error.message,
    });
  }

  if (!data?.length) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada o no es tuya' });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Ruta eliminada',
    eliminado: data[0],
  });
});

module.exports = router;
