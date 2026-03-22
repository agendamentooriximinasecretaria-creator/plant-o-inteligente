
-- Add competencias array to professionals
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS competencias text[] DEFAULT '{}';

-- Create censo_pacientes table for daily patient census per sector
CREATE TABLE IF NOT EXISTS censo_pacientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id uuid REFERENCES sectors(id) ON DELETE CASCADE NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  leitos_ocupados integer NOT NULL DEFAULT 0,
  proporcao_minima numeric(4,2) DEFAULT 0.50,
  registrado_por uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(setor_id, data)
);

ALTER TABLE censo_pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read censo"
  ON censo_pacientes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can manage censo"
  ON censo_pacientes FOR ALL TO authenticated
  USING (is_manager(auth.uid()))
  WITH CHECK (is_manager(auth.uid()));
