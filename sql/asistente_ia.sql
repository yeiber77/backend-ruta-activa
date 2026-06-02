-- Ejecutar en Supabase SQL Editor (una sola vez)

CREATE TABLE IF NOT EXISTS public.ia_retroalimentacion (
  id BIGSERIAL PRIMARY KEY,
  coordinador_id UUID NOT NULL,
  titulo TEXT,
  contenido TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_retroalimentacion_creado
  ON public.ia_retroalimentacion (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_ia_retroalimentacion_activo
  ON public.ia_retroalimentacion (activo);

CREATE TABLE IF NOT EXISTS public.ia_consultas (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL,
  rol_id INTEGER,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_consultas_creado
  ON public.ia_consultas (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_ia_consultas_usuario
  ON public.ia_consultas (usuario_id);
