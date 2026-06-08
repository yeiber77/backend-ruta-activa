const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const requireUserBearer = require('../middleware/requireUserBearer');

const router = express.Router();

const coordinadorRoleId = Number(
  process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2
);

const SQL_ANUNCIOS = 'backend-ruta-activa-main/sql/anuncios.sql';

const TIPOS_ANUNCIO = new Set(['general', 'vehiculo', 'ruta', 'urgente']);

function esCoordinador(rolId) {
  return Number(rolId) === coordinadorRoleId;
}

function errorTablaAnunciosFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('anuncios') &&
    (msg.includes('could not find the table') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist'))
  );
}

function rolEtiqueta(rolId) {
  switch (Number(rolId)) {
    case Number(process.env.ROLE_ADMIN_ID || process.env.ROL_ADMIN_ID || 1):
      return 'Administrador';
    case coordinadorRoleId:
      return 'Coordinador';
    case Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3):
      return 'Chofer';
    case Number(process.env.ROLE_SUPERVISOR_ID || process.env.ROL_SUPERVISOR_ID || 4):
      return 'Supervisor';
    case Number(process.env.ROLE_REPRESENTANTE_ID || process.env.ROL_REPRESENTANTE_ID || 5):
      return 'Representante';
    case Number(process.env.ROLE_OBRERO_ID || process.env.ROL_OBRERO_ID || 6):
      return 'Obrero';
    default:
      return rolId != null ? `Rol ${rolId}` : 'Sin rol';
  }
}

async function enrichAnuncios(rows) {
  if (!rows?.length) return [];
  const userIds = [...new Set(rows.map((r) => r.coordinador_id).filter(Boolean))];
  const { data: usuarios } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, rol_id')
    .in('id', userIds);

  const byId = new Map((usuarios || []).map((u) => [u.id, u]));

  return rows.map((row) => {
    const u = byId.get(row.coordinador_id);
    return {
      ...row,
      autor_nombre: u?.nombre || u?.email || 'Coordinador',
      autor_rol_nombre: rolEtiqueta(u?.rol_id ?? coordinadorRoleId),
    };
  });
}

function normalizarTipo(tipo) {
  const t = String(tipo || 'general').trim().toLowerCase();
  return TIPOS_ANUNCIO.has(t) ? t : 'general';
}

router.use(requireUserBearer);

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const soloActivos = req.query.todos !== '1';

  let query = supabaseAdmin
    .from('anuncios')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (soloActivos) {
    query = query.eq('activo', true);
  }

  const { data, error } = await query;

  if (error) {
    if (errorTablaAnunciosFaltante(error)) {
      return res.status(200).json({
        ok: true,
        anuncios: [],
        total: 0,
        aviso: `Falta crear la tabla en Supabase. Ejecuta: ${SQL_ANUNCIOS}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron listar los anuncios',
      detalle: error.message,
    });
  }

  const anuncios = await enrichAnuncios(data || []);
  return res.status(200).json({ ok: true, anuncios, total: anuncios.length });
});

router.post('/', async (req, res) => {
  const user = req.userActor;

  if (!esCoordinador(user.rol_id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo el coordinador puede publicar anuncios',
    });
  }

  const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
  const contenido = typeof req.body.contenido === 'string' ? req.body.contenido.trim() : '';
  const tipo = normalizarTipo(req.body.tipo);

  if (!titulo) {
    return res.status(400).json({ ok: false, mensaje: 'El título es obligatorio' });
  }
  if (!contenido) {
    return res.status(400).json({ ok: false, mensaje: 'El contenido del anuncio es obligatorio' });
  }
  if (titulo.length > 120) {
    return res.status(400).json({ ok: false, mensaje: 'El título no puede superar 120 caracteres' });
  }
  if (contenido.length > 2000) {
    return res.status(400).json({ ok: false, mensaje: 'El anuncio no puede superar 2000 caracteres' });
  }

  const { data, error } = await supabaseAdmin
    .from('anuncios')
    .insert({
      coordinador_id: user.id,
      titulo,
      contenido,
      tipo,
      activo: true,
    })
    .select('*')
    .single();

  if (error) {
    if (errorTablaAnunciosFaltante(error)) {
      return res.status(503).json({
        ok: false,
        mensaje: 'No se puede publicar hasta crear la tabla en Supabase',
        detalle: `Ejecuta en SQL Editor: ${SQL_ANUNCIOS}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo publicar el anuncio',
      detalle: error.message,
    });
  }

  const [anuncio] = await enrichAnuncios([data]);
  return res.status(201).json({
    ok: true,
    mensaje: 'Anuncio publicado',
    anuncio,
  });
});

router.delete('/:id', async (req, res) => {
  const user = req.userActor;

  if (!esCoordinador(user.rol_id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo el coordinador puede retirar anuncios',
    });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ ok: false, mensaje: 'ID de anuncio no válido' });
  }

  const { data, error } = await supabaseAdmin
    .from('anuncios')
    .update({ activo: false })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    if (errorTablaAnunciosFaltante(error)) {
      return res.status(503).json({
        ok: false,
        mensaje: 'No se puede retirar hasta crear la tabla en Supabase',
        detalle: `Ejecuta en SQL Editor: ${SQL_ANUNCIOS}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo retirar el anuncio',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Anuncio no encontrado' });
  }

  return res.status(200).json({ ok: true, mensaje: 'Anuncio retirado' });
});

module.exports = router;
