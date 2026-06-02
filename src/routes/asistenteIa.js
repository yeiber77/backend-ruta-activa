const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const requireUserBearer = require('../middleware/requireUserBearer');
const { generarTextoGemini, buildSystemPrompt, geminiConfigured } = require('../utils/gemini');

const router = express.Router();

const coordinadorRoleId = Number(
  process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2
);

function actor(req) {
  return req.userActor;
}

function esCoordinador(rolId) {
  return Number(rolId) === coordinadorRoleId;
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

async function enrichUsuarios(rows, idField = 'usuario_id') {
  if (!rows?.length) return [];
  const ids = [...new Set(rows.map((r) => r[idField]).filter(Boolean))];
  const { data: usuarios } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, rol_id')
    .in('id', ids);
  const byId = new Map((usuarios || []).map((u) => [u.id, u]));

  return rows.map((row) => {
    const u = byId.get(row[idField]);
    const rol = row.rol_id ?? u?.rol_id ?? null;
    return {
      ...row,
      autor_nombre: u?.nombre || u?.email || 'Usuario',
      autor_rol_id: rol,
      autor_rol_nombre: rolEtiqueta(rol),
    };
  });
}

async function enrichCoordinadores(rows) {
  if (!rows?.length) return [];
  const ids = [...new Set(rows.map((r) => r.coordinador_id).filter(Boolean))];
  const { data: usuarios } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email')
    .in('id', ids);
  const byId = new Map((usuarios || []).map((u) => [u.id, u]));

  return rows.map((row) => {
    const u = byId.get(row.coordinador_id);
    return {
      ...row,
      coordinador_nombre: u?.nombre || u?.email || 'Coordinador',
    };
  });
}

async function fetchRetroalimentacionActiva() {
  const { data, error } = await supabaseAdmin
    .from('ia_retroalimentacion')
    .select('*')
    .eq('activo', true)
    .order('creado_en', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

router.use(requireUserBearer);

router.get('/estado', (_req, res) => {
  return res.status(200).json({
    ok: true,
    gemini_configurado: geminiConfigured(),
    modelo: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
  });
});

router.get('/retroalimentacion', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('ia_retroalimentacion')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(100);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar la retroalimentación',
      detalle: error.message,
    });
  }

  const items = await enrichCoordinadores(data || []);
  return res.status(200).json({ ok: true, retroalimentacion: items, total: items.length });
});

router.post('/retroalimentacion', async (req, res) => {
  const user = actor(req);
  if (!esCoordinador(user.rol_id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo el coordinador puede agregar retroalimentación para la IA',
    });
  }

  const contenido = typeof req.body.contenido === 'string' ? req.body.contenido.trim() : '';
  const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : null;

  if (!contenido) {
    return res.status(400).json({ ok: false, mensaje: 'contenido es obligatorio' });
  }

  const { data, error } = await supabaseAdmin
    .from('ia_retroalimentacion')
    .insert({
      coordinador_id: user.id,
      titulo: titulo || null,
      contenido,
      activo: true,
    })
    .select('*')
    .single();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo guardar la retroalimentación',
      detalle: error.message,
    });
  }

  const [item] = await enrichCoordinadores([data]);
  return res.status(201).json({
    ok: true,
    mensaje: 'Retroalimentación guardada. La IA usará esta guía en futuras consultas.',
    retroalimentacion: item,
  });
});

router.patch('/retroalimentacion/:id', async (req, res) => {
  const user = actor(req);
  if (!esCoordinador(user.rol_id)) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo el coordinador puede editar retroalimentación',
    });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ ok: false, mensaje: 'id inválido' });
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'activo')) {
    patch.activo = Boolean(req.body.activo);
  }
  if (typeof req.body.contenido === 'string') {
    patch.contenido = req.body.contenido.trim();
  }
  if (typeof req.body.titulo === 'string') {
    patch.titulo = req.body.titulo.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ ok: false, mensaje: 'Nada que actualizar' });
  }

  const { data, error } = await supabaseAdmin
    .from('ia_retroalimentacion')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo actualizar',
      detalle: error.message,
    });
  }

  if (!data) {
    return res.status(404).json({ ok: false, mensaje: 'Retroalimentación no encontrada' });
  }

  const [item] = await enrichCoordinadores([data]);
  return res.status(200).json({ ok: true, retroalimentacion: item });
});

router.get('/consultas', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const { data, error } = await supabaseAdmin
    .from('ia_consultas')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudieron listar las consultas',
      detalle: error.message,
    });
  }

  const consultas = await enrichUsuarios(data || []);
  return res.status(200).json({ ok: true, consultas, total: consultas.length });
});

router.post('/consultas', async (req, res) => {
  const user = actor(req);
  const pregunta = typeof req.body.pregunta === 'string' ? req.body.pregunta.trim() : '';

  if (!pregunta) {
    return res.status(400).json({ ok: false, mensaje: 'pregunta es obligatoria' });
  }

  if (pregunta.length > 2000) {
    return res.status(400).json({ ok: false, mensaje: 'La pregunta es demasiado larga (máx. 2000 caracteres)' });
  }

  if (!geminiConfigured()) {
    return res.status(503).json({
      ok: false,
      mensaje: 'El asistente IA no está configurado. Agrega GEMINI_API_KEY en el servidor.',
    });
  }

  let retroalimentaciones;
  try {
    retroalimentaciones = await fetchRetroalimentacionActiva();
  } catch (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo cargar la guía del coordinador',
      detalle: error.message,
    });
  }

  const systemPrompt = buildSystemPrompt(retroalimentaciones);
  let respuesta;

  try {
    respuesta = await generarTextoGemini(systemPrompt, pregunta);
  } catch (error) {
    const status = error.status === 429 ? 429 : 502;
    return res.status(status).json({
      ok: false,
      mensaje: 'No se pudo obtener respuesta de la IA',
      detalle: error.message,
    });
  }

  const { data, error } = await supabaseAdmin
    .from('ia_consultas')
    .insert({
      usuario_id: user.id,
      rol_id: user.rol_id,
      pregunta,
      respuesta,
    })
    .select('*')
    .single();

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'La IA respondió pero no se pudo guardar la consulta',
      detalle: error.message,
      respuesta,
    });
  }

  const [consulta] = await enrichUsuarios([data]);
  return res.status(201).json({ ok: true, consulta });
});

module.exports = router;
