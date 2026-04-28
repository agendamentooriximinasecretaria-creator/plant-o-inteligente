-- Enum para tipo de documento
DO $$ BEGIN
  CREATE TYPE public.document_template_type AS ENUM (
    'escala_mensal_oficial',
    'escala_semanal',
    'comprovante_plantao',
    'solicitacao_troca',
    'aprovacao_troca',
    'recusa_troca',
    'declaracao_comparecimento',
    'relatorio_plantoes',
    'relatorio_horas',
    'ficha_profissional',
    'personalizado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum para escopo
DO $$ BEGIN
  CREATE TYPE public.document_template_scope AS ENUM ('global', 'unidade', 'setor', 'pessoal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo public.document_template_type NOT NULL,
  descricao text,
  sigla text,

  -- Escopo
  escopo public.document_template_scope NOT NULL DEFAULT 'global',
  unidade_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  setor_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
  owner_profissional_id uuid REFERENCES public.professionals(id) ON DELETE CASCADE,

  -- Permissões (perfis que podem usar/editar)
  perfis_uso text[] NOT NULL DEFAULT ARRAY['gestor_master','coordenador','profissional_saude'],
  perfis_edicao text[] NOT NULL DEFAULT ARRAY['gestor_master'],

  -- Conteúdo
  conteudo_html text NOT NULL DEFAULT '',
  abnt_config jsonb NOT NULL DEFAULT '{
    "pageSize": "A4",
    "orientation": "portrait",
    "margins": {"top": 30, "right": 20, "bottom": 25, "left": 30},
    "font": "Times",
    "fontSize": 12,
    "lineHeight": 1.5,
    "align": "justify",
    "indent": 1.25,
    "header": {"enabled": true, "text": "", "showLogo": true},
    "footer": {"enabled": true, "text": "", "showPageNumber": true},
    "signature": {"enabled": true, "text": "", "imageUrl": null},
    "stamp": {"enabled": false, "imageUrl": null}
  }'::jsonb,
  variaveis_disponiveis text[] DEFAULT ARRAY[]::text[],

  -- Status
  ativo boolean NOT NULL DEFAULT true,
  is_system_default boolean NOT NULL DEFAULT false,
  is_personalizado boolean NOT NULL DEFAULT false,
  versao integer NOT NULL DEFAULT 1,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_templates_tipo ON public.document_templates(tipo);
CREATE INDEX IF NOT EXISTS idx_doc_templates_escopo ON public.document_templates(escopo);
CREATE INDEX IF NOT EXISTS idx_doc_templates_unidade ON public.document_templates(unidade_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_setor ON public.document_templates(setor_id);
CREATE INDEX IF NOT EXISTS idx_doc_templates_owner ON public.document_templates(owner_profissional_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_doc_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_doc_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de auditoria
CREATE OR REPLACE FUNCTION public.audit_document_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao text;
  v_nome text;
  v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := 'criou_modelo_documento';
    v_nome := NEW.nome;
    v_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'editou_modelo_documento';
    v_nome := NEW.nome;
    v_id := NEW.id;
  ELSE
    v_acao := 'excluiu_modelo_documento';
    v_nome := OLD.nome;
    v_id := OLD.id;
  END IF;

  INSERT INTO public.audit_logs (modulo, acao, user_id, usuario_nome, status, detalhes)
  VALUES (
    'configuracoes_modelos',
    v_acao,
    auth.uid(),
    COALESCE((SELECT nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'sistema'),
    'sucesso',
    jsonb_build_object('template_id', v_id, 'nome', v_nome, 'tipo', COALESCE(NEW.tipo, OLD.tipo))
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_document_templates ON public.document_templates;
CREATE TRIGGER trg_audit_document_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_document_templates();

-- Proteção: não permitir excluir modelos do sistema
CREATE OR REPLACE FUNCTION public.protect_system_default_templates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_system_default THEN
    RAISE EXCEPTION 'Modelos padrão do sistema não podem ser excluídos. Duplique e edite a cópia.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_system_templates ON public.document_templates;
CREATE TRIGGER trg_protect_system_templates
  BEFORE DELETE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_default_templates();

-- RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: usuários veem modelos ativos do seu escopo
CREATE POLICY "Users read templates in their scope"
ON public.document_templates
FOR SELECT
TO authenticated
USING (
  ativo = true
  AND (
    is_manager(auth.uid())
    OR escopo = 'global'
    OR (escopo = 'unidade' AND unidade_id IN (
      SELECT unidade_principal_id FROM public.professionals WHERE user_id = auth.uid()
    ))
    OR (escopo = 'setor' AND setor_id IN (
      SELECT setor_principal_id FROM public.professionals WHERE user_id = auth.uid()
    ))
    OR (escopo = 'pessoal' AND owner_profissional_id = get_my_professional_id())
  )
);

-- INSERT: master cria qualquer; coordenador cria unidade/setor; profissional cria pessoal
CREATE POLICY "Master can insert any template"
ON public.document_templates
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'gestor_master'::app_role));

CREATE POLICY "Coordenador can insert unit/sector templates"
ON public.document_templates
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'coordenador'::app_role)
  AND escopo IN ('unidade','setor')
  AND is_system_default = false
);

CREATE POLICY "Professional can insert personal templates"
ON public.document_templates
FOR INSERT
TO authenticated
WITH CHECK (
  escopo = 'pessoal'
  AND owner_profissional_id = get_my_professional_id()
  AND is_system_default = false
);

-- UPDATE
CREATE POLICY "Master can update any template"
ON public.document_templates
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gestor_master'::app_role));

CREATE POLICY "Coordenador can update unit/sector templates"
ON public.document_templates
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador'::app_role)
  AND escopo IN ('unidade','setor')
  AND is_system_default = false
);

