import type { Professional, Shift, ShiftSwap, ActivityFeedItem, Unit, Sector } from '@/types/hospital';

export const units: Unit[] = [
  { id: 'u1', nome: 'Hospital Central São Lucas', tipo: 'Hospital', endereco: 'Av. Brasil, 1200' },
  { id: 'u2', nome: 'UPA Norte', tipo: 'UPA', endereco: 'Rua das Flores, 340' },
  { id: 'u3', nome: 'Maternidade Santa Clara', tipo: 'Maternidade', endereco: 'Rua Esperança, 78' },
  { id: 'u4', nome: 'Clínica São José', tipo: 'Clínica', endereco: 'Av. Saúde, 500' },
];

export const sectors: Sector[] = [
  { id: 's1', nome: 'UTI Adulto', unidadeId: 'u1', unidadeNome: 'Hospital Central São Lucas' },
  { id: 's2', nome: 'Pronto Socorro', unidadeId: 'u1', unidadeNome: 'Hospital Central São Lucas' },
  { id: 's3', nome: 'Pediatria', unidadeId: 'u1', unidadeNome: 'Hospital Central São Lucas' },
  { id: 's4', nome: 'Centro Cirúrgico', unidadeId: 'u1', unidadeNome: 'Hospital Central São Lucas' },
  { id: 's5', nome: 'Emergência', unidadeId: 'u2', unidadeNome: 'UPA Norte' },
  { id: 's6', nome: 'Sala de Parto', unidadeId: 'u3', unidadeNome: 'Maternidade Santa Clara' },
  { id: 's7', nome: 'Alojamento Conjunto', unidadeId: 'u3', unidadeNome: 'Maternidade Santa Clara' },
  { id: 's8', nome: 'Ambulatório', unidadeId: 'u4', unidadeNome: 'Clínica São José' },
];

