const { supabaseAdmin } = require('../config/supabase');
const {
  AUTH_VERSION,
  getCachedProfile,
  mapSupabaseError,
  resolveUserIdFromAccessToken,
  warmProfileCache,
} = require('../utils/verifyAccessToken');
const { extractBearerToken } = require('../utils/bearerToken');

async function requireUserBearer(req, res, next) {
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
      mensaje: 'Los endpoints autenticados requieren SUPABASE_SERVICE_ROLE_KEY en el servidor',
    });
  }

  const auth = await resolveUserIdFromAccessToken(accessToken);
  if (!auth.ok) {
    return res.status(auth.status).json({
      ok: false,
      mensaje: auth.mensaje,
      ...(auth.detalle && { detalle: auth.detalle }),
      auth_version: AUTH_VERSION,
    });
  }

  let profile = getCachedProfile(auth.userId);
  let profileError = null;

  if (!profile) {
    try {
      const { resolveUsuarioPerfil } = require('../utils/resolveUsuarioPerfil');
      const resolved = await resolveUsuarioPerfil(auth.userId, auth.email);
      profile = resolved.perfil;
      profileError = resolved.error;
      if (profile) warmProfileCache(profile);
    } catch (err) {
      profileError = err;
    }
  }

  if (profileError && !profile) {
    const cached = getCachedProfile(auth.userId);
    if (cached) {
      profile = cached;
    } else {
      const mapped = mapSupabaseError(profileError, 'No se pudo validar el perfil del usuario');
      return res.status(mapped.status).json({
        ok: false,
        mensaje: mapped.mensaje,
        detalle: mapped.detalle,
        auth_version: AUTH_VERSION,
      });
    }
  }

  if (!profile) {
    return res.status(403).json({
      ok: false,
      mensaje: 'No hay fila en public.usuarios para este usuario',
    });
  }

  req.userActor = profile;
  res.setHeader('X-Auth-Version', String(AUTH_VERSION));
  next();
}

module.exports = requireUserBearer;
