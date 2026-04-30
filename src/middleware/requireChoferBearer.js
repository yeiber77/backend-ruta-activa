const { supabase, supabaseAdmin } = require('../config/supabase');
const { extractBearerToken } = require('../utils/bearerToken');

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);

async function requireChoferBearer(req, res, next) {
  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Token requerido. Usa Authorization: Bearer <access_token> de un chofer.',
    });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({
      ok: false,
      mensaje: 'Los endpoints /api/chofer requieren SUPABASE_SERVICE_ROLE_KEY en el servidor',
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

  if (Number(profile.rol_id) !== choferRoleId) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Solo el rol Chofer puede usar /api/chofer',
    });
  }

  req.choferActor = profile;
  next();
}

module.exports = requireChoferBearer;
