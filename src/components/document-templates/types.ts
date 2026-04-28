export type DocumentTemplateType =
  | 'escala_mensal_oficial'
  | 'escala_semanal'
  | 'comprovante_plantao'
  | 'solicitacao_troca'
  | 'aprovacao_troca'
  | 'recusa_troca'
  | 'declaracao_comparecimento'
  | 'relatorio_plantoes'
  | 'relatorio_horas'
  | 'ficha_profissional'
  | 'personalizado';

export type DocumentScope = 'global' | 'unidade' | 'setor' | 'pessoal';

export interface ABNTConfig {
  pageSize: 'A4';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  font: 'Times' | 'Arial' | 'Helvetica' | 'Courier';
  fontSize: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right' | 'justify';
  indent: number;
  header: { enabled: boolean; text: string; showLogo: boolean };
  footer: { enabled: boolean; text: string; showPageNumber: boolean };
  signature: { enabled: boolean; text: string; imageUrl: string | null };
  stamp: { enabled: boolean; imageUrl: string | null };
}

export interface DocumentTemplate {
  id: string;
  nome: string;
  tipo: DocumentTemplateType;
  descricao: string | null;
  sigla: string | null;
  escopo: DocumentScope;
  unidade_id: string | null;
  setor_id: string | null;
  owner_profissional_id: string | null;
  perfis_uso: string[];
  perfis_edicao: string[];
  conteudo_html: string;
  abnt_config: ABNTConfig;
  variaveis_disponiveis: string[];
  ativo: boolean;
  is_system_default: boolean;
  is_personalizado: boolean;
  versao: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const TIPO_LABEL: Record<DocumentTemplateType, string> = {
  escala_mensal_oficial: 'Escala mensal oficial',
  escala_semanal: 'Escala semanal',
  comprovante_plantao: 'Comprovante de plantão',
  solicitacao_troca: 'Solicitação de troca',
  aprovacao_troca: 'Aprovação de troca',
  recusa_troca: 'Recusa de troca',
  declaracao_comparecimento: 'Declaração de comparecimento',
  relatorio_plantoes: 'Relatório de plantões',
  relatorio_horas: 'Relatório de horas',
  ficha_profissional: 'Ficha do profissional',
  personalizado: 'Documento personalizado',
};

export const VARIAVEIS_PADRAO: Record<DocumentTemplateType, string[]> = {
  escala_mensal_oficial: ['unidade', 'setor', 'mes', 'ano', 'responsavel', 'cnpj', 'data_emissao', 'tabela_escala'],
  escala_semanal: ['unidade', 'semana_inicio', 'semana_fim', 'responsavel', 'tabela_escala'],
  comprovante_plantao: ['profissional_nome', 'profissao', 'registro', 'data_plantao', 'hora_inicio', 'hora_fim', 'setor', 'unidade'],
  solicitacao_troca: ['solicitante', 'destinatario', 'data_origem', 'data_destino', 'motivo'],
  aprovacao_troca: ['solicitante', 'destinatario', 'aprovado_por', 'data_aprovacao'],
  recusa_troca: ['solicitante', 'recusado_por', 'motivo_recusa', 'data_recusa'],
  declaracao_comparecimento: ['profissional_nome', 'data', 'hora_inicio', 'hora_fim', 'setor'],
  relatorio_plantoes: ['periodo_inicio', 'periodo_fim', 'unidade', 'tabela_relatorio'],
  relatorio_horas: ['profissional_nome', 'periodo_inicio', 'periodo_fim', 'horas_realizadas', 'horas_previstas'],
  ficha_profissional: ['profissional_nome', 'profissao', 'registro', 'vinculo', 'setor_principal', 'unidade_principal'],
  personalizado: ['data_emissao', 'responsavel', 'unidade', 'conteudo_livre'],
};

export const DEFAULT_ABNT: ABNTConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 30, right: 20, bottom: 25, left: 30 },
  font: 'Times',
  fontSize: 12,
  lineHeight: 1.5,
  align: 'justify',
  indent: 1.25,
  header: { enabled: true, text: '', showLogo: true },
  footer: { enabled: true, text: '', showPageNumber: true },
  signature: { enabled: true, text: '', imageUrl: null },
  stamp: { enabled: false, imageUrl: null },
};
