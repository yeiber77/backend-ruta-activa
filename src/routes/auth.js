const express = require('express');
const {
  supabase,
  supabaseAdmin,
  createUserScopedClient,
} = require('../config/supabase');
const { isValidAdmin } = require('../middleware/adminAuth');
const { extractBearerToken } = require('../utils/bearerToken');

const router = express.Router();
const adminRoleId = Number(process.env.ROLE_ADMIN_ID || process.env.ROL_ADMIN_ID || 1);
const coordinadorRoleId = Number(
  process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2
);
const allowedDeleteRoleIds = [adminRoleId, coordinadorRoleId].filter(Number.isFinite);

router.post('/register', async (req, res) => {
  const { email, password, nombre, telefono, rol_id } = req.body;

  if (!email || !password || !nombre) {
    return res.status(400).json({
      ok: false,
      mensaje: 'email, password y nombre son obligatorios',
    });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo registrar el usuario',
      detalle: error.message,
    });
  }

  const user = data.user;
  const accessToken = data.session?.access_token;

  if (!user) {
    return res.status(500).json({
      ok: false,
      mensaje: 'Registro incompleto: no se recibio el usuario de Supabase',
    });
  }

  const profilePayload = {
    id: user.id,
    nombre,
    email,
    telefono: telefono || null,
    rol_id: rol_id || null,
  };

  let insertError = null;

  if (supabaseAdmin) {
    const { error: profileError } = await supabaseAdmin.from('usuarios').insert(profilePayload);
    insertError = profileError;
  } else if (accessToken) {
    const supabaseUserClient = createUserScopedClient(accessToken);
    const { error: profileError } = await supabaseUserClient.from('usuarios').insert(profilePayload);
    insertError = profileError;
  } else {
    return res.status(202).json({
      ok: true,
      mensaje:
        'Usuario creado. Falta crear el perfil porque no hay sesion activa (revisa confirmacion por correo o agrega SUPABASE_SERVICE_ROLE_KEY en backend).',
      requiere_confirmacion: true,
    });
  }

  if (insertError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Usuario creado en Auth, pero fallo la creacion del perfil',
      detalle: insertError.message,
    });
  }

  return res.status(201).json({
    ok: true,
    mensaje: 'Usuario registrado correctamente',
    user_id: user.id,
    requiere_confirmacion: !data.session,
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      mensaje: 'email y password son obligatorios',
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Credenciales invalidas',
      detalle: error?.message,
    });
  }

  const authUser = data.user;
  let perfil = null;

  const profileClient = supabaseAdmin || createUserScopedClient(data.session.access_token);

  const { data: profileData, error: profileError } = await profileClient
    .from('usuarios')
    .select('id, nombre, email, telefono, rol_id')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileData) {
    perfil = profileData;
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Login correcto',
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: {
      id: authUser.id,
      email: authUser.email,
    },
    perfil,
    ...(profileError && { perfil_error: profileError.message }),
  });
});

router.get('/profile', async (req, res) => {
  if (isValidAdmin(req)) {
    if (!supabaseAdmin) {
      return res.status(503).json({
        ok: false,
        mensaje: 'Consulta como admin',
      });
    }

    const userId = req.query.user_id;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        ok: false,
        mensaje:
          'Como admin debes enviar user_id en la query, por ejemplo ?user_id=<uuid>',
      });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (authErr || !authData?.user) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado en Auth',
        detalle: authErr?.message,
      });
    }

    const authUser = authData.user;
    let perfil = null;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, email, telefono, rol_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileData) {
      perfil = profileData;
    }

    return res.status(200).json({
      ok: true,
      mensaje: 'Consulta admin',
      user: {
        id: authUser.id,
        email: authUser.email,
      },
      perfil,
      ...(profileError && { perfil_error: profileError.message }),
    });
  }

  return res.status(401).json({
    ok: false,
    mensaje: 'Autenticacion requerida',
    detalle:
      'Autenticate como admin (Authorize en Swagger: usuario y contraseña admin) e incluye ?user_id=<uuid>.',
  });
});

router.delete('/users/:user_id', async (req, res) => {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Token requerido. Usa Authorization: Bearer <access_token>.',
    });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({
      ok: false,
      mensaje: 'DELETE requiere SUPABASE_SERVICE_ROLE_KEY en el servidor',
    });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Token invalido o expirado',
      detalle: authError?.message,
    });
  }

  const actorId = authData.user.id;
  const { data: actorProfile, error: actorProfileError } = await supabaseAdmin
    .from('usuarios')
    .select('id, rol_id')
    .eq('id', actorId)
    .maybeSingle();

  if (actorProfileError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo validar el rol del usuario autenticado',
      detalle: actorProfileError.message,
    });
  }

  if (!actorProfile || !allowedDeleteRoleIds.includes(Number(actorProfile.rol_id))) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo administrador o coordinador pueden eliminar usuarios',
    });
  }

  const userId = req.params.user_id;
  const actorRol = Number(actorProfile.rol_id);

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from('usuarios')
    .select('id, rol_id')
    .eq('id', userId)
    .maybeSingle();

  if (targetError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo obtener el usuario a eliminar',
      detalle: targetError.message,
    });
  }

  if (!targetProfile) {
    return res.status(404).json({
      ok: false,
      mensaje: 'Usuario no encontrado en public.usuarios',
    });
  }

  const targetRol = Number(targetProfile.rol_id);
  const targetIsAdminOrCoordinador = [adminRoleId, coordinadorRoleId].includes(targetRol);

  if (targetIsAdminOrCoordinador && actorRol !== adminRoleId) {
    return res.status(403).json({
      ok: false,
      mensaje:
        'Solo un administrador puede eliminar usuarios con rol administrador o coordinador (rol_id 1 o 2)',
    });
  }

  const { data: deletedRows, error: deleteError } = await supabaseAdmin
    .from('usuarios')
    .delete()
    .eq('id', userId)
    .select('id, nombre, email, rol_id');

  if (deleteError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo eliminar el usuario de la tabla public.usuarios',
      detalle: deleteError.message,
    });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return res.status(404).json({
      ok: false,
      mensaje: 'Usuario no encontrado en public.usuarios',
    });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Usuario eliminado de public.usuarios',
    eliminado: deletedRows[0],
  });
});

module.exports = router;
