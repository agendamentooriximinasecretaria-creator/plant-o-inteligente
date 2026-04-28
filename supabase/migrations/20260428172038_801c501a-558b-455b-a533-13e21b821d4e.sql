-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.generated_document_status AS ENUM (
    'rascunho','gerado','assinado','publicado','retificado','cancelado','arquivado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.generated_document_type AS ENUM (
    'escala_mensal','comprovante_plantao','troca_plantao','relatorio_oficial','documento_personalizado','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_documento public.generated_document_type NOT NULL,
  titulo text NOT NULL,
  modelo_id uuid NULL,
  modelo_nome text NULL,
  versao integer NOT NULL DEFAULT 1,
  status public.generated_document_status NOT NULL DEFAULT 'gerado',

  -- Conteúdo
  conteudo_html text NOT NULL DEFAULT '',
  dados_geracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash text NOT NULL,
  codigo_validacao text NOT NULL UNIQUE,

  -- Vínculos
  unidade_id uuid NULL,
  setor_id uuid NULL,
  profissional_id uuid NULL,

  -- Versionamento
  previous_document_id uuid NULL REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  root_document_id uuid NULL,
  motivo_retificacao text NULL,

  -- Assinatura
  signature_id uuid NULL REFERENCES public.document_signatures(id) ON DELETE SET NULL,
  assinado_por uuid NULL,
  assinado_em timestamptz NULL,

  -- Auditoria
  criado_por uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gendocs_root ON public.generated_documents(root_document_id);
CREATE INDEX IF NOT EXISTS idx_gendocs_prev ON public.generated_documents(previous_document_id);
CREATE INDEX IF NOT EXISTS idx_gendocs_prof ON public.generated_documents(profissional_id);
CREATE INDEX IF NOT EXISTS idx_gendocs_tipo ON public.generated_documents(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_gendocs_status ON public.generated_documents(status);
CREATE INDEX IF NOT EXISTS idx_gendocs_codigo ON public.generated_documents(codigo_validacao);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- RLS: leitura
CREATE POLICY "Read own or managers all"
  ON public.generated_documents FOR SELECT TO authenticated
  USING (
    public.is_manager(auth.uid())
    OR criado_por = auth.uid()
    OR (profissional_id IS NOT NULL AND profissional_id = public.get_my_professional_id())
  );

-- RLS: insert
CREATE POLICY "Authenticated insert own documents"
  ON public.generated_documents FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (criado_por IS NULL OR criado_por = auth.uid())
  );

-- RLS: update (apenas gestores ou autor enquanto não assinado)
CREATE POLICY "Update only when not signed"
  ON public.generated_documents FOR UPDATE TO authenticated
  USING (
    (public.is_manager(auth.uid()) OR criado_por = auth.uid())
  );

-- Trigger updated_at
CREATE TRIGGER trg_gendocs_updated_at
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: define root_document_id automaticamente
CREATE OR REPLACE FUNCTION public.set_generated_document_root()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.root_document_id IS NULL THEN
    IF NEW.previous_document_id IS NOT NULL THEN
      SELECT COALESCE(root_document_id, id) INTO NEW.root_document_id
        FROM public.generated_documents WHERE id = NEW.previous_document_id;
    ELSE
      NEW.root_document_id := NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_gendocs_set_root
  BEFORE INSERT ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_generated_document_root();

-- Trigger: bloquear edição de documento assinado (exceto status arquivado/cancelado por gestor)
CREATE OR REPLACE FUNCTION public.protect_signed_generated_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status = 'assinado' THEN
    -- Permitir apenas mudança de status para 'retificado' ou 'arquivado' por gestores
    IF (NEW.conteudo_html IS DISTINCT FROM OLD.conteudo_html
        OR NEW.dados_geracao IS DISTINCT FROM OLD.dados_geracao
        OR NEW.hash IS DISTINCT FROM OLD.hash
        OR NEW.codigo_validacao IS DISTINCT FROM OLD.codigo_validacao
        OR NEW.versao IS DISTINCT FROM OLD.versao
        OR NEW.signature_id IS DISTINCT FROM OLD.signature_id
        OR NEW.assinado_por IS DISTINCT FROM OLD.assinado_por
        OR NEW.assinado_em IS DISTINCT FROM OLD.assinado_em) THEN
      RAISE EXCEPTION 'Documento assinado é imutável. Crie uma retificação (nova versão).'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.status NOT IN ('assinado','retificado','arquivado','cancelado') THEN
      RAISE EXCEPTION 'Documento assinado só pode mudar para retificado, arquivado ou cancelado.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.status IN ('arquivado','cancelado') AND NOT public.is_manager(auth.uid()) THEN
      RAISE EXCEPTION 'Apenas gestores podem arquivar ou cancelar documento assinado.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_gendocs_protect_signed
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.protect_signed_generated_documents();

-- Trigger: auditoria
CREATE OR REPLACE FUNCTION public.audit_generated_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_acao text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := CASE
      WHEN NEW.previous_document_id IS NOT NULL THEN 'criou_retificacao_documento'
      ELSE 'gerou_documento'
    END;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_acao := 'mudou_status_documento_' || NEW.status::text;
    ELSE
      v_acao := 'editou_documento';
    END IF;
  ELSE
    v_acao := 'excluiu_documento';
  END IF;

  INSERT INTO public.audit_logs (modulo, acao, user_id, usuario_nome, status, detalhes)
  VALUES (
    'documentos_versoes', v_acao, auth.uid(),
    COALESCE((SELECT nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'sistema'),
    'sucesso',
    jsonb_build_object(
      'document_id', COALESCE(NEW.id, OLD.id),
      'tipo', COALESCE(NEW.tipo_documento, OLD.tipo_documento),
      'versao', COALESCE(NEW.versao, OLD.versao),
      'codigo_validacao', COALESCE(NEW.codigo_validacao, OLD.codigo_validacao),
      'status', COALESCE(NEW.status, OLD.status),
      'motivo_retificacao', NEW.motivo_retificacao
    )
  );
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_gendocs_audit
  AFTER INSERT OR UPDATE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_generated_documents();

-- Função pública de validação por código
CREATE OR REPLACE FUNCTION public.validate_generated_document(_code text)
RETURNS TABLE(
  id uuid, tipo_documento public.generated_document_type, titulo text,
  versao integer, status public.generated_document_status,
  hash text, codigo_validacao text,
  assinado_em timestamptz, created_at timestamptz,
  root_document_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, tipo_documento, titulo, versao, status, hash, codigo_validacao,
         assinado_em, created_at, root_document_id
  FROM public.generated_documents
  WHERE codigo_validacao = _code
  LIMIT 1
$$;