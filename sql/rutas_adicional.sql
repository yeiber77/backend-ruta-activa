-- Ejecutar en Supabase SQL Editor (una sola vez)

ALTER TABLE public.rutas
  ADD COLUMN IF NOT EXISTS adicional BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_rutas_adicional
  ON public.rutas (adicional);
