
-- Add missing columns to shift_swaps for approval/rejection tracking
ALTER TABLE public.shift_swaps
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejeitado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS observacao_rejeicao TEXT;

-- Also ensure coordenador can insert shift_swaps (for managing swaps)
CREATE POLICY "coordenador_insert_shift_swaps"
ON public.shift_swaps FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'coordenador'::public.app_role)
);

-- Allow coordenador to update swaps
CREATE POLICY "Coordenador can update swaps"
ON public.shift_swaps FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador'::public.app_role)
);

-- Allow coordenador to insert/update shifts
CREATE POLICY "Coordenador can insert shifts"
ON public.shifts FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'coordenador'::public.app_role)
);

CREATE POLICY "Coordenador can update shifts"
ON public.shifts FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'coordenador'::public.app_role)
);
