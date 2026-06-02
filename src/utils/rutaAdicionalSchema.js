const { supabaseAdmin } = require('../config/supabase');

const SQL_MIGRACION = 'backend-ruta-activa-main/sql/rutas_adicional.sql';

let columnaAdicionalExiste = null;
let verificadoEn = 0;
const CACHE_MS = 60_000;

function errorColumnaAdicionalFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('adicional') &&
    (msg.includes('column') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache') ||
      msg.includes('could not find'))
  );
}

async function tieneColumnaAdicional(force = false) {
  if (!force && columnaAdicionalExiste !== null && Date.now() - verificadoEn < CACHE_MS) {
    return columnaAdicionalExiste;
  }

  const { error } = await supabaseAdmin.from('rutas').select('adicional').limit(1);

  if (!error) {
    columnaAdicionalExiste = true;
  } else if (errorColumnaAdicionalFaltante(error)) {
    columnaAdicionalExiste = false;
  } else {
    columnaAdicionalExiste = false;
  }

  verificadoEn = Date.now();
  return columnaAdicionalExiste;
}

/** Síncrono: no usar async/await con el query builder (Supabase lo ejecuta si se hace await). */
function aplicarFiltroAdicional(query, valor, columnaExiste) {
  if (!columnaExiste) {
    return query;
  }
  return query.eq('adicional', valor);
}

function omitirAdicionalEnPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = { ...payload };
  delete copy.adicional;
  return copy;
}

async function prepararPayloadRuta(payload) {
  const existe = await tieneColumnaAdicional();
  if (existe) return payload;
  return omitirAdicionalEnPayload(payload);
}

function mensajeMigracionAdicional() {
  return `Falta la columna rutas.adicional. Ejecuta en Supabase SQL Editor: ${SQL_MIGRACION}`;
}

module.exports = {
  SQL_MIGRACION,
  tieneColumnaAdicional,
  aplicarFiltroAdicional,
  prepararPayloadRuta,
  omitirAdicionalEnPayload,
  errorColumnaAdicionalFaltante,
  mensajeMigracionAdicional,
};