export const professionals: Professional[] = [
  { id: 'p1', nome: 'Dr. Carlos Mendes', profissao: 'medico', especialidade: 'Cardiologia', conselho: 'CRM', registro: 'CRM-SP 123456', cpf: '123.456.789-00', telefone: '(11) 99999-1111', email: 'carlos.mendes@hospital.com', valorHora: 180, unidadePrincipal: 'Hospital Central São Lucas', setorPrincipal: 'UTI Adulto', status: 'ativo' },
  { id: 'p2', nome: 'Dra. Ana Beatriz Silva', profissao: 'medico', especialidade: 'Pediatria', conselho: 'CRM', registro: 'CRM-SP 234567', cpf: '234.567.890-11', telefone: '(11) 99999-2222', email: 'ana.silva@hospital.com', valorHora: 170, unidadePrincipal: 'Hospital Central São Lucas', setorPrincipal: 'Pediatria', status: 'ativo' },
  { id: 'p3', nome: 'Enf. Maria Santos', profissao: 'enfermeiro', especialidade: 'Terapia Intensiva', conselho: 'COREN', registro: 'COREN-SP 345678', cpf: '345.678.901-22', telefone: '(11) 99999-3333', email: 'maria.santos@hospital.com', valorHora: 85, unidadePrincipal: 'Hospital Central São Lucas', setorPrincipal: 'UTI Adulto', status: 'ativo' },
  { id: 'p4', nome: 'Dr. Roberto Almeida', profissao: 'medico', especialidade: 'Cirurgia Geral', conselho: 'CRM', registro: 'CRM-SP 456789', cpf: '456.789.012-33', telefone: '(11) 99999-4444', email: 'roberto.almeida@hospital.com', valorHora: 200, unidadePrincipal: 'Hospital Central São Lucas', setorPrincipal: 'Centro Cirúrgico', status: 'ativo' },
  { id: 'p5', nome: 'Ft. Juliana Costa', profissao: 'fisioterapeuta', especialidade: 'Respiratória', conselho: 'CREFITO', registro: 'CREFITO-3 567890', cpf: '567.890.123-44', telefone: '(11) 99999-5555', email: 'juliana.costa@hospital.com', valorHora: 90, unidadePrincipal: 'Hospital Central São Lucas', setorPrincipal: 'UTI Adulto', status: 'ativo' },
  { id: 'p6', nome: 'Téc. Pedro Lima', profissao: 'tecnico_enfermagem', especialidade: 'Geral', conselho: 'COREN', registro: 'COREN-SP 678901', cpf: '678.901.234-55', telefone: '(11) 99999-6666', email: 'pedro.lima@hospital.com', valorHora: 45, unidadePrincipal: 'UPA Norte', setorPrincipal: 'Emergência', status: 'ativo' },
  { id: 'p7', nome: 'Dra. Fernanda Oliveira', profissao: 'medico', especialidade: 'Obstetrícia', conselho: 'CRM', registro: 'CRM-SP 789012', cpf: '789.012.345-66', telefone: '(11) 99999-7777', email: 'fernanda.oliveira@hospital.com', valorHora: 190, unidadePrincipal: 'Maternidade Santa Clara', setorPrincipal: 'Sala de Parto', status: 'ativo' },
  { id: 'p8', nome: 'Enf. Lucas Rodrigues', profissao: 'enfermeiro', especialidade: 'Emergência', conselho: 'COREN', registro: 'COREN-SP 890123', cpf: '890.123.456-77', telefone: '(11) 99999-8888', email: 'lucas.rodrigues@hospital.com', valorHora: 80, unidadePrincipal: 'UPA Norte', setorPrincipal: 'Emergência', status: 'ativo' },
  { id: 'p9', nome: 'Psic. Camila Ferreira', profissao: 'psicologo', especialidade: 'Hospitalar', conselho: 'CRP', registro: 'CRP-06 901234', cpf: '901.234.567-88', telefone: '(11) 99999-9999', email: 'camila.ferreira@hospital.com', valorHora: 95, unidadePrincipal: 'Hospital Central São Lucas', setorPrincipal: 'Pediatria', status: 'ativo' },
  { id: 'p10', nome: 'Farm. Thiago Martins', profissao: 'farmaceutico', especialidade: 'Clínica', conselho: 'CRF', registro: 'CRF-SP 012345', cpf: '012.345.678-99', telefone: '(11) 99998-0000', email: 'thiago.martins@hospital.com', valorHora: 75, unidadePrincipal: 'Hospital Central São Lucas', setorPrincipal: 'UTI Adulto', status: 'inativo' },
];

const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

