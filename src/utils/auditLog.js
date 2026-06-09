const { supabaseAdmin } = require('../config/supabase');

const SQL_AUDIT = 'backend-ruta-activa-main/sql/audit_log.sql';

const ACTOR_KEYS = [
  'adminActor',
  'coordinadorActor',
  'choferActor',
  'supervisorActor',
  'representanteActor',
  'userActor',
];

function actorDesdeReq(req) {
  if (!req) return null;
  for (const key of ACTOR_KEYS) {
    if (req[key]?.id) return req[key];
  }
  return null;
}

function sanitizarPayload(value) {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { raw: String(value) };
  }
}

function errorTablaAuditFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('audit_log') &&
    (msg.includes('could not find the table') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist'))
  );
}

/**
 * Registra un evento en audit_log (fire-and-forget; no lanza si falla).
 */
async function registrarEvento({
  req,
  actor: actorOverride,
  eventType,
  entityType = null,
  entityId = null,
  accion,
  resumen,
  antes = null,
  despues = null,
  metadata = null,
}) {
  const actor = actorOverride || actorDesdeReq(req);
  const row = {
    actor_id: actor?.id ?? null,
    actor_rol_id: actor?.rol_id != null ? Number(actor.rol_id) : null,
    actor_nombre: actor?.nombre ?? null,
    actor_email: actor?.email ?? null,
    event_type: String(eventType || 'other'),
    entity_type: entityType != null ? String(entityType) : null,
    entity_id: entityId != null ? String(entityId) : null,
    accion: String(accion || 'other'),
    resumen: String(resumen || eventType || 'Evento registrado'),
    payload_antes: sanitizarPayload(antes),
    payload_despues: sanitizarPayload(despues),
    metadata: sanitizarPayload({
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      ...(req?.method && { http_method: req.method }),
      ...(req?.originalUrl && { http_path: req.originalUrl }),
    }),
  };

  try {
    const { error } = await supabaseAdmin.from('audit_log').insert(row);
    if (error) {
      if (errorTablaAuditFaltante(error)) {
        console.warn(`[audit] Falta tabla audit_log. Ejecuta: ${SQL_AUDIT}`);
      } else {
        console.warn('[audit] No se pudo registrar evento:', error.message, eventType);
      }
    }
  } catch (e) {
    console.warn('[audit] Error inesperado:', e?.message || e);
  }
}

module.exports = {
  SQL_AUDIT,
  actorDesdeReq,
  errorTablaAuditFaltante,
  registrarEvento,
};
