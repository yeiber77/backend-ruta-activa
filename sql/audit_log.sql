-- Historial permanente de acciones en la app (solo lectura admin vía API).
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  actor_id UUID,
  actor_rol_id INTEGER,
  actor_nombre TEXT,
  actor_email TEXT,

  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  accion TEXT NOT NULL CHECK (accion IN ('create', 'update', 'delete', 'soft_delete', 'login', 'other')),

  resumen TEXT NOT NULL,
  payload_antes JSONB,
  payload_despues JSONB,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_creado ON public.audit_log (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON public.audit_log (event_type, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (actor_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log (entity_type, entity_id);
