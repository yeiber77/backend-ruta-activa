-- Ejecutar en Supabase SQL Editor (una sola vez)

CREATE TABLE IF NOT EXISTS public.despidos_choferes (
  id BIGSERIAL PRIMARY KEY,
  chofer_id UUID NOT NULL,
  nombre TEXT,
  email TEXT,
  telefono TEXT,
  despido_por UUID NOT NULL,
  admin_nombre TEXT,
  admin_email TEXT,
  motivo TEXT,
  rol_id INTEGER,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despidos_choferes_creado
  ON public.despidos_choferes (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_despidos_choferes_chofer
  ON public.despidos_choferes (chofer_id);
