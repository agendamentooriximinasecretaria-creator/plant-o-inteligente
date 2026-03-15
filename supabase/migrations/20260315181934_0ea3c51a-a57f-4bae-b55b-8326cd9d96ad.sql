
ALTER TABLE public.shift_swaps DROP CONSTRAINT IF EXISTS shift_swaps_tipo_check;
ALTER TABLE public.shift_swaps ADD CONSTRAINT shift_swaps_tipo_check CHECK (tipo = ANY (ARRAY['direto'::text, 'grupo'::text, 'administrativa'::text]));
