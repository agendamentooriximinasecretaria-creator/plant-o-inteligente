-- Tabela de tipos de plantão configuráveis
CREATE TABLE IF NOT EXISTS public.shift_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  sigla TEXT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  carga_horaria NUMERIC NOT NULL DEFAULT 12,
  cor TEXT DEFAULT 'primary',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read shift_types"
ON public.shift_types FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage shift_types"
ON public.shift_types FOR ALL
TO authenticated
USING (is_manager(auth.uid()))
WITH CHECK (is_manager(auth.uid()));

CREATE TRIGGER update_shift_types_updated_at
BEFORE UPDATE ON public.shift_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed com os tipos padrão
INSERT INTO public.shift_types (nome, sigla, hora_inicio, hora_fim, carga_horaria, cor, ordem) VALUES
  ('Diurno 12h', 'D', '07:00', '19:00', 12, 'success', 1),
  ('Noturno 12h', 'N', '19:00', '07:00', 12, 'primary', 2),
  ('Manhã', 'M', '07:00', '13:00', 6, 'warning', 3),
  ('Tarde', 'T', '13:00', '19:00', 6, 'warning', 4),
  ('Noite', 'Nt', '19:00', '01:00', 6, 'primary', 5),
  ('Plantão 24h', '24', '07:00', '07:00', 24, 'destructive', 6),
  ('Sobreaviso', 'SA', '00:00', '23:59', 24, 'muted', 7),
  ('Folga', 'F', '00:00', '23:59', 0, 'muted', 99)
ON CONFLICT DO NOTHING;