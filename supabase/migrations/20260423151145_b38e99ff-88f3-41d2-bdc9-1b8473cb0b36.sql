-- 1) Indisponibilidade
CREATE TABLE IF NOT EXISTS public.professional_unavailability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'indisponibilidade',
  status TEXT NOT NULL DEFAULT 'pendente',
  observacao_gestor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

ALTER TABLE public.professional_unavailability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pros can read own unavailability"
  ON public.professional_unavailability FOR SELECT TO authenticated
  USING (profissional_id = public.get_my_professional_id() OR public.is_manager(auth.uid()));

CREATE POLICY "Pros can insert own unavailability"
  ON public.professional_unavailability FOR INSERT TO authenticated
  WITH CHECK (profissional_id = public.get_my_professional_id() OR public.is_manager(auth.uid()));

CREATE POLICY "Pros can update own unavailability"
  ON public.professional_unavailability FOR UPDATE TO authenticated
  USING (profissional_id = public.get_my_professional_id() OR public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete unavailability"
  ON public.professional_unavailability FOR DELETE TO authenticated
  USING (public.is_manager(auth.uid()));

CREATE TRIGGER update_unavailability_updated_at
  BEFORE UPDATE ON public.professional_unavailability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Documentos profissionais
CREATE TABLE IF NOT EXISTS public.professional_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profissional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  numero TEXT,
  data_emissao DATE,
  validade DATE,
  arquivo_path TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pros can read own documents"
  ON public.professional_documents FOR SELECT TO authenticated
  USING (profissional_id = public.get_my_professional_id() OR public.is_manager(auth.uid()));

CREATE POLICY "Pros can insert own documents"
  ON public.professional_documents FOR INSERT TO authenticated
  WITH CHECK (profissional_id = public.get_my_professional_id() OR public.is_manager(auth.uid()));

CREATE POLICY "Pros can update own documents"
  ON public.professional_documents FOR UPDATE TO authenticated
  USING (profissional_id = public.get_my_professional_id() OR public.is_manager(auth.uid()));

CREATE POLICY "Pros can delete own documents"
  ON public.professional_documents FOR DELETE TO authenticated
  USING (profissional_id = public.get_my_professional_id() OR public.is_manager(auth.uid()));

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.professional_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Colunas em shifts para presença + check-in
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS confirmado_pelo_profissional BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkin_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS checkin_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS checkin_metodo TEXT,
  ADD COLUMN IF NOT EXISTS atraso_minutos INTEGER,
  ADD COLUMN IF NOT EXISTS faltou BOOLEAN NOT NULL DEFAULT false;

-- Permitir profissional atualizar seus próprios shifts (apenas presença/check-in)
CREATE POLICY "Professional can confirm own shifts"
  ON public.shifts FOR UPDATE TO authenticated
  USING (profissional_id = public.get_my_professional_id())
  WITH CHECK (profissional_id = public.get_my_professional_id());

-- 4) Bucket privado para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-documents', 'professional-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Pros can read own document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'professional-documents'
    AND (
      public.is_manager(auth.uid())
      OR (storage.foldername(name))[1] = public.get_my_professional_id()::text
    )
  );

CREATE POLICY "Pros can upload own document files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'professional-documents'
    AND (
      public.is_manager(auth.uid())
      OR (storage.foldername(name))[1] = public.get_my_professional_id()::text
    )
  );

CREATE POLICY "Pros can update own document files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'professional-documents'
    AND (
      public.is_manager(auth.uid())
      OR (storage.foldername(name))[1] = public.get_my_professional_id()::text
    )
  );

CREATE POLICY "Pros can delete own document files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'professional-documents'
    AND (
      public.is_manager(auth.uid())
      OR (storage.foldername(name))[1] = public.get_my_professional_id()::text
    )
  );