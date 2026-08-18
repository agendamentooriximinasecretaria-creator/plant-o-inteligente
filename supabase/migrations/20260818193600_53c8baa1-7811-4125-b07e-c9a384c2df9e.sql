ALTER TABLE public.shift_types ADD COLUMN IF NOT EXISTS intervalos jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.shift_types
SET intervalos = jsonb_build_array(jsonb_build_object('inicio', to_char(hora_inicio, 'HH24:MI'), 'fim', to_char(hora_fim, 'HH24:MI')))
WHERE intervalos = '[]'::jsonb;