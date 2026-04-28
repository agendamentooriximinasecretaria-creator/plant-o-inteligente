
-- Tabela de carimbos digitais (1:1 com professionals)
CREATE TABLE public.professional_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL UNIQUE,
  cargo text,
  cbo text,
  cns text,
  texto_personalizado text,
  assinatura_path text,        -- storage key dentro de professional-documents
  carimbo_path text,           -- storage key dentro de professional-documents
  assinatura_posicao text NOT NULL DEFAULT 'centro' CHECK (assinatura_posicao IN ('esquerda','centro','direita')),
  assinatura_tamanho integer NOT NULL DEFAULT 180 CHECK (assinatura_tamanho BETWEEN 60 AND 480),
  carimbo_tamanho integer NOT NULL DEFAULT 140 CHECK (carimbo_tamanho BETWEEN 60 AND 480),
  cor_texto text NOT NULL DEFAULT '#000000',
  mostrar_conselho boolean NOT NULL DEFAULT true,
  mostrar_cbo boolean NOT NULL DEFAULT false,
  mostrar_cns boolean NOT NULL DEFAULT false,
  mostrar_unidade boolean NOT NULL DEFAULT true,
  bloqueado boolean NOT NULL DEFAULT false,
  bloqueado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stamps_prof ON public.professional_stamps(profissional_id);

ALTER TABLE public.professional_stamps ENABLE ROW LEVEL SECURITY;

-- Leitura: dono, coordenador, gestor master
CREATE POLICY "Read own or managers can read stamps"
  ON public.professional_stamps FOR SELECT TO authenticated
  USING (
    profissional_id = public.get_my_professional_id()
    OR public.is_manager(auth.uid())
  );

-- Inserção: o próprio dono OU manager (cria carimbo do profissional)
CREATE POLICY "Insert own or managers stamps"
  ON public.professional_stamps FOR INSERT TO authenticated
  WITH CHECK (
    profissional_id = public.get_my_professional_id()
    OR public.is_manager(auth.uid())
  );

-- Atualização: dono (apenas se não bloqueado), coordenador (não bloqueado), gestor master (sempre)
CREATE POLICY "Owner update own stamp if not blocked"
  ON public.professional_stamps FOR UPDATE TO authenticated
  USING (profissional_id = public.get_my_professional_id() AND bloqueado = false);

CREATE POLICY "Coordenador update non-blocked stamps"
  ON public.professional_stamps FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'coordenador'::public.app_role) AND bloqueado = false);

CREATE POLICY "Master update any stamp"
  ON public.professional_stamps FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

-- Exclusão: somente gestor master
CREATE POLICY "Master delete stamps"
  ON public.professional_stamps FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

-- updated_at trigger
CREATE TRIGGER trg_stamps_updated_at
  BEFORE UPDATE ON public.professional_stamps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garantir que apenas gestor master altere o flag bloqueado
CREATE OR REPLACE FUNCTION public.enforce_stamp_block_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (NEW.bloqueado IS DISTINCT FROM OLD.bloqueado) THEN
    IF NOT public.has_role(auth.uid(), 'gestor_master'::public.app_role) THEN
      RAISE EXCEPTION 'Apenas o Gestor Master pode bloquear ou desbloquear carimbos.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_stamps_block_role
  BEFORE UPDATE ON public.professional_stamps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_stamp_block_role();

-- Auditoria
CREATE OR REPLACE FUNCTION public.audit_professional_stamps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_acao text;
  v_prof uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_acao := 'criou_carimbo'; v_prof := NEW.profissional_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.bloqueado IS DISTINCT FROM OLD.bloqueado THEN
      v_acao := CASE WHEN NEW.bloqueado THEN 'bloqueou_carimbo' ELSE 'desbloqueou_carimbo' END;
    ELSE v_acao := 'editou_carimbo'; END IF;
    v_prof := NEW.profissional_id;
  ELSE v_acao := 'excluiu_carimbo'; v_prof := OLD.profissional_id; END IF;

  INSERT INTO public.audit_logs (modulo, acao, user_id, usuario_nome, status, detalhes)
  VALUES (
    'carimbo_digital', v_acao, auth.uid(),
    COALESCE((SELECT nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'sistema'),
    'sucesso',
    jsonb_build_object('profissional_id', v_prof)
  );
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_audit_stamps
  AFTER INSERT OR UPDATE OR DELETE ON public.professional_stamps
  FOR EACH ROW EXECUTE FUNCTION public.audit_professional_stamps();

-- Storage policies para signatures/{professional_id}/...
-- Dono lê/escreve seu prefixo; managers leem todos os signatures.
CREATE POLICY "Pros can upload own signatures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'professional-documents'
    AND (storage.foldername(name))[1] = 'signatures'
    AND (
      (storage.foldername(name))[2] = public.get_my_professional_id()::text
      OR public.is_manager(auth.uid())
    )
  );

CREATE POLICY "Pros can read own signatures"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'professional-documents'
    AND (storage.foldername(name))[1] = 'signatures'
    AND (
      (storage.foldername(name))[2] = public.get_my_professional_id()::text
      OR public.is_manager(auth.uid())
    )
  );

CREATE POLICY "Pros can update own signatures"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'professional-documents'
    AND (storage.foldername(name))[1] = 'signatures'
    AND (
      (storage.foldername(name))[2] = public.get_my_professional_id()::text
      OR public.is_manager(auth.uid())
    )
  );

CREATE POLICY "Pros can delete own signatures"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'professional-documents'
    AND (storage.foldername(name))[1] = 'signatures'
    AND (
      (storage.foldername(name))[2] = public.get_my_professional_id()::text
      OR public.is_manager(auth.uid())
    )
  );
