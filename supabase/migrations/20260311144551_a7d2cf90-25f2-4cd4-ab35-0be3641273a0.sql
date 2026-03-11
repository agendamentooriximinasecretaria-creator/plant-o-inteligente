-- 1) Perfis de aplicação (sem senha em texto, apenas metadados de acesso)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  profissional_id UUID NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_profissional_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_profissional_id_fkey
      FOREIGN KEY (profissional_id)
      REFERENCES public.professionals(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS professionals_email_unique_idx ON public.professionals (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS professionals_user_id_unique_idx ON public.professionals (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Funções auxiliares de autorização
CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'gestor_master'::public.app_role)
     OR public.has_role(_user_id, 'coordenador'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.get_my_professional_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.professionals p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

-- 3) Triggers de updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_professionals_updated_at') THEN
    CREATE TRIGGER update_professionals_updated_at
    BEFORE UPDATE ON public.professionals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_units_updated_at') THEN
    CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sectors_updated_at') THEN
    CREATE TRIGGER update_sectors_updated_at
    BEFORE UPDATE ON public.sectors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shifts_updated_at') THEN
    CREATE TRIGGER update_shifts_updated_at
    BEFORE UPDATE ON public.shifts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shift_swaps_updated_at') THEN
    CREATE TRIGGER update_shift_swaps_updated_at
    BEFORE UPDATE ON public.shift_swaps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_message_templates_updated_at') THEN
    CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 4) Policies seguras: profiles
DROP POLICY IF EXISTS "Managers can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Gestor can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Gestor can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Gestor can delete profiles" ON public.profiles;

CREATE POLICY "Managers can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Gestor can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Gestor can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Gestor can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

-- 5) Policies seguras: professionals
DROP POLICY IF EXISTS "Authenticated can read professionals" ON public.professionals;
DROP POLICY IF EXISTS "Managers can read professionals" ON public.professionals;
DROP POLICY IF EXISTS "Professional can read own professional profile" ON public.professionals;
DROP POLICY IF EXISTS "Gestor can insert professionals" ON public.professionals;
DROP POLICY IF EXISTS "Gestor can update professionals" ON public.professionals;
DROP POLICY IF EXISTS "Gestor can delete professionals" ON public.professionals;

DROP POLICY IF EXISTS "Admins can insert professionals" ON public.professionals;
DROP POLICY IF EXISTS "Admins can update professionals" ON public.professionals;
DROP POLICY IF EXISTS "Admins can delete professionals" ON public.professionals;

CREATE POLICY "Managers can read professionals"
ON public.professionals
FOR SELECT
TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Professional can read own professional profile"
ON public.professionals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Gestor can insert professionals"
ON public.professionals
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Gestor can update professionals"
ON public.professionals
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Gestor can delete professionals"
ON public.professionals
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

-- 6) Policies seguras: shifts
DROP POLICY IF EXISTS "Authenticated can read shifts" ON public.shifts;
DROP POLICY IF EXISTS "Managers can read shifts" ON public.shifts;
DROP POLICY IF EXISTS "Professional can read own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Gestor can insert shifts" ON public.shifts;
DROP POLICY IF EXISTS "Gestor can update shifts" ON public.shifts;
DROP POLICY IF EXISTS "Gestor can delete shifts" ON public.shifts;

DROP POLICY IF EXISTS "Admins can insert shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins can update shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins can delete shifts" ON public.shifts;

CREATE POLICY "Managers can read shifts"
ON public.shifts
FOR SELECT
TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Professional can read own shifts"
ON public.shifts
FOR SELECT
TO authenticated
USING (profissional_id = public.get_my_professional_id());

CREATE POLICY "Gestor can insert shifts"
ON public.shifts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Gestor can update shifts"
ON public.shifts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Gestor can delete shifts"
ON public.shifts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

-- 7) Policies seguras: shift_swaps
DROP POLICY IF EXISTS "Authenticated can read swaps" ON public.shift_swaps;
DROP POLICY IF EXISTS "Authenticated can insert swaps" ON public.shift_swaps;
DROP POLICY IF EXISTS "Admins can update swaps" ON public.shift_swaps;
DROP POLICY IF EXISTS "Managers can read swaps" ON public.shift_swaps;
DROP POLICY IF EXISTS "Professionals can read own swaps" ON public.shift_swaps;
DROP POLICY IF EXISTS "Professional can create own swap request" ON public.shift_swaps;
DROP POLICY IF EXISTS "Gestor can update swaps" ON public.shift_swaps;
DROP POLICY IF EXISTS "Professionals can respond swaps" ON public.shift_swaps;
DROP POLICY IF EXISTS "Professionals can cancel own swaps" ON public.shift_swaps;

