-- Ejecutar en Supabase SQL Editor si ya tenías despidos_choferes sin rol_id

ALTER TABLE public.despidos_choferes
  ADD COLUMN IF NOT EXISTS rol_id INTEGER;
