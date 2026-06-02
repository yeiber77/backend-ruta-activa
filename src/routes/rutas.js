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

const PATCHABLE = new Set([
  'comunidad_nombre',
  'chofer_id',
  'representante_id',
  'coordinador_id',
  'estado',
  'finalizado_en',
]);

const representanteRoleId = Number(
  process.env.ROLE_REPRESENTANTE_ID || process.env.ROL_REPRESENTANTE_ID || 5
);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRutaId(param) {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
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

router.patch('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
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

  if (Object.prototype.hasOwnProperty.call(patch, 'representante_id')) {
    if (patch.representante_id === '') {
      patch.representante_id = null;
    }
    if (patch.representante_id != null && !isUuid(patch.representante_id)) {
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

  const { data, error } = await supabaseAdmin
    .from('rutas')
    .update(patch)
    .eq('id', rutaId)
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
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
  }

  return res.status(200).json({ ok: true, mensaje: 'Ruta actualizada', ruta: data });
});

router.delete('/:rutaId', async (req, res) => {
  const rutaId = parseRutaId(req.params.rutaId);
  if (rutaId == null) {
    return res.status(400).json({ ok: false, mensaje: 'rutaId debe ser un entero positivo' });
  }

  const { data, error } = await supabaseAdmin.from('rutas').delete().eq('id', rutaId).select('id');

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo eliminar la ruta',
      detalle: error.message,
    });
  }

  if (!data?.length) {
    return res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Ruta eliminada',
    eliminado: data[0],
  });
});

module.exports = router;