export const shifts: Shift[] = [
  { id: 'sh1', unidade: 'Hospital Central São Lucas', setor: 'UTI Adulto', profissao: 'medico', profissionalId: 'p1', profissionalNome: 'Dr. Carlos Mendes', data: fmt(today), horaInicio: '07:00', horaFim: '19:00', cargaHoraria: 12, tipoPlantao: 'Diurno', valorHora: 180, valorTotal: 2160, status: 'confirmado' },
  { id: 'sh2', unidade: 'Hospital Central São Lucas', setor: 'Pediatria', profissao: 'medico', profissionalId: 'p2', profissionalNome: 'Dra. Ana Beatriz Silva', data: fmt(today), horaInicio: '07:00', horaFim: '19:00', cargaHoraria: 12, tipoPlantao: 'Diurno', valorHora: 170, valorTotal: 2040, status: 'confirmado' },
  { id: 'sh3', unidade: 'Hospital Central São Lucas', setor: 'UTI Adulto', profissao: 'enfermeiro', profissionalId: 'p3', profissionalNome: 'Enf. Maria Santos', data: fmt(today), horaInicio: '19:00', horaFim: '07:00', cargaHoraria: 12, tipoPlantao: 'Noturno', valorHora: 85, valorTotal: 1020, status: 'agendado' },
  { id: 'sh4', unidade: 'Hospital Central São Lucas', setor: 'Centro Cirúrgico', profissao: 'medico', profissionalId: 'p4', profissionalNome: 'Dr. Roberto Almeida', data: fmt(addDays(today, 1)), horaInicio: '07:00', horaFim: '19:00', cargaHoraria: 12, tipoPlantao: 'Diurno', valorHora: 200, valorTotal: 2400, status: 'agendado' },
  { id: 'sh5', unidade: 'Hospital Central São Lucas', setor: 'UTI Adulto', profissao: 'fisioterapeuta', profissionalId: 'p5', profissionalNome: 'Ft. Juliana Costa', data: fmt(addDays(today, 1)), horaInicio: '07:00', horaFim: '13:00', cargaHoraria: 6, tipoPlantao: 'Manhã', valorHora: 90, valorTotal: 540, status: 'pendente' },
  { id: 'sh6', unidade: 'UPA Norte', setor: 'Emergência', profissao: 'tecnico_enfermagem', profissionalId: 'p6', profissionalNome: 'Téc. Pedro Lima', data: fmt(addDays(today, 2)), horaInicio: '19:00', horaFim: '07:00', cargaHoraria: 12, tipoPlantao: 'Noturno', valorHora: 45, valorTotal: 540, status: 'agendado' },
  { id: 'sh7', unidade: 'Maternidade Santa Clara', setor: 'Sala de Parto', profissao: 'medico', profissionalId: 'p7', profissionalNome: 'Dra. Fernanda Oliveira', data: fmt(addDays(today, 2)), horaInicio: '07:00', horaFim: '19:00', cargaHoraria: 12, tipoPlantao: 'Diurno', valorHora: 190, valorTotal: 2280, status: 'confirmado' },
  { id: 'sh8', unidade: 'UPA Norte', setor: 'Emergência', profissao: 'enfermeiro', profissionalId: 'p8', profissionalNome: 'Enf. Lucas Rodrigues', data: fmt(addDays(today, -1)), horaInicio: '07:00', horaFim: '19:00', cargaHoraria: 12, tipoPlantao: 'Diurno', valorHora: 80, valorTotal: 960, status: 'concluido' },
  { id: 'sh9', unidade: 'Hospital Central São Lucas', setor: 'Pediatria', profissao: 'psicologo', profissionalId: 'p9', profissionalNome: 'Psic. Camila Ferreira', data: fmt(addDays(today, 3)), horaInicio: '08:00', horaFim: '14:00', cargaHoraria: 6, tipoPlantao: 'Manhã', valorHora: 95, valorTotal: 570, status: 'pendente' },
  { id: 'sh10', unidade: 'Hospital Central São Lucas', setor: 'UTI Adulto', profissao: 'medico', profissionalId: 'p1', profissionalNome: 'Dr. Carlos Mendes', data: fmt(addDays(today, -2)), horaInicio: '19:00', horaFim: '07:00', cargaHoraria: 12, tipoPlantao: 'Noturno', valorHora: 180, valorTotal: 2160, status: 'concluido' },
  { id: 'sh11', unidade: 'Hospital Central São Lucas', setor: 'Centro Cirúrgico', profissao: 'medico', profissionalId: 'p4', profissionalNome: 'Dr. Roberto Almeida', data: fmt(addDays(today, -3)), horaInicio: '07:00', horaFim: '19:00', cargaHoraria: 12, tipoPlantao: 'Diurno', valorHora: 200, valorTotal: 2400, status: 'concluido' },
  { id: 'sh12', unidade: 'Hospital Central São Lucas', setor: 'Pediatria', profissao: 'medico', profissionalId: 'p2', profissionalNome: 'Dra. Ana Beatriz Silva', data: fmt(addDays(today, 4)), horaInicio: '19:00', horaFim: '07:00', cargaHoraria: 12, tipoPlantao: 'Noturno', valorHora: 170, valorTotal: 2040, status: 'agendado' },
  { id: 'sh13', unidade: 'Hospital Central São Lucas', setor: 'UTI Adulto', profissao: 'enfermeiro', profissionalId: 'p3', profissionalNome: 'Enf. Maria Santos', data: fmt(addDays(today, -1)), horaInicio: '07:00', horaFim: '19:00', cargaHoraria: 12, tipoPlantao: 'Diurno', valorHora: 85, valorTotal: 1020, status: 'cancelado' },
];

