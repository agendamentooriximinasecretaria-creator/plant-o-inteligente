/**
 * Catálogos clínicos centralizados — usados no cadastro de profissionais
 * e na sugestão automática de conselho, especialidade e competências.
 *
 * Importante: PROFISSAO_VALUES segue o enum `profissao_type` do banco.
 * Para perfis não-clínicos (recepção, administrativo, gestão), usamos
 * 'outro' como profissão e o título real fica em `cargo`.
 */

export type ProfissaoValue =
  | 'medico'
  | 'enfermeiro'
  | 'fisioterapeuta'
  | 'tecnico_enfermagem'
  | 'biomedico'
  | 'psicologo'
  | 'terapeuta_ocupacional'
  | 'nutricionista'
  | 'fonoaudiologo'
  | 'farmaceutico'
  | 'outro';

export const PROFISSAO_OPTIONS: { value: ProfissaoValue; label: string }[] = [
  { value: 'medico', label: 'Médico(a)' },
  { value: 'enfermeiro', label: 'Enfermeiro(a)' },
  { value: 'tecnico_enfermagem', label: 'Técnico(a) de Enfermagem' },
  { value: 'fisioterapeuta', label: 'Fisioterapeuta' },
  { value: 'fonoaudiologo', label: 'Fonoaudiólogo(a)' },
  { value: 'psicologo', label: 'Psicólogo(a)' },
  { value: 'terapeuta_ocupacional', label: 'Terapeuta Ocupacional' },
  { value: 'nutricionista', label: 'Nutricionista' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
  { value: 'biomedico', label: 'Biomédico(a)' },
  { value: 'outro', label: 'Outro' },
];

export const PROFISSAO_LABELS: Record<ProfissaoValue, string> = Object.fromEntries(
  PROFISSAO_OPTIONS.map(p => [p.value, p.label]),
) as Record<ProfissaoValue, string>;

/** Cargos / funções sugeridas (genérico, vale para qualquer profissão). */
export const CARGO_OPTIONS: string[] = [
  'Plantonista',
  'Coordenador(a)',
  'Responsável Técnico',
  'Diretor(a)',
  'Supervisor(a)',
  'Profissional Assistencial',
  'Profissional Administrativo',
  'Recepção',
  'Triagem',
  'Evolução Clínica',
  'Atendimento Ambulatorial',
  'Atendimento CER',
  'Regulação',
  'Apoio Técnico',
];

/** Conselho de classe por profissão. */
export const CONSELHO_BY_PROFISSAO: Record<ProfissaoValue, string> = {
  medico: 'CRM',
  enfermeiro: 'COREN',
  tecnico_enfermagem: 'COREN',
  fisioterapeuta: 'CREFITO',
  terapeuta_ocupacional: 'CREFITO',
  fonoaudiologo: 'CREFONO',
  psicologo: 'CRP',
  nutricionista: 'CRN',
  farmaceutico: 'CRF',
  biomedico: 'CRBM',
  outro: '',
};

/** Placeholder/exemplo do número de registro por conselho. */
export const REGISTRO_PLACEHOLDER_BY_CONSELHO: Record<string, string> = {
  CRM: 'Ex: 12345',
  COREN: 'Ex: 123456',
  CREFITO: 'Ex: 123456-F',
  CREFONO: 'Ex: 12345',
  CRP: 'Ex: 10/12345',
  CRN: 'Ex: 12345',
  CRF: 'Ex: 12345',
  CRBM: 'Ex: 12345',
  CRO: 'Ex: 12345',
  CREF: 'Ex: 012345-G/PA',
  CRESS: 'Ex: 12345',
};

/** Especialidades por profissão (não exaustivas — sempre fornece "Outro"). */
export const ESPECIALIDADE_BY_PROFISSAO: Record<ProfissaoValue, string[]> = {
  medico: [
    'Clínica Geral', 'Medicina de Família', 'Pediatria', 'Ginecologia e Obstetrícia',
    'Ortopedia', 'Traumatologia', 'Cardiologia', 'Neurologia', 'Psiquiatria',
    'Urologia', 'Infectologia', 'Cirurgia Geral', 'Medicina do Trabalho',
    'Urgência e Emergência', 'Terapia Intensiva',
  ],
  enfermeiro: [
    'Urgência e Emergência', 'Saúde do Trabalhador', 'Saúde Pública',
    'Atenção Básica', 'Reabilitação', 'Triagem', 'Feridas e Curativos',
    'Educação Continuada', 'Coordenação de Enfermagem',
  ],
  tecnico_enfermagem: [
    'Urgência e Emergência', 'Sala de Medicação', 'Curativos', 'Triagem',
    'Educação Continuada', 'Plantão Hospitalar', 'Apoio Assistencial',
  ],
  fisioterapeuta: [
    'Fisioterapia Motora', 'Fisioterapia Neurofuncional', 'Fisioterapia Respiratória',
    'Traumato-Ortopédica', 'Reabilitação Física', 'Pediátrica', 'Geriátrica',
  ],
  fonoaudiologo: [
    'Linguagem', 'Motricidade Orofacial', 'Disfagia', 'Voz', 'Audiologia',
    'Reabilitação Intelectual', 'Reabilitação Física',
  ],
  psicologo: [
    'Clínica', 'Hospitalar', 'Neuropsicologia', 'Saúde Mental',
    'Reabilitação', 'Infantil',
  ],
  terapeuta_ocupacional: [
    'Saúde Mental', 'Reabilitação Física', 'Pediatria', 'Geriatria', 'Hospitalar',
  ],
  nutricionista: [
    'Clínica', 'Hospitalar', 'Esportiva', 'Saúde Pública', 'Pediátrica',
  ],
  farmaceutico: [
    'Hospitalar', 'Clínica', 'Manipulação', 'Oncologia',
  ],
  biomedico: [
    'Análises Clínicas', 'Hemoterapia', 'Imunologia', 'Microbiologia',
  ],
  outro: [],
};

/** Competências / certificações por profissão. */
export const COMPETENCIAS_BY_PROFISSAO: Record<ProfissaoValue, string[]> = {
  medico: [
    'Clínica Geral', 'Emergência', 'UTI', 'Pediatria', 'Cirurgia',
    'Obstetrícia', 'Cardiologia', 'Ortopedia', 'Infectologia',
  ],
  enfermeiro: [
    'Triagem', 'Classificação de Risco', 'Urgência e Emergência',
    'Curativos', 'Feridas', 'Saúde do Trabalhador', 'Reabilitação',
    'Gestão de Equipe',
  ],
  tecnico_enfermagem: [
    'Medicação', 'Sinais Vitais', 'Curativos', 'Sala Vermelha',
    'Apoio à Triagem', 'Plantão Hospitalar',
  ],
  fisioterapeuta: [
    'Fisioterapia Motora', 'Respiratória', 'Neurofuncional',
    'Traumato-Ortopédica', 'Reabilitação Física', 'Atendimento Individual',
    'Atendimento em Grupo',
  ],
  fonoaudiologo: [
    'Linguagem', 'Disfagia', 'Voz', 'Motricidade Orofacial',
    'Audiologia', 'Reabilitação Intelectual',
  ],
  psicologo: [
    'Psicoterapia', 'Avaliação Psicológica', 'Saúde Mental',
    'Reabilitação', 'Atendimento Familiar', 'Grupo Terapêutico',
  ],
  terapeuta_ocupacional: [
    'Reabilitação Física', 'Saúde Mental', 'Pediátrica',
    'Geriátrica', 'Atendimento em Grupo',
  ],
  nutricionista: [
    'Avaliação Nutricional', 'Dietas Hospitalares', 'Suporte Enteral',
    'Pediátrica', 'Saúde Pública',
  ],
  farmaceutico: [
    'Hospitalar', 'Clínica', 'Manipulação', 'Oncologia', 'Farmacovigilância',
  ],
  biomedico: [
    'Análises Clínicas', 'Hemoterapia', 'Imunologia', 'Microbiologia',
  ],
  outro: [],
};

/** Sugestão de perfil de acesso conforme profissão / cargo. */
export function sugerirRoleAcesso(profissao?: string | null, cargo?: string | null):
  'gestor_master' | 'coordenador' | 'profissional' {
  const c = (cargo || '').toLowerCase();
  if (c.includes('diretor')) return 'gestor_master';
  if (c.includes('coordenador') || c.includes('responsável técnico') || c.includes('responsavel tecnico')) {
    return 'coordenador';
  }
  if (profissao && profissao !== 'outro') return 'profissional';
  return 'profissional';
}
