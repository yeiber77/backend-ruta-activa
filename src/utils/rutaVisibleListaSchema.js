const { supabaseAdmin } = require('../config/supabase');

const SQL_MIGRACION = 'backend-ruta-activa-main/sql/rutas_visible_lista.sql';

let columnaVisibleListaExiste = null;
let verificadoEn = 0;
const CACHE_MS = 60_000;

function errorColumnaVisibleListaFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('visible_lista') &&
    (msg.includes('column') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      msg.includes('could not find'))
  );
}

async function tieneColumnaVisibleLista(force = false) {
  if (!force && columnaVisibleListaExiste !== null && Date.now() - verificadoEn < CACHE_MS) {
    return columnaVisibleListaExiste;
  }

  const { error } = await supabaseAdmin.from('rutas').select('visible_lista').limit(1);

  if (!error) {
    columnaVisibleListaExiste = true;
  } else if (errorColumnaVisibleListaFaltante(error)) {
    columnaVisibleListaExiste = false;
  } else {
    columnaVisibleListaExiste = false;
  }

  verificadoEn = Date.now();
  return columnaVisibleListaExiste;
}

/** Solo rutas que el coordinador publicó en la lista (no plantilla del catálogo). */
function aplicarFiltroVisibleLista(query, columnaExiste) {
  if (!columnaExiste) {
    return query;
  }
  return query.eq('visible_lista', true);
}

async function prepararPayloadRutaVisible(payload, visibleEnLista) {
  const existe = await tieneColumnaVisibleLista();
  if (!existe) return payload;
  return { ...payload, visible_lista: visibleEnLista };
}

function mensajeMigracionVisibleLista() {
  return `Falta la columna rutas.visible_lista. Ejecuta en Supabase: ${SQL_MIGRACION}`;
}

/** Síncrono: no hacer await del query builder (Supabase lo ejecutaría). */
function aplicarFiltroVisibleListaEnQuery(baseQuery, columnaExiste) {
  return aplicarFiltroVisibleLista(baseQuery, columnaExiste);
}

module.exports = {
  SQL_MIGRACION,
  tieneColumnaVisibleLista,
  aplicarFiltroVisibleLista,
  prepararPayloadRutaVisible,
  errorColumnaVisibleListaFaltante,
  mensajeMigracionVisibleLista,
  aplicarFiltroVisibleListaEnQuery,
};
