export type UserRole = 'gestor_master' | 'coordenador' | 'profissional';

export type Profissao =
  | 'medico' | 'enfermeiro' | 'fisioterapeuta' | 'tecnico_enfermagem'
  | 'biomedico' | 'psicologo' | 'terapeuta_ocupacional' | 'nutricionista'
  | 'fonoaudiologo' | 'farmaceutico' | 'outro';

export const PROFISSAO_LABELS: Record<Profissao, string> = {
  medico: 'Médico(a)',
  enfermeiro: 'Enfermeiro(a)',
  fisioterapeuta: 'Fisioterapeuta',
  tecnico_enfermagem: 'Téc. Enfermagem',
  biomedico: 'Biomédico(a)',
  psicologo: 'Psicólogo(a)',
  terapeuta_ocupacional: 'Terapeuta Ocupacional',
  nutricionista: 'Nutricionista',
  fonoaudiologo: 'Fonoaudiólogo(a)',
  farmaceutico: 'Farmacêutico(a)',
  outro: 'Outro',
};

export type ShiftStatus = 'agendado' | 'confirmado' | 'pendente' | 'em_aberto' | 'trocando' | 'concluido' | 'cancelado';

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  em_aberto: 'Em Aberto',
  trocando: 'Em Troca',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export type SwapStatus = 'solicitada' | 'aguardando_resposta' | 'aceita' | 'recusada' | 'aguardando_aprovacao' | 'aprovada' | 'rejeitada' | 'cancelada' | 'concluida';

export const SWAP_STATUS_LABELS: Record<SwapStatus, string> = {
  solicitada: 'Solicitada',
  aguardando_resposta: 'Aguardando Resposta',
  aceita: 'Aceita',
  recusada: 'Recusada',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
};

export interface Professional {
  id: string;
  nome: string;
  profissao: Profissao;
  especialidade: string;
  conselho: string;
  registro: string;
  cpf: string;
  telefone: string;
  email: string;
  unidadePrincipal: string;
  setorPrincipal: string;
  status: 'ativo' | 'inativo';
  limiteTrocasPlantaoMes?: number;
  limiteTrocasPacienteMes?: number;
  avatar?: string;
}

export interface Shift {
  id: string;
  unidade: string;
  setor: string;
  profissao: Profissao;
  profissionalId: string;
  profissionalNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  cargaHoraria: number;
  tipoPlantao: string;
  status: ShiftStatus;
  observacoes?: string;
}

export interface ShiftSwap {
  id: string;
  plantaoId: string;
  solicitanteId: string;
  solicitanteNome: string;
  destinatarioId?: string;
  destinatarioNome?: string;
  motivo: string;
  status: SwapStatus;
  criadoEm: string;
  atualizadoEm: string;
  historico: SwapHistoryEntry[];
}

export interface SwapHistoryEntry {
  acao: string;
  usuario: string;
  dataHora: string;
  detalhes?: string;
}

export interface ActivityFeedItem {
  id: string;
  tipo: 'plantao_criado' | 'troca_solicitada' | 'troca_aceita' | 'troca_recusada' | 'troca_aprovada' | 'plantao_cancelado';
  descricao: string;
  usuario: string;
  dataHora: string;
}

export interface Unit {
  id: string;
  nome: string;
  tipo: string;
  endereco: string;
}

export interface Sector {
  id: string;
  nome: string;
  unidadeId: string;
  unidadeNome: string;
}
