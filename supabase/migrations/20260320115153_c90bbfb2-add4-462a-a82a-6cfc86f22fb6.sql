
-- Bloco 1: Cobertura mínima por setor
ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS min_profissionais_diurno INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_profissionais_noturno INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_profissionais_fds INTEGER DEFAULT 1;

-- Bloco 2: Validade de documentos em professionals
ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS documento_validade DATE,
  ADD COLUMN IF NOT EXISTS documento_numero VARCHAR(50),
  ADD COLUMN IF NOT EXISTS documento_conselho VARCHAR(20);
