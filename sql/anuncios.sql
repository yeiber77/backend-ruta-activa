-- Anuncios operativos del coordinador (avisos de camión, rutas, etc.)
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.anuncios (
  id BIGSERIAL PRIMARY KEY,
  coordinador_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'general',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anuncios_activo_creado
  ON public.anuncios (activo, creado_en DESC);
