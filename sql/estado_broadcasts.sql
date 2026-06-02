-- Ejecutar en Supabase SQL Editor (una sola vez)

CREATE TABLE IF NOT EXISTS public.estado_broadcasts (
  id BIGSERIAL PRIMARY KEY,
  coordinador_id UUID REFERENCES public.usuarios(id),
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'finalizado')),
  mensaje TEXT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'coordinador' CHECK (origen IN ('coordinador', 'chofer')),
  chofer_origen_id UUID REFERENCES public.usuarios(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.estado_confirmaciones (
  id BIGSERIAL PRIMARY KEY,
  broadcast_id BIGINT NOT NULL REFERENCES public.estado_broadcasts(id) ON DELETE CASCADE,
  chofer_id UUID NOT NULL REFERENCES public.usuarios(id),
  confirmado BOOLEAN NOT NULL DEFAULT TRUE,
  confirmado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (broadcast_id, chofer_id)
);

CREATE INDEX IF NOT EXISTS idx_estado_broadcasts_creado
  ON public.estado_broadcasts (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_estado_confirmaciones_chofer
  ON public.estado_confirmaciones (chofer_id, broadcast_id);
