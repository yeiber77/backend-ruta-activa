const express = require('express');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, telefono, rol_id')
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar usuarios',
      detalle: error.message,
    });
  }

  return res.status(200).json({
    ok: true,
    usuarios: data || [],
    limit,
    offset,
  });
});

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!isUuid(userId)) {
    return res.status(400).json({ ok: false, mensaje: 'userId debe ser un UUID valido' });
  }

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authErr || !authData?.user) {
    return res.status(404).json({
      ok: false,
      mensaje: 'Usuario no encontrado en Auth',
      detalle: authErr?.message,
    });
  }

  const { data: perfil, error: perfilErr } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, telefono, rol_id')
    .eq('id', userId)
    .maybeSingle();

  if (perfilErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo leer public.usuarios',
      detalle: perfilErr.message,
    });
  }

  return res.status(200).json({
    ok: true,
    user: {
      id: authData.user.id,
      email: authData.user.email,
    },
    perfil,
  });
});

router.post('/', async (req, res) => {
  const { email, password, nombre, telefono, rol_id } = req.body;

  if (!email || !password || !nombre) {
    return res.status(400).json({
      ok: false,
      mensaje: 'email, password y nombre son obligatorios',
    });
  }

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr || !created?.user) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo crear el usuario en Supabase Auth',
      detalle: createErr?.message,
    });
  }

  const userId = created.user.id;
  const profilePayload = {
    id: userId,
    nombre,
    email,
    telefono: telefono ?? null,
    rol_id: rol_id ?? null,
  };

  const { error: insertErr } = await supabaseAdmin.from('usuarios').insert(profilePayload);

  if (insertErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return res.status(400).json({
      ok: false,
      mensaje: 'Usuario creado en Auth pero fallo public.usuarios; se revirtio el usuario en Auth',
      detalle: insertErr.message,
    });
  }

  return res.status(201).json({
    ok: true,
    mensaje: 'Usuario creado en Auth y en public.usuarios',
    user_id: userId,
  });
});

router.patch('/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!isUuid(userId)) {
    return res.status(400).json({ ok: false, mensaje: 'userId debe ser un UUID valido' });
  }

  const { nombre, telefono, rol_id, email, password } = req.body;

  if (
    nombre === undefined &&
    telefono === undefined &&
    rol_id === undefined &&
    email === undefined &&
    password === undefined
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Envia al menos uno de: nombre, telefono, rol_id, email, password',
    });
  }

  const hasAuthUpdate = email !== undefined || password !== undefined;

  if (hasAuthUpdate) {
    const attrs = {};
    if (email !== undefined) attrs.email = email;
    if (password !== undefined) attrs.password = password;
    const { error: updAuthErr } = await supabaseAdmin.auth.admin.updateUserById(userId, attrs);
    if (updAuthErr) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se pudo actualizar credenciales en Auth',
        detalle: updAuthErr.message,
      });
    }
  }

  const profilePatch = {};
  if (nombre !== undefined) profilePatch.nombre = nombre;
  if (telefono !== undefined) profilePatch.telefono = telefono;
  if (rol_id !== undefined) profilePatch.rol_id = rol_id;
  if (email !== undefined) profilePatch.email = email;

  if (Object.keys(profilePatch).length > 0) {
    const { data: updatedRows, error: updErr } = await supabaseAdmin
      .from('usuarios')
      .update(profilePatch)
      .eq('id', userId)
      .select('id, nombre, email, telefono, rol_id');

    if (updErr) {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se pudo actualizar public.usuarios',
        detalle: updErr.message,
      });
    }

    if (!updatedRows?.length) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado en public.usuarios',
      });
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Usuario actualizado',
      perfil: updatedRows[0],
    });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Credenciales actualizadas en Auth',
  });
});

module.exports = router;
