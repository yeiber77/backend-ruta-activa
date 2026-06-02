/**
 * Marca las rutas del catálogo como NO visibles en Activas (visible_lista = false).
 * Siguen en Supabase; solo aparecen al elegirlas en «Crear ruta».
 *
 * Antes ejecuta sql/rutas_visible_lista.sql en Supabase.
 * Uso: node scripts/ocultar-rutas-catalogo-lista.js
 */
require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const { listarComunidadesCatalogo } = require('../src/utils/comunidadesCatalogo');
const { tieneColumnaVisibleLista } = require('../src/utils/rutaVisibleListaSchema');

async function main() {
  if (!supabaseAdmin) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!(await tieneColumnaVisibleLista(true))) {
    console.error('Ejecuta primero: sql/rutas_visible_lista.sql en Supabase SQL Editor');
    process.exit(1);
  }

  const nombres = listarComunidadesCatalogo();
  let actualizadas = 0;

  for (const nombre of nombres) {
    const { data, error } = await supabaseAdmin
      .from('rutas')
      .update({ visible_lista: false })
      .ilike('comunidad_nombre', nombre)
      .select('id');

    if (error) {
      console.error(nombre, error.message);
      process.exit(1);
    }
    actualizadas += data?.length ?? 0;
  }

  console.log(
    JSON.stringify(
      {
        comunidades_catalogo: nombres.length,
        filas_actualizadas: actualizadas,
        mensaje: 'Esas rutas ya no salen en Activas hasta crearlas desde la app.',
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
