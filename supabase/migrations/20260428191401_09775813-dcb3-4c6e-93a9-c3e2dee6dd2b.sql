-- =========================================================
-- ANEXOS JUSTIFICATIVOS PARA TROCAS DE PLANTÃO
-- =========================================================

-- Enum de tipo de documento
DO $$ BEGIN
  CREATE TYPE public.swap_attachment_type AS ENUM (
    'atestado_medico',
    'declaracao',
    'comprovante_consulta',
    'convocacao',
    'documento_institucional',
    'documento_pessoal',
    'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum de status do anexo
DO $$ BEGIN
  CREATE TYPE public.swap_attachment_status AS ENUM ('ativo', 'removido', 'rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela
CREATE TABLE IF NOT EXISTS public.swap_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  troca_id uuid NOT NULL,
  tipo_documento public.swap_attachment_type NOT NULL DEFAULT 'outro',
  descricao text,
  nome_original text NOT NULL,
  mime_type text NOT NULL,
  tamanho bigint NOT NULL,
  storage_path text NOT NULL,
  status public.swap_attachment_status NOT NULL DEFAULT 'ativo',
  motivo_rejeicao text,
  enviado_por_user_id uuid NOT NULL,
  enviado_por_profissional_id uuid,
  analisado_por uuid,
  analisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_swap_attachments_troca ON public.swap_attachments(troca_id);
CREATE INDEX IF NOT EXISTS idx_swap_attachments_status ON public.swap_attachments(status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_swap_attachments_updated_at ON public.swap_attachments;
CREATE TRIGGER trg_swap_attachments_updated_at
BEFORE UPDATE ON public.swap_attachments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.swap_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: solicitante, destinatário ou gestor
DROP POLICY IF EXISTS "Read swap attachments by participants or managers" ON public.swap_attachments;
CREATE POLICY "Read swap attachments by participants or managers"
ON public.swap_attachments FOR SELECT TO authenticated
USING (
  public.is_manager(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.shift_swaps sw
    WHERE sw.id = swap_attachments.troca_id
      AND (sw.solicitante_id = public.get_my_professional_id()
           OR sw.destinatario_id = public.get_my_professional_id())
  )
);

-- INSERT: solicitante da troca ou gestor
DROP POLICY IF EXISTS "Insert swap attachments by requester or managers" ON public.swap_attachments;
CREATE POLICY "Insert swap attachments by requester or managers"
ON public.swap_attachments FOR INSERT TO authenticated
WITH CHECK (
  enviado_por_user_id = auth.uid()
  AND (
    public.is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shift_swaps sw
      WHERE sw.id = troca_id
        AND sw.solicitante_id = public.get_my_professional_id()
    )
  )
);

-- UPDATE: solicitante (só enquanto pendente para remover) ou gestor
DROP POLICY IF EXISTS "Update swap attachments by owner or managers" ON public.swap_attachments;
CREATE POLICY "Update swap attachments by owner or managers"
ON public.swap_attachments FOR UPDATE TO authenticated
USING (
  public.is_manager(auth.uid())
  OR (
    enviado_por_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.shift_swaps sw
      WHERE sw.id = swap_attachments.troca_id
        AND sw.status IN ('solicitada','aguardando_resposta')
    )
  )
)
WITH CHECK (
  public.is_manager(auth.uid())
  OR enviado_por_user_id = auth.uid()
);

-- Auditoria
CREATE OR REPLACE FUNCTION public.audit_swap_attachments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_acao text; v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_acao := 'anexo_troca_enviado'; v_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := CASE
      WHEN NEW.status = 'rejeitado' AND OLD.status <> 'rejeitado' THEN 'anexo_troca_rejeitado'
      WHEN NEW.status = 'removido' AND OLD.status <> 'removido' THEN 'anexo_troca_removido'
      ELSE 'anexo_troca_atualizado' END;
    v_id := NEW.id;
  ELSE v_acao := 'anexo_troca_excluido'; v_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs (modulo, acao, user_id, usuario_nome, status, detalhes)
  VALUES (
    'trocas_anexos', v_acao, auth.uid(),
    COALESCE((SELECT nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'sistema'),
    'sucesso',
    jsonb_build_object(
      'attachment_id', v_id,
      'troca_id', COALESCE(NEW.troca_id, OLD.troca_id),
      'tipo_documento', COALESCE(NEW.tipo_documento, OLD.tipo_documento),
      'nome_original', COALESCE(NEW.nome_original, OLD.nome_original),
      'status', COALESCE(NEW.status, OLD.status),
      'motivo_rejeicao', NEW.motivo_rejeicao
    )
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_audit_swap_attachments ON public.swap_attachments;
CREATE TRIGGER trg_audit_swap_attachments
AFTER INSERT OR UPDATE ON public.swap_attachments
FOR EACH ROW EXECUTE FUNCTION public.audit_swap_attachments();

-- =========================================================
-- BUCKET PRIVADO
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('swap-attachments', 'swap-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — caminho: {troca_id}/{filename}
DROP POLICY IF EXISTS "Swap attachments read by participants or managers" ON storage.objects;
CREATE POLICY "Swap attachments read by participants or managers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'swap-attachments'
  AND (
    public.is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shift_swaps sw
      WHERE sw.id::text = (storage.foldername(name))[1]
        AND (sw.solicitante_id = public.get_my_professional_id()
             OR sw.destinatario_id = public.get_my_professional_id())
    )
  )
);

DROP POLICY IF EXISTS "Swap attachments upload by requester or managers" ON storage.objects;
CREATE POLICY "Swap attachments upload by requester or managers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'swap-attachments'
  AND (
    public.is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shift_swaps sw
      WHERE sw.id::text = (storage.foldername(name))[1]
        AND sw.solicitante_id = public.get_my_professional_id()
    )
  )
);

DROP POLICY IF EXISTS "Swap attachments delete by owner or managers" ON storage.objects;
CREATE POLICY "Swap attachments delete by owner or managers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'swap-attachments'
  AND (
    public.is_manager(auth.uid())
    OR owner = auth.uid()
  )
);
