const ESTADO_HISTORIAL = 'Completada';

function historialResponse(data, error, mensajeError) {
  if (error) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        mensaje: mensajeError,
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

async function listarRutasHistorial(query, limit = 200) {
  const capped = Math.min(Number(limit) || 200, 500);
  const { data, error } = await query
    .eq('estado', ESTADO_HISTORIAL)
    .order('finalizado_en', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(capped);

  return historialResponse(data, error, 'No se pudo listar el historial de rutas');
}

module.exports = {
  ESTADO_HISTORIAL,
  listarRutasHistorial,
};
