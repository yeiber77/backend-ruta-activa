const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { extractBearerToken } = require('./bearerToken');

const AUTH_VERSION = 2;
const PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;
const profileCache = new Map();

function warmProfileCache(profile) {
  if (!profile?.id) return;
  profileCache.set(profile.id, {
    profile,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  });
}

function getCachedProfile(userId) {
  const entry = profileCache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    profileCache.delete(userId);
    return null;
  }
  return entry.profile;
}

function isNetworkError(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  const cause = error.cause;
  return (
    msg.includes('fetch failed') ||
    msg.includes('fetchfailed') ||
    msg.includes('connect timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    cause?.code === 'ECONNREFUSED' ||
    cause?.code === 'ENOTFOUND' ||
    cause?.code === 'ETIMEDOUT'
  );
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function verifyJwtSignature(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function isTokenExpired(payload) {
  if (!payload?.exp) return false;
  return payload.exp * 1000 < Date.now();
}

/**
 * Resuelve user id desde JWT sin llamar a Supabase Auth (evita timeouts de red).
 */
async function resolveUserIdFromAccessToken(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload?.sub) {
    return {
      ok: false,
      status: 401,
      mensaje: 'Token invalido o expirado',
      detalle: 'JWT mal formado',
    };
  }

  if (isTokenExpired(payload)) {
    return {
      ok: false,
      status: 401,
      mensaje: 'Token expirado',
      detalle: 'Vuelve a iniciar sesion',
    };
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret && !verifyJwtSignature(accessToken, jwtSecret)) {
    return {
      ok: false,
      status: 401,
      mensaje: 'Token invalido o expirado',
      detalle: 'Firma JWT invalida',
    };
  }

  return {
    ok: true,
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
  };
}

function mapSupabaseError(error, fallbackMensaje) {
  if (isNetworkError(error)) {
    return {
      status: 503,
      mensaje: 'No se pudo conectar con Supabase. Revisa tu conexion a internet o VPN.',
      detalle: error.message,
    };
  }
  return {
    status: 400,
    mensaje: fallbackMensaje,
    detalle: error.message,
  };
}

function createRequireRoleBearer({ roleId, actorKey, roleLabel, routePrefix }) {
  return async function requireRoleBearer(req, res, next) {
    const accessToken = extractBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({
        ok: false,
        mensaje: `Token requerido. Usa Authorization: Bearer <access_token> de un ${roleLabel}.`,
      });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({
        ok: false,
        mensaje: `Los endpoints ${routePrefix} requieren SUPABASE_SERVICE_ROLE_KEY en el servidor`,
      });
    }

    const auth = await resolveUserIdFromAccessToken(accessToken);
    if (!auth.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[auth]', routePrefix, auth.status, auth.mensaje, auth.detalle || '');
      }
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
        const { resolveUsuarioPerfil } = require('./resolveUsuarioPerfil');
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
        profileError = null;
      } else {
        const mapped = mapSupabaseError(profileError, 'No se pudo validar el perfil del usuario');
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[auth-profile]', routePrefix, mapped.status, mapped.detalle || mapped.mensaje);
        }
        return res.status(mapped.status).json({
          ok: false,
          mensaje: mapped.mensaje,
          detalle: mapped.detalle,
          auth_version: AUTH_VERSION,
        });
      }
    }

    if (profileError && profile) {
      profileError = null;
    }

    if (!profile) {
      return res.status(403).json({
        ok: false,
        mensaje: 'No hay fila en public.usuarios para este usuario',
      });
    }

    if (Number(profile.rol_id) !== roleId) {
      return res.status(403).json({
        ok: false,
        mensaje: `Solo el rol ${roleLabel} puede usar ${routePrefix}`,
      });
    }

    req[actorKey] = profile;
    res.setHeader('X-Auth-Version', String(AUTH_VERSION));
    next();
  };
}

module.exports = {
  AUTH_VERSION,
  isNetworkError,
  resolveUserIdFromAccessToken,
  createRequireRoleBearer,
  warmProfileCache,
  getCachedProfile,
  mapSupabaseError,
};
