/**
 * Borra TODAS las filas de public.rutas (las que se ven en Activas).
 * Las opciones del botón «Crear ruta» vienen del catálogo en la app, no de esta tabla.
 *
 * Uso: node scripts/delete-rutas-semilla.js
 */
require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

async function main() {
  if (!supabaseAdmin) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const { data: todas, error: selErr } = await supabaseAdmin
    .from('rutas')
    .select('id, comunidad_nombre');

  if (selErr) {
    console.error(selErr.message);
    process.exit(1);
  }

  if (!todas?.length) {
    console.log('La tabla rutas ya está vacía.');
    return;
  }

  const ids = todas.map((r) => r.id);
  const { error: delErr } = await supabaseAdmin.from('rutas').delete().in('id', ids);

  if (delErr) {
    console.error(delErr.message);
    process.exit(1);
  }

  console.log(`Eliminadas ${ids.length} rutas:`, todas.map((r) => r.comunidad_nombre).join(', '));
  console.log('Listo. En la app haz pull-to-refresh en Activas.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
