-- Allow coordenador to delete professionals
DROP POLICY IF EXISTS "Gestor or coordenador can delete professionals" ON public.professionals;
CREATE POLICY "Gestor or coordenador can delete professionals"
ON public.professionals
FOR DELETE
TO authenticated
USING (public.is_manager(auth.uid()));

-- Drop the old master-only policy if exists (replaced by the broader one above)
DROP POLICY IF EXISTS "Gestor can delete professionals" ON public.professionals;

-- Allow coordenador to delete profiles
DROP POLICY IF EXISTS "Gestor or coordenador can delete profiles" ON public.profiles;
CREATE POLICY "Gestor or coordenador can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_manager(auth.uid()));

DROP POLICY IF EXISTS "Gestor can delete profiles" ON public.profiles;

-- Allow coordenador to delete user_roles (cascade cleanup)
DROP POLICY IF EXISTS "Managers can delete user_roles" ON public.user_roles;
CREATE POLICY "Managers can delete user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_manager(auth.uid()));

-- Protect Master Admin from being deleted (defense in depth)
CREATE OR REPLACE FUNCTION public.protect_master_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email = 'artemiosouza99@gmail.com' THEN
    RAISE EXCEPTION 'O Gestor Master raiz não pode ser excluído.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_master_admin_profile_del ON public.profiles;
CREATE TRIGGER protect_master_admin_profile_del
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_master_admin_profile();

CREATE OR REPLACE FUNCTION public.protect_master_admin_professional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email = 'artemiosouza99@gmail.com' THEN
    RAISE EXCEPTION 'O Gestor Master raiz não pode ser excluído.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_master_admin_professional_del ON public.professionals;
CREATE TRIGGER protect_master_admin_professional_del
BEFORE DELETE ON public.professionals
FOR EACH ROW EXECUTE FUNCTION public.protect_master_admin_professional();