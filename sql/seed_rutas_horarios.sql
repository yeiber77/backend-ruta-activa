-- Rutas del programa semanal (zonas de horarios_rutas).
-- Ejecutar en Supabase SQL Editor si prefieres SQL en lugar del script Node.
-- Ajusta coordinador_id si usas otro usuario coordinador.

-- SELECT id FROM public.usuarios WHERE email ILIKE 'nelsoncasaravenida@gmail.com' AND rol_id = 2;

INSERT INTO public.rutas (comunidad_nombre, chofer_id, coordinador_id, representante_id, estado)
SELECT v.nombre, NULL, u.id, NULL, 'Pendiente'
FROM (
  VALUES
    ('Andrés Eloy'),
    ('Avenida completa'),
    ('Barrio nazareno'),
    ('Buena vista'),
    ('Cafetal'),
    ('Campín'),
    ('Carrizal'),
    ('Casco central'),
    ('Casco central avenida'),
    ('CDI'),
    ('Ceibones'),
    ('Centenario'),
    ('Cuchilla colinas'),
    ('Don José'),
    ('Estación Santa Ana'),
    ('Golondrinas'),
    ('INAVI'),
    ('INAVI Centenario'),
    ('La esmeralda'),
    ('La malaguera'),
    ('Libertador'),
    ('Malacate'),
    ('Mercedes'),
    ('Milagros'),
    ('Monte bello'),
    ('Palmar Ramireño'),
    ('Quebradita'),
    ('San Joaquín'),
    ('Santa Teresa'),
    ('Sucre'),
    ('Teo Camargo'),
    ('Timoteo Chacón')
) AS v(nombre)
CROSS JOIN (
  SELECT id FROM public.usuarios
  WHERE email ILIKE 'nelsoncasaravenida@gmail.com' AND rol_id = 2
  LIMIT 1
) AS u
WHERE NOT EXISTS (
  SELECT 1 FROM public.rutas r
  WHERE lower(trim(r.comunidad_nombre)) = lower(trim(v.nombre))
);
