
-- Enums
CREATE TYPE public.signature_role AS ENUM ('profissional', 'coordenador', 'gestor_master', 'institucional');
CREATE TYPE public.signature_status AS ENUM ('ativa', 'revogada', 'substituida');

-- Tabela
CREATE TABLE public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL,                 -- ex: 'comprovante_plantao', 'troca', 'escala_mensal_oficial', 'relatorio', 'modelo_personalizado'
  document_id text NOT NULL,                   -- id externo (uuid do shift, swap, escala-yyyymm, template id, etc.)
  document_version integer NOT NULL DEFAULT 1,
  document_title text,
  content_hash text NOT NULL,                  -- SHA-256 hex completo do conteúdo final
  validation_code text NOT NULL UNIQUE,        -- código curto único (12 chars)
  signed_by_user_id uuid NOT NULL,
  signed_by_professional_id uuid,
  signer_name text NOT NULL,
  signer_role public.signature_role NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  status public.signature_status NOT NULL DEFAULT 'ativa',
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  previous_signature_id uuid REFERENCES public.document_signatures(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sigs_doc ON public.document_signatures(document_type, document_id);
CREATE INDEX idx_sigs_user ON public.document_signatures(signed_by_user_id);
CREATE INDEX idx_sigs_code ON public.document_signatures(validation_code);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- INSERT: usuário autenticado só pode assinar em seu próprio nome
CREATE POLICY "Authenticated can sign as themselves"
  ON public.document_signatures FOR INSERT TO authenticated
  WITH CHECK (signed_by_user_id = auth.uid() AND status = 'ativa');

-- SELECT
CREATE POLICY "User reads own signatures or managers read all"
  ON public.document_signatures FOR SELECT TO authenticated
  USING (signed_by_user_id = auth.uid() OR public.is_manager(auth.uid()));

-- UPDATE: apenas master, e apenas para revogar/substituir
CREATE POLICY "Master can revoke signatures"
  ON public.document_signatures FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'gestor_master'::public.app_role));

-- Trigger: bloquear update de campos críticos
CREATE OR REPLACE FUNCTION public.protect_signature_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.content_hash <> OLD.content_hash
     OR NEW.validation_code <> OLD.validation_code
     OR NEW.signed_by_user_id <> OLD.signed_by_user_id
     OR NEW.signed_at <> OLD.signed_at
     OR NEW.document_id <> OLD.document_id
     OR NEW.document_type <> OLD.document_type
     OR NEW.document_version <> OLD.document_version
  THEN
    RAISE EXCEPTION 'Campos imutáveis de assinatura não podem ser alterados. Crie uma nova versão.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sig_immutability
  BEFORE UPDATE ON public.document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.protect_signature_immutability();

-- Auditoria
CREATE OR REPLACE FUNCTION public.audit_document_signatures()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_acao text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'assinou_documento';
  ELSE
    v_acao := CASE WHEN NEW.status = 'revogada' THEN 'revogou_assinatura' ELSE 'atualizou_assinatura' END;
  END IF;

  INSERT INTO public.audit_logs (modulo, acao, user_id, usuario_nome, status, detalhes)
  VALUES (
    'assinatura_eletronica', v_acao, auth.uid(),
    COALESCE((SELECT nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'sistema'),
    'sucesso',
    jsonb_build_object(
      'signature_id', COALESCE(NEW.id, OLD.id),
      'document_type', COALESCE(NEW.document_type, OLD.document_type),
      'document_id', COALESCE(NEW.document_id, OLD.document_id),
      'validation_code', COALESCE(NEW.validation_code, OLD.validation_code)
    )
  );
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_audit_signatures
  AFTER INSERT OR UPDATE ON public.document_signatures
  FOR EACH ROW EXECUTE FUNCTION public.audit_document_signatures();

-- Função pública de validação (sem expor IP/user_agent)
CREATE OR REPLACE FUNCTION public.validate_signature(_code text)
RETURNS TABLE(
  document_type text,
  document_title text,
  document_version integer,
  signer_name text,
  signer_role public.signature_role,
  signed_at timestamptz,
  status public.signature_status,
  content_hash text,
  validation_code text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.document_type, s.document_title, s.document_version,
         s.signer_name, s.signer_role, s.signed_at, s.status,
         s.content_hash, s.validation_code
  FROM public.document_signatures s
  WHERE s.validation_code = _code
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.validate_signature(text) TO anon, authenticated;
