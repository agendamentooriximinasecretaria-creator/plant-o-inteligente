CREATE OR REPLACE FUNCTION public.list_professional_directory()
RETURNS TABLE(id uuid, nome text, profissao profissao_type, cargo text, setor_principal_id uuid, unidade_principal_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.nome, p.profissao, p.cargo, p.setor_principal_id, p.unidade_principal_id
  FROM public.professionals p
  WHERE p.status = 'ativo'
    AND COALESCE(p.vinculo, '') <> 'gestor_administrativo'
    AND (
      p.user_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.user_id
          AND ur.role IN ('gestor_master'::app_role, 'coordenador'::app_role)
      )
    )
  ORDER BY p.nome
$function$;

CREATE OR REPLACE FUNCTION public.list_professional_user_ids_managers()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('gestor_master'::app_role, 'coordenador'::app_role)
$function$;