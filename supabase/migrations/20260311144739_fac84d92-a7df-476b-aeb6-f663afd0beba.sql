CREATE OR REPLACE FUNCTION public.list_professional_directory()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  profissao public.profissao_type,
  setor_principal_id UUID,
  unidade_principal_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.profissao, p.setor_principal_id, p.unidade_principal_id
  FROM public.professionals p
  WHERE p.status = 'ativo'
  ORDER BY p.nome
$$;

GRANT EXECUTE ON FUNCTION public.list_professional_directory() TO authenticated;

DROP POLICY IF EXISTS "Professionals can respond swaps" ON public.shift_swaps;

CREATE POLICY "Professionals can respond swaps"
ON public.shift_swaps
FOR UPDATE
TO authenticated
USING (
  destinatario_id = public.get_my_professional_id()
  OR destinatario_id IS NULL
)
WITH CHECK (
  destinatario_id = public.get_my_professional_id()
);