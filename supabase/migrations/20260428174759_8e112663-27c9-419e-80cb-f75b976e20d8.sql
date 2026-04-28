ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_unidade_principal_id_fkey,
  ADD CONSTRAINT professionals_unidade_principal_id_fkey
    FOREIGN KEY (unidade_principal_id) REFERENCES public.units(id) ON DELETE SET NULL;

ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_unidade_id_fkey,
  ADD CONSTRAINT shifts_unidade_id_fkey
    FOREIGN KEY (unidade_id) REFERENCES public.units(id) ON DELETE SET NULL;