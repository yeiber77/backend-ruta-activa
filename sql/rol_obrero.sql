-- Ejecutar en Supabase SQL Editor (una sola vez)

INSERT INTO public.roles (id, nombre)
VALUES (6, 'Obrero')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
