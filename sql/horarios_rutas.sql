-- Ejecutar en Supabase SQL Editor (una sola vez)

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
