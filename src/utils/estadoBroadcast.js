const { supabaseAdmin } = require('../config/supabase');

const ESTADOS_VALIDOS = new Set(['activo', 'finalizado']);

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);

const SQL_ESTADO_TABLAS =
  'Ejecuta backend-ruta-activa-main/sql/estado_broadcasts.sql en el SQL Editor de Supabase (una sola vez).';

function throwSupabaseError(error) {
  if (
    error?.code === 'PGRST205' ||
    (typeof error?.message === 'string' &&
      (error.message.includes('estado_broadcasts') ||
        error.message.includes('estado_confirmaciones')))
  ) {
    throw new Error(`Faltan tablas de estado en Supabase. ${SQL_ESTADO_TABLAS}`);
  }
  throw new Error(error?.message || 'Error de base de datos');
}

function isEstadoValido(estado) {
  return typeof estado === 'string' && ESTADOS_VALIDOS.has(estado.trim().toLowerCase());
}

function mensajeCoordinador(estado, nombreCoord) {
  const quien = nombreCoord?.trim() || 'El coordinador';
  if (estado === 'activo') {
    return `${quien} indicó que el servicio está ACTIVO. Confirma con el check.`;
  }
  return `${quien} indicó que el servicio está FINALIZADO. Confirma con el check.`;
}

function mensajeChoferFinalizado(nombreChofer) {
  const quien = nombreChofer?.trim() || 'Un chofer';
  return `${quien} indicó FINALIZADO (sin esperar al coordinador).`;
}

function mapBroadcastRow(row, confirmaciones = []) {
  if (!row) return null;
  return {
    id: row.id,
    estado: row.estado,
    mensaje: row.mensaje,
    origen: row.origen,
    coordinador_id: row.coordinador_id,
    chofer_origen_id: row.chofer_origen_id,
    creado_en: row.creado_en,
    confirmaciones,
    total_confirmaciones: confirmaciones.length,
  };
}

async function listarChoferesIds() {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email')
    .eq('rol_id', choferRoleId);

  if (error) {
    throwSupabaseError(error);
  }
  return data || [];
}

async function fetchConfirmacionesPorBroadcastIds(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from('estado_confirmaciones')
    .select('id, broadcast_id, chofer_id, confirmado, confirmado_en')
    .in('broadcast_id', ids);

  if (error) {
    throwSupabaseError(error);
  }

  const map = new Map();
  for (const row of data || []) {
    const list = map.get(row.broadcast_id) || [];
    list.push(row);
    map.set(row.broadcast_id, list);
  }
  return map;
}

async function listarBroadcastsRecientes(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from('estado_broadcasts')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limit);

  if (error) {
    throwSupabaseError(error);
  }

  const rows = data || [];
  const confMap = await fetchConfirmacionesPorBroadcastIds(rows.map((r) => r.id));
  return rows.map((row) => mapBroadcastRow(row, confMap.get(row.id) || []));
}

async function crearBroadcastCoordinador(coordinador, estado) {
  const estadoNorm = estado.trim().toLowerCase();
  const mensaje = mensajeCoordinador(estadoNorm, coordinador.nombre);

  const { data, error } = await supabaseAdmin
    .from('estado_broadcasts')
    .insert({
      coordinador_id: coordinador.id,
      estado: estadoNorm,
      mensaje,
      origen: 'coordinador',
    })
    .select('*')
    .maybeSingle();

  if (error) {
    throwSupabaseError(error);
  }

  return mapBroadcastRow(data, []);
}

async function crearBroadcastChoferFinalizado(chofer) {
  const { data: ultimoCoord, error: ultimoErr } = await supabaseAdmin
    .from('estado_broadcasts')
    .select('estado, origen')
    .eq('origen', 'coordinador')
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimoErr) {
    throwSupabaseError(ultimoErr);
  }
  if (ultimoCoord?.estado === 'finalizado') {
    const err = new Error('El coordinador ya indicó FINALIZADO');
    err.status = 409;
    throw err;
  }

  const mensaje = mensajeChoferFinalizado(chofer.nombre);

  const { data, error } = await supabaseAdmin
    .from('estado_broadcasts')
    .insert({
      coordinador_id: null,
      estado: 'finalizado',
      mensaje,
      origen: 'chofer',
      chofer_origen_id: chofer.id,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    throwSupabaseError(error);
  }

  const { error: confErr } = await supabaseAdmin.from('estado_confirmaciones').insert({
    broadcast_id: data.id,
    chofer_id: chofer.id,
    confirmado: true,
  });

  if (confErr) {
    throwSupabaseError(confErr);
  }

  return mapBroadcastRow(data, [
    {
      broadcast_id: data.id,
      chofer_id: chofer.id,
      confirmado: true,
    },
  ]);
}

async function confirmarBroadcast(broadcastId, choferId) {
  const { data: broadcast, error: readErr } = await supabaseAdmin
    .from('estado_broadcasts')
    .select('*')
    .eq('id', broadcastId)
    .maybeSingle();

  if (readErr) {
    throwSupabaseError(readErr);
  }
  if (!broadcast) {
    return { ok: false, status: 404, mensaje: 'Notificación no encontrada' };
  }
  if (broadcast.origen !== 'coordinador') {
    return { ok: false, status: 400, mensaje: 'Solo puedes confirmar estados enviados por el coordinador' };
  }

  const { data, error } = await supabaseAdmin
    .from('estado_confirmaciones')
    .upsert(
      {
        broadcast_id: broadcastId,
        chofer_id: choferId,
        confirmado: true,
        confirmado_en: new Date().toISOString(),
      },
      { onConflict: 'broadcast_id,chofer_id' }
    )
    .select('*')
    .maybeSingle();

  if (error) {
    throwSupabaseError(error);
  }

  return {
    ok: true,
    mensaje: 'Confirmación registrada',
    broadcast: mapBroadcastRow(broadcast, [data]),
    confirmacion: data,
  };
}

async function listarNotificacionesChofer(choferId, limit = 30) {
  const broadcasts = await listarBroadcastsRecientes(limit);
  const choferBroadcastIds = new Set(
    broadcasts.filter((b) => b.origen === 'chofer' && b.chofer_origen_id === choferId).map((b) => b.id)
  );

  return broadcasts
    .filter((b) => b.origen === 'coordinador' || choferBroadcastIds.has(b.id))
    .map((b) => {
      const yaConfirmo = (b.confirmaciones || []).some((c) => c.chofer_id === choferId);
      return {
        ...b,
        pendiente: b.origen === 'coordinador' && !yaConfirmo,
        confirmado_por_mi: yaConfirmo,
      };
    });
}

async function contarPendientesChofer(choferId) {
  const list = await listarNotificacionesChofer(choferId, 20);
  return list.filter((n) => n.pendiente).length;
}

module.exports = {
  ESTADOS_VALIDOS,
  isEstadoValido,
  listarBroadcastsRecientes,
  crearBroadcastCoordinador,
  crearBroadcastChoferFinalizado,
  confirmarBroadcast,
  listarNotificacionesChofer,
  contarPendientesChofer,
};
