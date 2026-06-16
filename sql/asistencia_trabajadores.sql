-- Asistencia diaria de trabajadores (chofer, supervisor, obrero)
-- Ejecutar en Supabase SQL Editor (una sola vez por entorno).

CREATE TABLE IF NOT EXISTS public.asistencia_trabajadores (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trabajador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  entrada BOOLEAN NOT NULL DEFAULT false,
  salida BOOLEAN NOT NULL DEFAULT false,
  entrada_en TIMESTAMPTZ NULL,
  salida_en TIMESTAMPTZ NULL,
  detalles TEXT NULL,
  registrado_por UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trabajador_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencia_trabajadores_fecha
  ON public.asistencia_trabajadores (fecha);

CREATE INDEX IF NOT EXISTS idx_asistencia_trabajadores_trabajador
  ON public.asistencia_trabajadores (trabajador_id);

CREATE OR REPLACE FUNCTION public.touch_asistencia_trabajadores_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS asistencia_trabajadores_actualizado_en ON public.asistencia_trabajadores;
CREATE TRIGGER asistencia_trabajadores_actualizado_en
  BEFORE UPDATE ON public.asistencia_trabajadores
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_asistencia_trabajadores_actualizado_en();
