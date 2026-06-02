-- Ejecutar en Supabase SQL Editor (una sola vez)

CREATE TABLE IF NOT EXISTS public.denuncias (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL,
  rol_id INTEGER,
  motivo TEXT NOT NULL,
  descripcion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_denuncias_creado
  ON public.denuncias (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_denuncias_usuario
  ON public.denuncias (usuario_id);

CREATE TABLE IF NOT EXISTS public.comentarios (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL,
  rol_id INTEGER,
  texto TEXT NOT NULL,
  respuesta TEXT,
  respondido_por_id UUID,
  respondido_por_rol_id INTEGER,
  respondido_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_creado
  ON public.comentarios (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_comentarios_usuario
  ON public.comentarios (usuario_id);
