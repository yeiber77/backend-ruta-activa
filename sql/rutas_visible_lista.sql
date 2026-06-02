-- Ejecutar en Supabase SQL Editor (una sola vez)
-- Las filas del catálogo pueden existir en la tabla pero no aparecen en Activas
-- hasta que el coordinador las «crea» desde la app (visible_lista = true).

ALTER TABLE public.rutas
  ADD COLUMN IF NOT EXISTS visible_lista BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_rutas_visible_lista
  ON public.rutas (visible_lista);
