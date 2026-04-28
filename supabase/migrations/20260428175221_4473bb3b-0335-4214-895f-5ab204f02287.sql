-- Garantir que a remoção de unidades preserve dados históricos e não seja bloqueada por vínculos ativos

-- Plantões precisam aceitar referência vazia quando a unidade/setor é removido
ALTER TABLE public.shifts
  ALTER COLUMN unidade_id DROP NOT NULL,
  ALTER COLUMN setor_id DROP NOT NULL;

-- Acionamentos históricos precisam aceitar setor de origem vazio quando o setor for removido junto com a unidade
ALTER TABLE public.acionamentos_reforco
  ALTER COLUMN setor_origem_id DROP NOT NULL;

-- Profissionais: remover setor principal sem apagar o profissional
ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_setor_principal_id_fkey;

ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_setor_principal_id_fkey
  FOREIGN KEY (setor_principal_id)
  REFERENCES public.sectors(id)
  ON DELETE SET NULL;

-- Plantões: preservar histórico quando setor for removido
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_setor_id_fkey;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_setor_id_fkey
  FOREIGN KEY (setor_id)
  REFERENCES public.sectors(id)
  ON DELETE SET NULL;

-- Plantões: garantir preservação quando unidade for removida
ALTER TABLE public.shifts
  DROP CONSTRAINT IF EXISTS shifts_unidade_id_fkey;

ALTER TABLE public.shifts
  ADD CONSTRAINT shifts_unidade_id_fkey
  FOREIGN KEY (unidade_id)
  REFERENCES public.units(id)
  ON DELETE SET NULL;

-- Acionamentos: preservar histórico quando setores forem removidos
ALTER TABLE public.acionamentos_reforco
  DROP CONSTRAINT IF EXISTS acionamentos_reforco_setor_origem_id_fkey;

ALTER TABLE public.acionamentos_reforco
  ADD CONSTRAINT acionamentos_reforco_setor_origem_id_fkey
  FOREIGN KEY (setor_origem_id)
  REFERENCES public.sectors(id)
  ON DELETE SET NULL;

ALTER TABLE public.acionamentos_reforco
  DROP CONSTRAINT IF EXISTS acionamentos_reforco_setor_destino_id_fkey;

ALTER TABLE public.acionamentos_reforco
  ADD CONSTRAINT acionamentos_reforco_setor_destino_id_fkey
  FOREIGN KEY (setor_destino_id)
  REFERENCES public.sectors(id)
  ON DELETE SET NULL;