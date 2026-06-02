const { HORARIOS_RUTAS_DEFAULT } = require('./horariosRutasDefault');

function listarComunidadesCatalogo() {
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

module.exports = { listarComunidadesCatalogo };
