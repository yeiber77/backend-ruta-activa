/**
 * Crea en Auth + usuarios el equipo operativo (choferes y obreros).
 * Uso: node scripts/seed-choferes-operativos.js
 * Contraseña inicial: SEED_CHOFER_PASSWORD o "Chofer2026!"
 */
require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const { EQUIPO_OPERATIVO } = require('../src/utils/equipoOperativo');

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);
const obreroRoleId = Number(process.env.ROLE_OBRERO_ID || process.env.ROL_OBRERO_ID || 6);
const defaultPassword = process.env.SEED_CHOFER_PASSWORD || 'Chofer2026!';

function rolIdForTipo(tipo) {
  return tipo === 'chofer' ? choferRoleId : obreroRoleId;
}

async function findAuthUserByEmail(email) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const found = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  return found || null;
}

function normalizeNombre(n) {
  return typeof n === 'string'
    ? n
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
    : '';
}

async function findPerfilEquipo({ nombre, email }) {
  const { data: byEmail } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, rol_id')
    .ilike('email', email)
    .maybeSingle();
  if (byEmail) return byEmail;

  const norm = normalizeNombre(nombre);
  if (!norm) return null;

  const { data: candidatos } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, rol_id');

  return (
    (candidatos || []).find((u) => normalizeNombre(u.nombre) === norm) || null
  );
}

async function ensureMiembro({ nombre, email, tipo }) {
  const rolId = rolIdForTipo(tipo);
  const perfil = await findPerfilEquipo({ nombre, email });

  if (perfil && Number(perfil.rol_id) === rolId) {
    return { accion: 'ya_existia', perfil, tipo };
  }

  if (perfil && Number(perfil.rol_id) !== rolId) {
    const { data: updated, error } = await supabaseAdmin
      .from('usuarios')
      .update({ rol_id: rolId, nombre, email })
      .eq('id', perfil.id)
      .select('id, nombre, email, rol_id')
      .maybeSingle();
    if (error) throw error;
    return { accion: 'rol_actualizado', perfil: updated, tipo };
  }

  let authUser = await findAuthUserByEmail(email);

  if (!authUser) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { nombre, tipo },
    });
    if (createErr) throw createErr;
    authUser = created.user;
  }

  const { error: insertErr } = await supabaseAdmin.from('usuarios').insert({
    id: authUser.id,
    nombre,
    email,
    telefono: null,
    rol_id: rolId,
  });

  if (insertErr && !/duplicate key|already exists/i.test(insertErr.message)) {
    throw insertErr;
  }

  const { data: row } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, rol_id')
    .eq('id', authUser.id)
    .maybeSingle();

  return { accion: 'creado', perfil: row, tipo };
}

async function ensureObreroRole() {
  const { error } = await supabaseAdmin.from('roles').upsert(
    { id: obreroRoleId, nombre: 'Obrero' },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

async function main() {
  if (!supabaseAdmin) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  await ensureObreroRole();

  const resultados = [];
  for (const m of EQUIPO_OPERATIVO) {
    const r = await ensureMiembro(m);
    resultados.push({ ...m, ...r });
  }

  console.log(
    JSON.stringify(
      {
        equipo: resultados,
        total: resultados.length,
        choferes: resultados.filter((r) => r.tipo === 'chofer').length,
        obreros: resultados.filter((r) => r.tipo === 'obrero').length,
        password_inicial: defaultPassword,
        roles: { chofer: choferRoleId, obrero: obreroRoleId },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
