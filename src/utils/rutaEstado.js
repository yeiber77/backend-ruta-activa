/** Estados permitidos en public.rutas para el flujo actual (chofer y validaciones). */
const ESTADOS_RUTA = Object.freeze(['Pendiente', 'En Proceso', 'Completada']);
const ESTADOS_RUTA_SET = new Set(ESTADOS_RUTA);

/** Estados que el chofer puede asignar en PATCH (no Completada: solo supervisor). */
const ESTADOS_CHOFER = Object.freeze(['Pendiente', 'En Proceso']);
const ESTADOS_CHOFER_SET = new Set(ESTADOS_CHOFER);

function isEstadoRutaPermitido(canonical) {
  return ESTADOS_RUTA_SET.has(canonical);
}

function isEstadoChoferPermitido(canonical) {
  return ESTADOS_CHOFER_SET.has(canonical);
}

/**
 * Normaliza texto de estado a valores canonicos usados en public.rutas.
 * Valores desconocidos se devuelven con trim (primera letra mayuscula por palabra aproximada).
 */
function normalizeEstado(raw) {
  if (raw == null) {
    return 'Pendiente';
  }
  const s = String(raw).trim();
  if (s === '') {
    return 'Pendiente';
  }
  const key = s.toLowerCase().replace(/\s+/g, ' ');
  const map = {
    pendiente: 'Pendiente',
    'en proceso': 'En Proceso',
    enproceso: 'En Proceso',
    'en-proceso': 'En Proceso',
    completada: 'Completada',
    completado: 'Completada',
  };
  if (map[key]) {
    return map[key];
  }
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = {
  normalizeEstado,
  isEstadoRutaPermitido,
  isEstadoChoferPermitido,
  ESTADOS_RUTA,
  ESTADOS_CHOFER,
};