CREATE POLICY "Managers can read swaps"
ON public.shift_swaps
FOR SELECT
TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Professionals can read own swaps"
ON public.shift_swaps
FOR SELECT
TO authenticated
USING (
  solicitante_id = public.get_my_professional_id()
  OR destinatario_id = public.get_my_professional_id()
  OR (destinatario_id IS NULL AND solicitante_id <> public.get_my_professional_id())
);

CREATE POLICY "Professional can create own swap request"
ON public.shift_swaps
FOR INSERT
TO authenticated
WITH CHECK (solicitante_id = public.get_my_professional_id());

CREATE POLICY "Gestor can update swaps"
ON public.shift_swaps
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Professionals can respond swaps"
ON public.shift_swaps
FOR UPDATE
TO authenticated
USING (destinatario_id = public.get_my_professional_id());

CREATE POLICY "Professionals can cancel own swaps"
ON public.shift_swaps
FOR UPDATE
TO authenticated
USING (solicitante_id = public.get_my_professional_id());

-- 8) Policies seguras: swap_history
DROP POLICY IF EXISTS "Authenticated can read swap history" ON public.swap_history;
DROP POLICY IF EXISTS "Authenticated can insert swap history" ON public.swap_history;
DROP POLICY IF EXISTS "Managers can read swap history" ON public.swap_history;
DROP POLICY IF EXISTS "Professionals can read own swap history" ON public.swap_history;
DROP POLICY IF EXISTS "Authenticated can insert own swap history" ON public.swap_history;

CREATE POLICY "Managers can read swap history"
ON public.swap_history
FOR SELECT
TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Professionals can read own swap history"
ON public.swap_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.shift_swaps sw
    WHERE sw.id = swap_history.swap_id
      AND (
        sw.solicitante_id = public.get_my_professional_id()
        OR sw.destinatario_id = public.get_my_professional_id()
      )
  )
);

CREATE POLICY "Authenticated can insert own swap history"
ON public.swap_history
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND (
    public.is_manager(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.shift_swaps sw
      WHERE sw.id = swap_history.swap_id
        AND (
          sw.solicitante_id = public.get_my_professional_id()
          OR sw.destinatario_id = public.get_my_professional_id()
        )
    )
  )
);

-- 9) Policies seguras: notifications
DROP POLICY IF EXISTS "Authenticated can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Managers can insert notifications" ON public.notifications;

CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  public.is_manager(auth.uid())
  OR user_id = auth.uid()
  OR (professional_id IS NOT NULL AND professional_id = public.get_my_professional_id())
);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  public.is_manager(auth.uid())
  OR user_id = auth.uid()
  OR (professional_id IS NOT NULL AND professional_id = public.get_my_professional_id())
);

CREATE POLICY "Managers can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_manager(auth.uid())
  OR user_id = auth.uid()
);

-- 10) Policies seguras: audit_logs
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Managers can read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated can insert own audit logs" ON public.audit_logs;

CREATE POLICY "Managers can read audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

CREATE POLICY "Authenticated can insert own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    user_id IS NULL
    OR user_id = auth.uid()
  )
);

-- 11) User roles estritamente administrativos
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Gestor can manage roles" ON public.user_roles;

CREATE POLICY "Gestor can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

-- 12) Bootstrap seguro: se não há nenhuma role ainda, promove 1 usuário existente para Gestor Master
WITH preferred_user AS (
  SELECT id, email
  FROM auth.users
  WHERE email IN ('gestor@hospital.com', 'admin2311@gmail.com', 'agendamentooriximinasecretaria@gmail.com')
  ORDER BY CASE
    WHEN email = 'gestor@hospital.com' THEN 1
    WHEN email = 'admin2311@gmail.com' THEN 2
    WHEN email = 'agendamentooriximinasecretaria@gmail.com' THEN 3
    ELSE 99
  END
  LIMIT 1
),
fallback_user AS (
  SELECT id, email
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
),
target_user AS (
  SELECT * FROM preferred_user
  UNION ALL
  SELECT * FROM fallback_user WHERE NOT EXISTS (SELECT 1 FROM preferred_user)
)
INSERT INTO public.user_roles (user_id, role)
SELECT tu.id, 'gestor_master'::public.app_role
FROM target_user tu
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles);

INSERT INTO public.profiles (user_id, nome, email, role, ativo)
SELECT u.id,
       COALESCE(split_part(u.email, '@', 1), 'Gestor Master'),
       u.email,
       'gestor_master'::public.app_role,
       true
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE ur.role = 'gestor_master'::public.app_role
  AND p.id IS NULL;