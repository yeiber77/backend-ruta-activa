-- Ejecutar TODO este archivo en Supabase SQL Editor (una sola vez)

-- 1) Rutas normales vs adicionales
ALTER TABLE public.rutas
  ADD COLUMN IF NOT EXISTS adicional BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_rutas_adicional
  ON public.rutas (adicional);

-- 1b) Catálogo en «Crear ruta» sin llenar Activas
ALTER TABLE public.rutas
  ADD COLUMN IF NOT EXISTS visible_lista BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_rutas_visible_lista
  ON public.rutas (visible_lista);

-- 2) Asistente IA (si aún no lo ejecutaste)
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

-- 3) Denuncias y comentarios
CREATE TABLE IF NOT EXISTS public.denuncias (
  id BIGSERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL,
  rol_id INTEGER,
  motivo TEXT NOT NULL,
  descripcion TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_denuncias_creado ON public.denuncias (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_denuncias_usuario ON public.denuncias (usuario_id);

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

CREATE INDEX IF NOT EXISTS idx_comentarios_creado ON public.comentarios (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_comentarios_usuario ON public.comentarios (usuario_id);

-- 4) Horarios y rutas (programación semanal)
CREATE TABLE IF NOT EXISTS public.horarios_rutas_dia (
  id TEXT PRIMARY KEY,
  dia_label TEXT NOT NULL,
  zonas JSONB NOT NULL DEFAULT '[]'::jsonb,
  nota TEXT,
  orden SMALLINT NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_por UUID
);

INSERT INTO public.horarios_rutas_dia (id, dia_label, zonas, nota, orden) VALUES
  ('lunes', 'Lunes', '["Casco central avenida","Cuchilla colinas","La esmeralda","Barrio nazareno","La malaguera"]'::jsonb, NULL, 1),
  ('martes', 'Martes', '["Monte bello","Estación Santa Ana","Palmar Ramireño","Carrizal","INAVI Centenario","CDI"]'::jsonb, NULL, 2),
  ('miercoles', 'Miércoles', '["Quebradita","Buena vista","Don José","Teo Camargo","Andrés Eloy","Cafetal","Timoteo Chacón","Campín","Golondrinas","Sucre","Santa Teresa"]'::jsonb, NULL, 3),
  ('jueves', 'Jueves', '["San Joaquín","Ceibones","Milagros","Malacate","La malaguera","Barrio nazareno","Mercedes","Libertador"]'::jsonb, NULL, 4),
  ('viernes', 'Viernes', '["Casco central","Avenida completa","Carrizal","Centenario","INAVI","CDI"]'::jsonb, NULL, 5),
  ('sabado', 'Sábado', '[]'::jsonb, 'Rutas rotativas por turno. Incluyen C.P.O. o cualquiera que se requiera.', 6)
ON CONFLICT (id) DO NOTHING;

-- 5) Historial de despidos de choferes (pantalla Equipo — administrador)
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
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despidos_choferes_creado
  ON public.despidos_choferes (creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_despidos_choferes_chofer
  ON public.despidos_choferes (chofer_id);

ALTER TABLE public.despidos_choferes
  ADD COLUMN IF NOT EXISTS rol_id INTEGER;

-- 6) Rol Obrero (equipo operativo — pantalla Equipo)
INSERT INTO public.roles (id, nombre)
VALUES (6, 'Obrero')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
