const { supabase, supabaseAdmin } = require('../config/supabase');
const { extractBearerToken } = require('../utils/bearerToken');

const adminRoleId = Number(process.env.ROLE_ADMIN_ID || process.env.ROL_ADMIN_ID || 1);

async function requireAdminBearer(req, res, next) {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Token requerido. Usa Authorization: Bearer <access_token> de un administrador.',
    });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({
      ok: false,
      mensaje: 'Los endpoints /api/admin requieren SUPABASE_SERVICE_ROLE_KEY en el servidor',
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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('usuarios')
    .select('id, rol_id, nombre, email')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo validar el perfil del usuario',
      detalle: profileError.message,
    });
  }

  if (!profile) {
    return res.status(403).json({
      ok: false,
      mensaje: 'No hay fila en public.usuarios para este usuario',
    });
  }

  if (Number(profile.rol_id) !== adminRoleId) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo el rol Administrador puede usar /api/admin',
    });
  }

  req.adminActor = profile;
  next();
}

module.exports = requireAdminBearer;
