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
  let profileError = null;
  let perfilVinculado = false;

  if (supabaseAdmin) {
    const { resolveUsuarioPerfil } = require('../utils/resolveUsuarioPerfil');
    const resolved = await resolveUsuarioPerfil(authUser.id, authUser.email);
    perfil = resolved.perfil;
    profileError = resolved.error;
    perfilVinculado = Boolean(resolved.vinculado);
  } else {
    const profileClient = createUserScopedClient(data.session.access_token);
    const { data: profileData, error: err } = await profileClient
      .from('usuarios')
      .select('id, nombre, email, telefono, rol_id')
      .eq('id', authUser.id)
      .maybeSingle();
    perfil = profileData;
    profileError = err;
    if (profileData) {
      try {
        const { warmProfileCache } = require('../utils/verifyAccessToken');
        warmProfileCache(profileData);
      } catch {
        /* noop */
      }
    }
  }

  return res.status(200).json({
    ok: true,
    mensaje: perfilVinculado
      ? 'Login correcto. Perfil vinculado al usuario de Auth.'
      : 'Login correcto',
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

function passwordResetRedirectUrl() {
  return (
    process.env.PASSWORD_RESET_REDIRECT_URL ||
    process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL ||
    'rutaactivamobile://nueva-contrasena'
  );
}

/** Respuesta amigable cuando Supabase bloquea envíos de correo (pruebas repetidas). */
function respuestaErrorEnvioCorreoAuth(error, contexto) {
  const msg = (error?.message || '').toLowerCase();
  const esRateLimit =
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    error?.status === 429;

  if (esRateLimit) {
    return {
      status: 429,
      body: {
        ok: false,
        mensaje:
          'Supabase limitó los correos por demasiados intentos. Espera unos 60 minutos y vuelve a intentar, o cambia la contraseña desde el panel de Supabase (Authentication → Users).',
        codigo: 'email_rate_limit',
        reintentar_en_minutos: 60,
      },
    };
  }

  return {
    status: 400,
    body: {
      ok: false,
      mensaje: contexto,
      detalle: error?.message,
    },
  };
}

router.post('/recuperar-contrasena', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!email) {
    return res.status(400).json({ ok: false, mensaje: 'email es obligatorio' });
  }

  const redirectTo = passwordResetRedirectUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    const r = respuestaErrorEnvioCorreoAuth(error, 'No se pudo enviar el correo de recuperación');
    return res.status(r.status).json(r.body);
  }

  return res.status(200).json({
    ok: true,
    mensaje:
      'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también spam.',
    redirect_configurado: redirectTo,
  });
});

router.post('/nueva-contrasena', async (req, res) => {
  let accessToken =
    typeof req.body?.access_token === 'string' ? req.body.access_token.trim() : '';
  let refreshToken =
    typeof req.body?.refresh_token === 'string' ? req.body.refresh_token.trim() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const tokenHash = typeof req.body?.token_hash === 'string' ? req.body.token_hash.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!password || password.length < 6) {
    return res.status(400).json({
      ok: false,
      mensaje: 'password es obligatorio y debe tener al menos 6 caracteres',
    });
  }

  if (code && !accessToken) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data?.session) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Enlace inválido o expirado. Solicita un correo nuevo.',
        detalle: error?.message,
      });
    }
    accessToken = data.session.access_token;
    refreshToken = data.session.refresh_token;
  }

  if (tokenHash && !accessToken) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });
    if (error || !data?.session) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Enlace inválido o expirado. Solicita un correo nuevo.',
        detalle: error?.message,
      });
    }
    accessToken = data.session.access_token;
    refreshToken = data.session.refresh_token;
  }

  if (!accessToken) {
    return res.status(400).json({
      ok: false,
      mensaje:
        'Abre el enlace del correo en este teléfono (no entres manualmente a esta pantalla). Si ya lo abriste, solicita otro enlace.',
    });
  }

  const recoveryClient = createUserScopedClient(accessToken);

  if (refreshToken) {
    const { error: sessionErr } = await recoveryClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionErr) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Enlace inválido o expirado',
        detalle: sessionErr.message,
      });
    }
  }

  const { error: updateErr } = await recoveryClient.auth.updateUser({ password });

  if (updateErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo actualizar la contraseña',
      detalle: updateErr.message,
    });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.',
  });
});

/** Código de 6 dígitos por correo (sin deep link; ideal emulador Android). */
router.post('/recuperar-contrasena-codigo', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!email) {
    return res.status(400).json({ ok: false, mensaje: 'email es obligatorio' });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    const r = respuestaErrorEnvioCorreoAuth(error, 'No se pudo enviar el código');
    return res.status(r.status).json(r.body);
  }

  return res.status(200).json({
    ok: true,
    mensaje:
      'Si el correo está registrado, recibirás un código de 6 dígitos. Ábrelo en el PC u otro teléfono y escríbelo aquí (no hace falta abrir ningún enlace).',
  });
});

router.post('/nueva-contrasena-codigo', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const codigo =
    typeof req.body?.codigo === 'string'
      ? req.body.codigo.trim().replace(/\s/g, '')
      : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !codigo) {
    return res.status(400).json({
      ok: false,
      mensaje: 'email y codigo son obligatorios',
    });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({
      ok: false,
      mensaje: 'password es obligatorio y debe tener al menos 6 caracteres',
    });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: codigo,
    type: 'email',
  });

  if (error || !data?.session) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Código incorrecto o expirado. Solicita uno nuevo.',
      detalle: error?.message,
    });
  }

  const recoveryClient = createUserScopedClient(data.session.access_token);
  const { error: sessionErr } = await recoveryClient.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  if (sessionErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo validar el código',
      detalle: sessionErr.message,
    });
  }

  const { error: updateErr } = await recoveryClient.auth.updateUser({ password });

  if (updateErr) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo actualizar la contraseña',
      detalle: updateErr.message,
    });
  }

  return res.status(200).json({
    ok: true,
    mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.',
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
