/**
 * NO USAR para llenar la lista «Activas».
 * Esas comunidades solo deben elegirse en la app con «Crear ruta» (catálogo en el modal).
 *
 * Si ya corriste este script y ves rutas de más en Activas:
 *   node scripts/delete-rutas-semilla.js
 *
 * (Este script inserta en public.rutas — solo para pruebas puntuales.)
 * Uso: node scripts/seed-rutas-horarios.js
 */
require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const { HORARIOS_RUTAS_DEFAULT } = require('../src/utils/horariosRutasDefault');
const { prepararPayloadRuta } = require('../src/utils/rutaAdicionalSchema');
const { prepararPayloadRutaVisible } = require('../src/utils/rutaVisibleListaSchema');

const COORDINADOR_EMAIL =
  process.env.SEED_COORDINADOR_EMAIL || 'nelsoncasaravenida@gmail.com';

function zonasUnicas() {
  const seen = new Set();
  const out = [];
  for (const dia of HORARIOS_RUTAS_DEFAULT) {
    for (const z of dia.zonas || []) {
      const nombre = String(z).trim();
      if (!nombre) continue;
      const key = nombre.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(nombre);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}

async function main() {
  if (!supabaseAdmin) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }

  const { data: coord, error: coordErr } = await supabaseAdmin
    .from('usuarios')
    .select('id, email')
    .ilike('email', COORDINADOR_EMAIL)
    .eq('rol_id', 2)
    .maybeSingle();

  if (coordErr || !coord) {
    console.error('No se encontró coordinador:', COORDINADOR_EMAIL, coordErr?.message);
    process.exit(1);
  }

  const { data: existentes } = await supabaseAdmin
    .from('rutas')
    .select('comunidad_nombre');

  const ya = new Set(
    (existentes || []).map((r) => String(r.comunidad_nombre || '').trim().toLowerCase())
  );

  const zonas = zonasUnicas();
  let insertadas = 0;
  let omitidas = 0;

  for (const comunidad_nombre of zonas) {
    if (ya.has(comunidad_nombre.toLowerCase())) {
      omitidas += 1;
      continue;
    }

    let payload = await prepararPayloadRuta({
      comunidad_nombre,
      chofer_id: null,
      representante_id: null,
      coordinador_id: coord.id,
      estado: 'Pendiente',
      adicional: false,
    });
    payload = await prepararPayloadRutaVisible(payload, false);

    const { error } = await supabaseAdmin.from('rutas').insert(payload);
    if (error) {
      console.error('Error insertando', comunidad_nombre, error.message);
      process.exit(1);
    }
    insertadas += 1;
    ya.add(comunidad_nombre.toLowerCase());
  }

  const { count } = await supabaseAdmin
    .from('rutas')
    .select('id', { count: 'exact', head: true });

  console.log(
    JSON.stringify(
      {
        coordinador: coord.email,
        zonas_programa: zonas.length,
        insertadas,
        omitidas_duplicado: omitidas,
        total_rutas_tabla: count,
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