export const swaps: ShiftSwap[] = [
  {
    id: 'sw1', plantaoId: 'sh3', solicitanteId: 'p3', solicitanteNome: 'Enf. Maria Santos',
    destinatarioId: 'p8', destinatarioNome: 'Enf. Lucas Rodrigues',
    motivo: 'Consulta médica pessoal', status: 'aguardando_resposta',
    criadoEm: new Date(today.getTime() - 3600000).toISOString(),
    atualizadoEm: new Date(today.getTime() - 3600000).toISOString(),
    historico: [
      { acao: 'Troca solicitada', usuario: 'Enf. Maria Santos', dataHora: new Date(today.getTime() - 3600000).toISOString(), detalhes: 'Solicitou troca com Enf. Lucas Rodrigues' },
    ],
  },
  {
    id: 'sw2', plantaoId: 'sh5', solicitanteId: 'p5', solicitanteNome: 'Ft. Juliana Costa',
    motivo: 'Compromisso familiar', status: 'aprovada',
    criadoEm: new Date(today.getTime() - 86400000 * 2).toISOString(),
    atualizadoEm: new Date(today.getTime() - 86400000).toISOString(),
    historico: [
      { acao: 'Troca solicitada', usuario: 'Ft. Juliana Costa', dataHora: new Date(today.getTime() - 86400000 * 2).toISOString() },
      { acao: 'Troca aceita', usuario: 'Sistema', dataHora: new Date(today.getTime() - 86400000 * 1.5).toISOString() },
      { acao: 'Troca aprovada', usuario: 'Gestor Master', dataHora: new Date(today.getTime() - 86400000).toISOString() },
    ],
  },
  {
    id: 'sw3', plantaoId: 'sh1', solicitanteId: 'p1', solicitanteNome: 'Dr. Carlos Mendes',
    destinatarioId: 'p4', destinatarioNome: 'Dr. Roberto Almeida',
    motivo: 'Congresso médico', status: 'recusada',
    criadoEm: new Date(today.getTime() - 86400000 * 4).toISOString(),
    atualizadoEm: new Date(today.getTime() - 86400000 * 3).toISOString(),
    historico: [
      { acao: 'Troca solicitada', usuario: 'Dr. Carlos Mendes', dataHora: new Date(today.getTime() - 86400000 * 4).toISOString() },
      { acao: 'Troca recusada', usuario: 'Dr. Roberto Almeida', dataHora: new Date(today.getTime() - 86400000 * 3).toISOString(), detalhes: 'Já possuo plantão no mesmo horário' },
    ],
  },
];

export const activityFeed: ActivityFeedItem[] = [
  { id: 'a1', tipo: 'plantao_criado', descricao: 'Plantão criado na UTI Adulto', usuario: 'Gestor Master', dataHora: new Date(today.getTime() - 1800000).toISOString() },
  { id: 'a2', tipo: 'troca_solicitada', descricao: 'Troca solicitada por Enf. Maria Santos', usuario: 'Enf. Maria Santos', dataHora: new Date(today.getTime() - 3600000).toISOString() },
  { id: 'a3', tipo: 'troca_aprovada', descricao: 'Troca aprovada para Ft. Juliana Costa', usuario: 'Gestor Master', dataHora: new Date(today.getTime() - 86400000).toISOString() },
  { id: 'a4', tipo: 'troca_recusada', descricao: 'Troca recusada por Dr. Roberto Almeida', usuario: 'Dr. Roberto Almeida', dataHora: new Date(today.getTime() - 86400000 * 3).toISOString() },
  { id: 'a5', tipo: 'plantao_cancelado', descricao: 'Plantão cancelado na UTI Adulto', usuario: 'Gestor Master', dataHora: new Date(today.getTime() - 86400000).toISOString() },
  { id: 'a6', tipo: 'plantao_criado', descricao: 'Plantão noturno criado - Pediatria', usuario: 'Gestor Master', dataHora: new Date(today.getTime() - 86400000 * 2).toISOString() },
];
