-- 0) Drop dependent view first
DROP VIEW IF EXISTS public.professionals_safe CASCADE;

-- 1) Remove financial columns from professionals
ALTER TABLE public.professionals
  DROP COLUMN IF EXISTS valor_hora,
  DROP COLUMN IF EXISTS valor_plantao,
  DROP COLUMN IF EXISTS banco,
  DROP COLUMN IF EXISTS agencia,
  DROP COLUMN IF EXISTS conta,
  DROP COLUMN IF EXISTS chave_pix;

-- 2) Remove financial columns from shifts
ALTER TABLE public.shifts
  DROP COLUMN IF EXISTS valor_hora,
  DROP COLUMN IF EXISTS valor_total;

-- 3) Recreate professionals_safe view without removed columns
CREATE VIEW public.professionals_safe
WITH (security_invoker = on)
AS
SELECT
  p.id,
  p.user_id,
  p.nome,
  p.profissao,
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

-- 4) Add per-professional swap limits
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS limite_trocas_plantao_mes integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS limite_trocas_paciente_mes integer NOT NULL DEFAULT 5;

-- 5) Function: count active/approved swaps in current month
CREATE OR REPLACE FUNCTION public.count_trocas_plantao_mes(_profissional_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.shift_swaps
  WHERE solicitante_id = _profissional_id
    AND status IN ('aprovada','concluida','aceita','aguardando_resposta','aguardando_aprovacao','solicitada')
    AND created_at >= date_trunc('month', now())
    AND created_at <  date_trunc('month', now()) + interval '1 month';
$$;

-- 6) Function: returns { used, limit, remaining } JSON for the professional
CREATE OR REPLACE FUNCTION public.get_trocas_status_mes(_profissional_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'used', public.count_trocas_plantao_mes(_profissional_id),
    'limit', COALESCE((SELECT limite_trocas_plantao_mes FROM public.professionals WHERE id = _profissional_id), 3),
    'remaining', GREATEST(
      COALESCE((SELECT limite_trocas_plantao_mes FROM public.professionals WHERE id = _profissional_id), 3)
        - public.count_trocas_plantao_mes(_profissional_id),
      0
    )
  );
$$;

-- 7) Trigger to enforce limit
CREATE OR REPLACE FUNCTION public.enforce_swap_limit_per_month()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_used integer;
BEGIN
  IF NEW.tipo = 'administrativa' OR COALESCE(NEW.bypass_aprovacao, false) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(limite_trocas_plantao_mes, 3) INTO v_limit
  FROM public.professionals WHERE id = NEW.solicitante_id;

  v_used := public.count_trocas_plantao_mes(NEW.solicitante_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Limite mensal de trocas atingido (%/% no mês corrente). Conforme configuração do sistema.', v_used, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_swap_limit_per_month ON public.shift_swaps;
CREATE TRIGGER trg_enforce_swap_limit_per_month
  BEFORE INSERT ON public.shift_swaps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_swap_limit_per_month();

-- 8) Cleanup unused notification_channel setting
DELETE FROM public.system_settings WHERE key = 'notification_channel';