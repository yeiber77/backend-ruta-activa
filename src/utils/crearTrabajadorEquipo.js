const { supabaseAdmin } = require('../config/supabase');
const { emailFromNombre } = require('./equipoOperativo');

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);
const obreroRoleId = Number(process.env.ROLE_OBRERO_ID || process.env.ROL_OBRERO_ID || 6);
const defaultPassword = process.env.SEED_CHOFER_PASSWORD || 'Chofer2026!';

function rolIdFromTipo(tipo) {
  const t = typeof tipo === 'string' ? tipo.trim().toLowerCase() : '';
  if (t === 'chofer') return choferRoleId;
  if (t === 'obrero') return obreroRoleId;
  return null;
}

async function findAuthUserByEmail(email) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Crea usuario Auth + fila en usuarios (chofer u obrero).
 */
async function crearTrabajadorEquipo({ nombre, email, telefono, tipo, password }) {
  const rolId = rolIdFromTipo(tipo);
  if (!rolId) {
    return { ok: false, status: 400, mensaje: 'tipo debe ser "chofer" u "obrero"' };
  }

  const nombreTrim = typeof nombre === 'string' ? nombre.trim() : '';
  let emailTrim = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!nombreTrim) {
    return { ok: false, status: 400, mensaje: 'nombre es obligatorio' };
  }
  if (!emailTrim) {
    emailTrim = emailFromNombre(nombreTrim);
  }

  const { data: existente } = await supabaseAdmin
    .from('usuarios')
    .select('id, email')
    .ilike('email', emailTrim)
    .maybeSingle();

  if (existente) {
    return {
      ok: false,
      status: 400,
      mensaje: 'Ya existe un usuario con ese correo',
    };
  }

  const pass = typeof password === 'string' && password.length >= 6 ? password : defaultPassword;

  let authUser = await findAuthUserByEmail(emailTrim);
  if (!authUser) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailTrim,
      password: pass,
      email_confirm: true,
      user_metadata: { nombre: nombreTrim, tipo },
    });
    if (createErr) {
      return { ok: false, status: 400, mensaje: 'No se pudo crear en Auth', detalle: createErr.message };
    }
    authUser = created.user;
  }

  const { data: perfil, error: insertErr } = await supabaseAdmin
    .from('usuarios')
    .insert({
      id: authUser.id,
      nombre: nombreTrim,
      email: emailTrim,
      telefono: telefono?.trim() || null,
      rol_id: rolId,
    })
    .select('id, nombre, email, telefono, rol_id')
    .maybeSingle();

  if (insertErr && !/duplicate key|already exists/i.test(insertErr.message)) {
    return {
      ok: false,
      status: 400,
      mensaje: 'No se pudo crear el perfil',
      detalle: insertErr.message,
    };
  }

  if (!perfil) {
    const { data: row } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, email, telefono, rol_id')
      .eq('id', authUser.id)
      .maybeSingle();
    return { ok: true, perfil: row, password_inicial: pass };
  }

  return { ok: true, perfil, password_inicial: pass };
}

module.exports = {
  crearTrabajadorEquipo,
  rolIdFromTipo,
  choferRoleId,
  obreroRoleId,
  defaultPassword,
};
