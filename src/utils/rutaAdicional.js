const { tieneColumnaAdicional, mensajeMigracionAdicional } = require('./rutaAdicionalSchema');

function parseAdicional(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'si') {
    return true;
  }
  if (s === 'false' || s === '0' || s === 'no') {
    return false;
  }
  return defaultValue;
}

async function listarRutasAdicionales(query, limit = 200) {
  const existe = await tieneColumnaAdicional();
  if (!existe) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        rutas: [],
        total: 0,
        aviso: mensajeMigracionAdicional(),
      },
    };
  }

  const capped = Math.min(Number(limit) || 200, 500);
  const { data, error } = await query
    .eq('adicional', true)
    .order('id', { ascending: false })
    .limit(capped);

  if (error) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        mensaje: 'No se pudo listar rutas adicionales',
        detalle: error.message,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      rutas: data || [],
      total: (data || []).length,
    },
  };
}

module.exports = {
  parseAdicional,
  listarRutasAdicionales,
};