CREATE POLICY "Professional can update own personal templates"
ON public.document_templates
FOR UPDATE
TO authenticated
USING (
  escopo = 'pessoal'
  AND owner_profissional_id = get_my_professional_id()
);

-- DELETE
CREATE POLICY "Master can delete non-system templates"
ON public.document_templates
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'gestor_master'::app_role)
  AND is_system_default = false
);

CREATE POLICY "Coordenador can delete unit/sector non-system templates"
ON public.document_templates
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador'::app_role)
  AND escopo IN ('unidade','setor')
  AND is_system_default = false
);

CREATE POLICY "Professional can delete own personal templates"
ON public.document_templates
FOR DELETE
TO authenticated
USING (
  escopo = 'pessoal'
  AND owner_profissional_id = get_my_professional_id()
);

-- Seeds: modelos padrão do sistema (1 por tipo) — apenas se ainda não existirem
INSERT INTO public.document_templates (nome, tipo, descricao, escopo, is_system_default, ativo, perfis_uso, perfis_edicao, variaveis_disponiveis, conteudo_html)
SELECT * FROM (VALUES
  ('Escala Mensal Oficial (Padrão)', 'escala_mensal_oficial'::document_template_type, 'Modelo oficial mensal no padrão ABNT.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['unidade','mes','ano','responsavel','cnpj','data_emissao'], '<h1 style="text-align:center">ESCALA MENSAL DE PLANTÕES</h1><p style="text-align:center"><strong>{{unidade}}</strong><br/>Mês de referência: {{mes}}/{{ano}}</p><p>{{tabela_escala}}</p><p style="margin-top:48px;text-align:center">_______________________________<br/>{{responsavel}}</p>'),
  ('Escala Semanal (Padrão)', 'escala_semanal'::document_template_type, 'Modelo semanal.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['unidade','semana_inicio','semana_fim','responsavel'], '<h1 style="text-align:center">ESCALA SEMANAL</h1><p style="text-align:center"><strong>{{unidade}}</strong><br/>{{semana_inicio}} a {{semana_fim}}</p>{{tabela_escala}}'),
  ('Comprovante de Plantão (Padrão)', 'comprovante_plantao'::document_template_type, 'Comprovante individual de plantão realizado.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador','profissional_saude'], ARRAY['gestor_master'], ARRAY['profissional_nome','profissao','registro','data_plantao','hora_inicio','hora_fim','setor','unidade'], '<h1 style="text-align:center">COMPROVANTE DE PLANTÃO</h1><p>Atestamos que <strong>{{profissional_nome}}</strong>, {{profissao}}, registro {{registro}}, realizou plantão no setor {{setor}} da unidade {{unidade}} em {{data_plantao}}, das {{hora_inicio}} às {{hora_fim}}.</p>'),
  ('Solicitação de Troca (Padrão)', 'solicitacao_troca'::document_template_type, 'Modelo para solicitação de troca de plantão.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador','profissional_saude'], ARRAY['gestor_master'], ARRAY['solicitante','destinatario','data_origem','data_destino','motivo'], '<h1 style="text-align:center">SOLICITAÇÃO DE TROCA DE PLANTÃO</h1><p>Solicitante: {{solicitante}}</p><p>Destinatário: {{destinatario}}</p><p>Plantão a ceder: {{data_origem}}</p><p>Plantão a receber: {{data_destino}}</p><p>Motivo: {{motivo}}</p>'),
  ('Aprovação de Troca (Padrão)', 'aprovacao_troca'::document_template_type, 'Modelo de aprovação de troca.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['solicitante','destinatario','aprovado_por','data_aprovacao'], '<h1 style="text-align:center">APROVAÇÃO DE TROCA</h1><p>Troca aprovada por {{aprovado_por}} em {{data_aprovacao}}.</p>'),
  ('Recusa de Troca (Padrão)', 'recusa_troca'::document_template_type, 'Modelo de recusa de troca.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['solicitante','recusado_por','motivo_recusa','data_recusa'], '<h1 style="text-align:center">RECUSA DE TROCA</h1><p>Solicitação de {{solicitante}} recusada por {{recusado_por}} em {{data_recusa}}.</p><p>Motivo: {{motivo_recusa}}</p>'),
  ('Declaração de Comparecimento (Padrão)', 'declaracao_comparecimento'::document_template_type, 'Declaração de comparecimento ao plantão.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador','profissional_saude'], ARRAY['gestor_master'], ARRAY['profissional_nome','data','hora_inicio','hora_fim','setor'], '<h1 style="text-align:center">DECLARAÇÃO DE COMPARECIMENTO</h1><p>Declaramos para os devidos fins que <strong>{{profissional_nome}}</strong> compareceu ao plantão em {{data}}, das {{hora_inicio}} às {{hora_fim}}, no setor {{setor}}.</p>'),
  ('Relatório de Plantões (Padrão)', 'relatorio_plantoes'::document_template_type, 'Relatório consolidado de plantões.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['periodo_inicio','periodo_fim','unidade'], '<h1 style="text-align:center">RELATÓRIO DE PLANTÕES</h1><p>Período: {{periodo_inicio}} a {{periodo_fim}}</p><p>Unidade: {{unidade}}</p>{{tabela_relatorio}}'),
  ('Relatório de Horas (Padrão)', 'relatorio_horas'::document_template_type, 'Relatório de horas trabalhadas.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['profissional_nome','periodo_inicio','periodo_fim','horas_realizadas','horas_previstas'], '<h1 style="text-align:center">RELATÓRIO DE HORAS</h1><p>Profissional: {{profissional_nome}}</p><p>Período: {{periodo_inicio}} a {{periodo_fim}}</p><p>Horas realizadas: {{horas_realizadas}} / Previstas: {{horas_previstas}}</p>'),
  ('Ficha do Profissional (Padrão)', 'ficha_profissional'::document_template_type, 'Ficha resumida do profissional.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['profissional_nome','profissao','registro','vinculo','setor_principal','unidade_principal'], '<h1 style="text-align:center">FICHA DO PROFISSIONAL</h1><p><strong>Nome:</strong> {{profissional_nome}}</p><p><strong>Profissão:</strong> {{profissao}}</p><p><strong>Registro:</strong> {{registro}}</p><p><strong>Vínculo:</strong> {{vinculo}}</p><p><strong>Setor:</strong> {{setor_principal}}</p><p><strong>Unidade:</strong> {{unidade_principal}}</p>'),
  ('Documento Personalizado (Padrão)', 'personalizado'::document_template_type, 'Modelo em branco para documento livre.', 'global'::document_template_scope, true, true, ARRAY['gestor_master','coordenador'], ARRAY['gestor_master'], ARRAY['data_emissao','responsavel','unidade'], '<h1 style="text-align:center">DOCUMENTO</h1><p>{{conteudo_livre}}</p>')
) AS v(nome, tipo, descricao, escopo, is_system_default, ativo, perfis_uso, perfis_edicao, variaveis_disponiveis, conteudo_html)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates dt WHERE dt.is_system_default = true AND dt.tipo = v.tipo
);