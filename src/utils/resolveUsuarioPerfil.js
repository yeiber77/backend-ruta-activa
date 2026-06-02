const { supabaseAdmin } = require('../config/supabase');
const { warmProfileCache } = require('./verifyAccessToken');

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Busca perfil por id de Auth; si no existe, enlaza por email (id distinto en usuarios).
 */
async function resolveUsuarioPerfil(authUserId, authEmail) {
  if (!supabaseAdmin || !authUserId) {
    return { perfil: null, error: null };
  }

  const selectCols = 'id, nombre, email, telefono, rol_id';

  const { data: byId, error: byIdErr } = await supabaseAdmin
    .from('usuarios')
    .select(selectCols)
    .eq('id', authUserId)
    .maybeSingle();

  if (byId) {
    warmProfileCache(byId);
    return { perfil: byId, error: null };
  }

  const email = normalizeEmail(authEmail);
  if (!email) {
    return { perfil: null, error: byIdErr };
  }

  const { data: byEmail, error: byEmailErr } = await supabaseAdmin
    .from('usuarios')
    .select(selectCols)
    .ilike('email', email)
    .maybeSingle();

  if (!byEmail) {
    return { perfil: null, error: byIdErr || byEmailErr };
  }

  if (byEmail.id === authUserId) {
    warmProfileCache(byEmail);
    return { perfil: byEmail, error: null };
  }

  const linked = await linkUsuarioPerfilToAuthId(byEmail, authUserId, email);
  if (linked.perfil) {
    warmProfileCache(linked.perfil);
  }
  return linked;
}

async function linkUsuarioPerfilToAuthId(oldProfile, authUserId, normalizedEmail) {
  const oldId = oldProfile.id;

  const { error: insertErr } = await supabaseAdmin.from('usuarios').insert({
    id: authUserId,
    nombre: oldProfile.nombre,
    email: normalizedEmail || oldProfile.email,
    telefono: oldProfile.telefono,
    rol_id: oldProfile.rol_id,
  });

  if (insertErr && !/duplicate key|already exists/i.test(insertErr.message)) {
    return { perfil: null, error: insertErr };
  }

  const fkUpdates = [
    { table: 'rutas', columns: ['coordinador_id', 'chofer_id', 'representante_id'] },
    { table: 'estado_broadcasts', columns: ['coordinador_id', 'chofer_origen_id'] },
    { table: 'estado_confirmaciones', columns: ['chofer_id'] },
    { table: 'despidos_choferes', columns: ['chofer_id'] },
    { table: 'ia_consultas', columns: ['usuario_id'] },
    { table: 'denuncias', columns: ['usuario_id'] },
    { table: 'comentarios', columns: ['usuario_id'] },
  ];

  for (const { table, columns } of fkUpdates) {
    for (const column of columns) {
      const { error } = await supabaseAdmin
        .from(table)
        .update({ [column]: authUserId })
        .eq(column, oldId);
      if (error && !/Could not find the table|schema cache/i.test(error.message)) {
        await supabaseAdmin.from('usuarios').delete().eq('id', authUserId);
        return { perfil: null, error };
      }
    }
  }

  const { error: deleteErr } = await supabaseAdmin.from('usuarios').delete().eq('id', oldId);
  if (deleteErr) {
    return { perfil: null, error: deleteErr };
  }

  const perfil = {
    id: authUserId,
    nombre: oldProfile.nombre,
    email: normalizedEmail || oldProfile.email,
    telefono: oldProfile.telefono,
    rol_id: oldProfile.rol_id,
  };

  return { perfil, error: null, vinculado: true };
}

module.exports = {
  resolveUsuarioPerfil,
  linkUsuarioPerfilToAuthId,
  normalizeEmail,
};
