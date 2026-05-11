-- Add new columns to professional_unavailability
ALTER TABLE public.professional_unavailability 
ADD COLUMN IF NOT EXISTS observacao_profissional TEXT,
ADD COLUMN IF NOT EXISTS documento_url TEXT,
ADD COLUMN IF NOT EXISTS tipo_gestor TEXT,
ADD COLUMN IF NOT EXISTS motivo_gestor TEXT,
ADD COLUMN IF NOT EXISTS substituto_id UUID REFERENCES public.professionals(id);

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('unavailability_docs', 'unavailability_docs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'unavailability_docs');
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'unavailability_docs' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated Delete" ON storage.objects FOR DELETE USING (bucket_id = 'unavailability_docs' AND auth.role() = 'authenticated');

-- Create or replace function for updated_at
CREATE OR REPLACE FUNCTION public.handle_unavailability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tr_professional_unavailability_updated_at ON public.professional_unavailability;
CREATE TRIGGER tr_professional_unavailability_updated_at
BEFORE UPDATE ON public.professional_unavailability
FOR EACH ROW
EXECUTE FUNCTION public.handle_unavailability_updated_at();
