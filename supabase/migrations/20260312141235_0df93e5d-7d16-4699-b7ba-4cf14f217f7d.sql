-- Allow gestor_master to INSERT shift_swaps (for admin swaps)
CREATE POLICY "gestor_master_insert_shift_swaps"
ON public.shift_swaps FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'gestor_master'::public.app_role)
);
