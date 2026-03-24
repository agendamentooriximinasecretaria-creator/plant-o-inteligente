
-- Tabela de níveis de ocupação por setor
CREATE TABLE IF NOT EXISTS setor_ocupacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id UUID REFERENCES sectors(id) ON DELETE CASCADE NOT NULL,
  nivel VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (nivel IN ('normal','atencao','lotado','superlotado')),
  pacientes_atual INTEGER NOT NULL DEFAULT 0,
  capacidade_maxima INTEGER NOT NULL DEFAULT 20,
  atualizado_por UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(setor_id)
);

-- Tabela de acionamentos de reforço
CREATE TABLE IF NOT EXISTS acionamentos_reforco (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_origem_id UUID REFERENCES sectors(id) NOT NULL,
  setor_destino_id UUID REFERENCES sectors(id),
  profissional_id UUID REFERENCES professionals(id) NOT NULL,
  acionado_por UUID,
  motivo TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','confirmado','recusado','cancelado','concluido')),
  prioridade VARCHAR(10) NOT NULL DEFAULT 'alta' CHECK (prioridade IN ('normal','alta','critica')),
  resposta_em TIMESTAMPTZ,
  justificativa_recusa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de ocupação para relatórios
CREATE TABLE IF NOT EXISTS historico_ocupacao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id UUID REFERENCES sectors(id) ON DELETE CASCADE NOT NULL,
  nivel VARCHAR(20) NOT NULL,
  pacientes INTEGER NOT NULL DEFAULT 0,
  registrado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE setor_ocupacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE acionamentos_reforco ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_ocupacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_setor_ocupacao" ON setor_ocupacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers_manage_setor_ocupacao" ON setor_ocupacao FOR ALL TO authenticated USING (is_manager(auth.uid())) WITH CHECK (is_manager(auth.uid()));

CREATE POLICY "authenticated_read_acionamentos" ON acionamentos_reforco FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers_insert_acionamentos" ON acionamentos_reforco FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));
CREATE POLICY "managers_update_acionamentos" ON acionamentos_reforco FOR UPDATE TO authenticated USING (true);

CREATE POLICY "authenticated_read_historico" ON historico_ocupacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers_insert_historico" ON historico_ocupacao FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE setor_ocupacao;
ALTER PUBLICATION supabase_realtime ADD TABLE acionamentos_reforco;

-- Seed initial occupancy from existing sectors
INSERT INTO setor_ocupacao (setor_id, nivel, pacientes_atual, capacidade_maxima)
SELECT id, 'normal', 0, 20 FROM sectors
ON CONFLICT (setor_id) DO NOTHING;
