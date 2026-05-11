-- Add cargo column to professionals table
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS cargo TEXT;

-- Recreate professionals_safe view to include cargo
DROP VIEW IF EXISTS public.professionals_safe CASCADE;
CREATE VIEW public.professionals_safe
WITH (security_invoker = on)
AS
SELECT
  p.id,
  p.user_id,
  p.nome,
  p.profissao,
  p.cargo,
  p.especialidade,
  p.conselho,
  p.registro,
  p.telefone,
  p.email,
  p.endereco,
  p.data_nascimento,
  p.unidade_principal_id,
  p.setor_principal_id,
  p.vinculo,
  p.status,
  p.observacoes,
  p.avatar_url,
  p.documento_validade,
  p.documento_numero,
  p.documento_conselho,
  p.competencias,
  p.created_at,
  p.updated_at,
  CASE
    WHEN public.has_role(auth.uid(), 'gestor_master'::public.app_role) OR p.user_id = auth.uid()
      THEN p.cpf
    ELSE NULL
  END AS cpf
FROM public.professionals p;

-- Drop and recreate list_professional_directory function
DROP FUNCTION IF EXISTS public.list_professional_directory();

CREATE OR REPLACE FUNCTION public.list_professional_directory()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  profissao public.profissao_type,
  cargo TEXT,
  setor_principal_id UUID,
  unidade_principal_id UUID
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.profissao, p.cargo, p.setor_principal_id, p.unidade_principal_id
  FROM public.professionals p
  WHERE p.status = 'ativo'
  ORDER BY p.nome
$$;

GRANT EXECUTE ON FUNCTION public.list_professional_directory() TO authenticated;