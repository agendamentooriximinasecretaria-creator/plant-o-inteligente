import { useState, useEffect, useMemo, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCrossShifts } from "@/lib/queryInvalidation";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { Calendar, List, Clock, Plus, Trash2, Edit, ArrowLeftRight, Info, Users as UsersIcon, Palmtree, AlertTriangle, LayoutGrid } from "lucide-react";
import { WeeklyGrid, type ProfRow, type GridShift } from "@/components/schedule/WeeklyGrid";
import { ContactActionButton } from "@/components/ContactActionButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<string, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', pendente: 'Pendente',
  em_aberto: 'Em Aberto', trocando: 'Em Troca', interrompido: 'Interrompido',
  concluido: 'Concluído', cancelado: 'Cancelado',
};
const STATUS_CLASSES: Record<string, string> = {
  agendado: 'bg-info/10 text-info', confirmado: 'bg-success/10 text-success',
  pendente: 'bg-warning/10 text-warning', em_aberto: 'bg-muted text-muted-foreground',
  trocando: 'bg-primary/10 text-primary', interrompido: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  concluido: 'bg-accent/10 text-accent', cancelado: 'bg-destructive/10 text-destructive',
};
// Cor de fundo da célula no calendário por status
const STATUS_CELL_BG: Record<string, string> = {
  agendado: 'bg-info/15 border-info/40 text-info hover:bg-info/25',
  confirmado: 'bg-success/15 border-success/40 text-success hover:bg-success/25',
  pendente: 'bg-warning/15 border-warning/40 text-warning hover:bg-warning/25',
  em_aberto: 'bg-muted border-border text-muted-foreground hover:bg-muted/80',
  trocando: 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/25',
  interrompido: 'bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300 hover:bg-orange-500/25',
  concluido: 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25',
  cancelado: 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20 line-through',
};
const PROFISSAO_LABELS: Record<string, string> = {
  medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta',
  tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)',
  terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista',
  fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro',
};

// Tipos de plantão padrão (fallback se o banco estiver vazio durante o carregamento)
const TIPOS_PLANTAO_FALLBACK = [
  { value: 'Diurno 12h', sigla: 'D', start: '07:00', end: '19:00', carga: 12 },
  { value: 'Noturno 12h', sigla: 'N', start: '19:00', end: '07:00', carga: 12 },
  { value: 'Manhã', sigla: 'M', start: '07:00', end: '13:00', carga: 6 },
  { value: 'Tarde', sigla: 'T', start: '13:00', end: '19:00', carga: 6 },
  { value: 'Noite', sigla: 'No', start: '19:00', end: '01:00', carga: 6 },
  { value: 'Plantão 24h', sigla: '24', start: '07:00', end: '07:00', carga: 24 },
  { value: 'Sobreaviso', sigla: 'SA', start: '00:00', end: '23:59', carga: 24 },
];

const LIMITE_HORAS_MENSAL = 220;

const emptyForm = {
  unidade_id: '', setor_id: '', profissao: 'medico',
  profissional_ids: [] as string[],
  data: '', hora_inicio: '07:00', hora_fim: '19:00',
  tipo_plantao: 'Diurno 12h', observacoes: '', status: 'confirmado',
};

const emptyFolga = { profissional_id: '', data_inicio: '', data_fim: '', motivo: 'folga', observacoes: '' };

export default function EscalaPage() {
  const sb = supabase as any;
  const [view, setView] = useState<'lista' | 'calendario' | 'grade'>('lista');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [folgaModalOpen, setFolgaModalOpen] = useState(false);
  const [folgaForm, setFolgaForm] = useState(emptyFolga);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [restWarnings, setRestWarnings] = useState<string[]>([]);
  const [workloadAlerts, setWorkloadAlerts] = useState<string[]>([]);
  const [horasPorProfissional, setHorasPorProfissional] = useState<Record<string, number>>({});
  const [detailShift, setDetailShift] = useState<any>(null);
  const qc = useQueryClient();

  const { data: shifts = [], isLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao), units:unidade_id(nome), sectors:setor_id(nome)').order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Tipos de plantão configuráveis (gerenciados em /configuracoes)
  const { data: tiposDB = [] } = useQuery({
    queryKey: ['shift_types'],
    queryFn: async () => {
      const { data, error } = await sb.from('shift_types').select('*').eq('ativo', true).order('ordem', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const TIPOS_PLANTAO = useMemo(() => {
    if (tiposDB.length === 0) return TIPOS_PLANTAO_FALLBACK;
    return tiposDB.map((t: any) => ({
      value: t.nome,
      sigla: t.sigla,
      start: (t.hora_inicio || '').slice(0, 5),
      end: (t.hora_fim || '').slice(0, 5),
      carga: Number(t.carga_horaria) || 12,
    }));
  }, [tiposDB]);

  const tipoToSigla = (tipo?: string) => TIPOS_PLANTAO.find(t => t.value === tipo)?.sigla ?? (tipo?.[0]?.toUpperCase() ?? '?');

  useEffect(() => {
    const shiftsChannel = supabase
      .channel('escala-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        refetchShifts();
        toast.info('📅 Escala atualizada', { duration: 2000, position: 'bottom-right' });
      })
      .subscribe();
    return () => { supabase.removeChannel(shiftsChannel); };
  }, [refetchShifts]);

  const { data: activeSwaps = [] } = useQuery({
    queryKey: ['active-swaps-for-escala'],
    queryFn: async () => {
      const { data } = await supabase.from('shift_swaps')
        .select('shift_id, shift_id_destino, status, updated_at')
        .in('status', ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao', 'aprovada', 'concluida']);
      return data || [];
    },
  });

  const swapByShiftId = useMemo(() => {
    const map: Record<string, { status: string; updated_at: string }> = {};
    for (const sw of activeSwaps as any[]) {
      if (sw.shift_id) map[sw.shift_id] = { status: sw.status, updated_at: sw.updated_at };
      if (sw.shift_id_destino) map[sw.shift_id_destino] = { status: sw.status, updated_at: sw.updated_at };
    }
    return map;
  }, [activeSwaps]);

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => {
      const { data } = await supabase.from('professionals_safe')
        .select('id, nome, profissao, especialidade, telefone, email, status, setor_principal_id, unidade_principal_id, user_id, competencias, registro, conselho, documento_validade, vinculo')
        .eq('status', 'ativo').order('nome');
      return data || [];
    },
  });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: async () => { const { data } = await supabase.from('units').select('*').order('nome'); return data || []; } });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors'], queryFn: async () => { const { data } = await supabase.from('sectors').select('*').order('nome'); return data || []; } });

  // Regras globais de descanso/limites
  const { data: conflictRules } = useQuery({
    queryKey: ['conflict-rules-escala'],
    queryFn: async () => {
      const { data } = await sb.from('system_settings').select('value').eq('key', 'conflict_rules').maybeSingle();
      return (data?.value as any) || { descanso_minimo: 6, limite_horas_dia: 24, limite_horas_semana: 60 };
    },
  });
  const descansoMinimo = Number(conflictRules?.descanso_minimo ?? 6);

  const todayStr = new Date().toISOString().split('T')[0];

  const { data: censoHoje = [] } = useQuery({
    queryKey: ['escala-censo-hoje', todayStr],
    queryFn: async () => { const { data } = await supabase.from('censo_pacientes').select('setor_id, leitos_ocupados, proporcao_minima').eq('data', todayStr); return data || []; },
  });

  const { data: todayAllShifts = [] } = useQuery({
    queryKey: ['escala-today-shifts', todayStr],
    queryFn: async () => { const { data } = await supabase.from('shifts').select('setor_id, profissional_id').eq('data', todayStr).neq('status', 'cancelado'); return data || []; },
  });

  const sectorCapacity = useMemo(() => {
    const map: Record<string, { status: 'ok' | 'atencao' | 'critico'; reason: string }> = {};
    for (const s of sectors as any[]) {
      const censo = (censoHoje as any[]).find(c => c.setor_id === s.id);
      const pacientes = censo?.leitos_ocupados || 0;
      const escalados = todayAllShifts.filter((sh: any) => sh.setor_id === s.id).length;
      const minD = s.min_profissionais_diurno || 1;

      if (pacientes > 0 && escalados > 0) {
        const ratio = pacientes / escalados;
        if (ratio > 10) map[s.id] = { status: 'critico', reason: `${escalados} prof. para ${pacientes} pac. (${ratio.toFixed(0)}:1)` };
        else if (ratio > 6) map[s.id] = { status: 'atencao', reason: `${escalados} prof. para ${pacientes} pac. (${ratio.toFixed(0)}:1)` };
        else map[s.id] = { status: 'ok', reason: `Equipe adequada (${ratio.toFixed(0)}:1)` };
      } else if (escalados < minD) {
        map[s.id] = { status: 'atencao', reason: `${escalados}/${minD} profissionais (mínimo)` };
      } else {
        map[s.id] = { status: 'ok', reason: 'Equipe adequada' };
      }
    }
    return map;
  }, [sectors, censoHoje, todayAllShifts]);

  const calcHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  };

  // Carrega horas do mês para profissionais filtrados (para mostrar 24h/220h ao lado do nome)
  const profissionaisFiltrados = useMemo(
    () => (professionals as any[]).filter((p: any) => !form.profissao || p.profissao === form.profissao),
    [professionals, form.profissao],
  );

  useEffect(() => {
    if (!modalOpen || profissionaisFiltrados.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates: Record<string, number> = {};
      await Promise.all(profissionaisFiltrados.map(async (p: any) => {
        if (horasPorProfissional[p.id] !== undefined) return;
        const { data } = await sb.rpc('sum_horas_mes_profissional', { _profissional_id: p.id });
        updates[p.id] = Number(data ?? 0);
      }));
      if (!cancelled && Object.keys(updates).length) {
        setHorasPorProfissional(prev => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [modalOpen, profissionaisFiltrados, sb, horasPorProfissional]);

  // Token de geração para descartar respostas obsoletas (race condition)
  const validationGenRef = useRef(0);

  const checkConflicts = async (gen?: number) => {
    if (!form.profissional_ids.length || !form.data || !form.hora_inicio || !form.hora_fim) {
      setConflictWarnings([]);
      setRestWarnings([]);
      return;
    }
    const warnings: string[] = [];
    const restWarn: string[] = [];
    for (const pid of form.profissional_ids) {
      const { data: conflicts } = await supabase.rpc('check_shift_conflict', {
        p_profissional_id: pid,
        p_data: form.data,
        p_hora_inicio: form.hora_inicio,
        p_hora_fim: form.hora_fim,
        p_exclude_id: editingId,
      });
      const prof = (professionals as any[]).find(p => p.id === pid);
      if (conflicts && conflicts.length > 0) {
        warnings.push(`⚠️ ${prof?.nome}: já tem plantão ${conflicts[0].conflicting_start}-${conflicts[0].conflicting_end} ou folga neste dia.`);
      }
      // Verifica descanso mínimo
      const { data: restData } = await sb.rpc('check_descanso_minimo', {
        p_profissional_id: pid,
        p_data: form.data,
        p_hora_inicio: form.hora_inicio,
        p_hora_fim: form.hora_fim,
        p_descanso_horas: descansoMinimo,
        p_exclude_id: editingId,
      });
      if (restData && restData.length > 0) {
        const gap = Number(restData[0].gap_horas).toFixed(1);
        restWarn.push(`🛌 ${prof?.nome}: descanso de ${gap}h entre plantões (mínimo configurado: ${descansoMinimo}h).`);
      }
    }
    // Descartar resultado se outra validação foi disparada nesse meio tempo
    if (gen !== undefined && gen !== validationGenRef.current) return;
    setConflictWarnings(warnings);
    setRestWarnings(restWarn);
  };

  const checkWorkload = async (gen?: number) => {
    if (form.profissional_ids.length !== 1 || !form.data) { setWorkloadAlerts([]); return; }
    const pid = form.profissional_ids[0];
    const alerts: string[] = [];
    const yesterday = new Date(form.data + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const { data: recent } = await supabase.from('shifts').select('carga_horaria, hora_fim').eq('profissional_id', pid).in('data', [form.data, yStr]).neq('status', 'cancelado');
    const recentHours = (recent || []).reduce((s: number, r: any) => s + Number(r.carga_horaria), 0);
    if (recentHours >= 24) alerts.push('🟡 Profissional já tem 24h nas últimas 24h');
    if (gen !== undefined && gen !== validationGenRef.current) return;
    setWorkloadAlerts(alerts);
  };

  // Debounce dos campos relevantes para checagem de conflitos.
  // Sempre que o formulário mudar (profissionais, data, horas, setor, unidade, tipo),
  // dispara uma nova validação após 250ms de inatividade, descartando respostas antigas.
  const debouncedFormKey = useDebounce(
    `${form.profissional_ids.join(',')}|${form.data}|${form.hora_inicio}|${form.hora_fim}|${form.setor_id}|${form.unidade_id}|${form.tipo_plantao}`,
    250,
  );
  useEffect(() => {
    if (!modalOpen) return;
    const gen = ++validationGenRef.current;
    checkConflicts(gen);
    checkWorkload(gen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFormKey, modalOpen]);

  // Revalidação server-side imediatamente antes do mutate.
  // Valida TODOS os profissionais selecionados (não para no primeiro) e retorna lista agregada de conflitos.
  const revalidateServerSide = async (data: typeof form): Promise<void> => {
    const limiteDia = Number(conflictRules?.limite_horas_dia ?? 24);
    const limiteSemana = Number(conflictRules?.limite_horas_semana ?? 60);
    const novaCarga = calcHours(data.hora_inicio, data.hora_fim);
    const erros: string[] = [];

    // 1. Tipo de plantão ativo
    if (data.tipo_plantao && !['regular', 'folga', 'indisponibilidade'].includes(data.tipo_plantao)) {
      const { data: tipoRow } = await sb.from('shift_types')
        .select('ativo')
        .or(`sigla.eq.${data.tipo_plantao},nome.eq.${data.tipo_plantao}`)
        .maybeSingle();
      if (tipoRow && (tipoRow as any).ativo === false) {
        erros.push(`Tipo de plantão "${data.tipo_plantao}" está inativo.`);
      }
    }

    // 2. Setor/Unidade válidos
    const setor = (sectors as any[]).find((s: any) => s.id === data.setor_id);
    if (!setor) erros.push('Setor selecionado é inválido.');
    else if (setor.unidade_id && setor.unidade_id !== data.unidade_id) {
      erros.push('Setor não pertence à unidade selecionada.');
    }

    // Janela de semana (segunda a domingo) para limite semanal
    const ref = new Date(data.data + 'T00:00:00');
    const dow = ref.getDay();
    const diffToMon = (dow + 6) % 7;
    const semanaIni = new Date(ref); semanaIni.setDate(ref.getDate() - diffToMon);
    const semanaFim = new Date(semanaIni); semanaFim.setDate(semanaIni.getDate() + 6);
    const semanaIniStr = semanaIni.toISOString().split('T')[0];
    const semanaFimStr = semanaFim.toISOString().split('T')[0];

    // Validação paralela por profissional, agregando todos os erros
    const validarProfissional = async (pid: string): Promise<string[]> => {
      const out: string[] = [];
      const prof = (professionals as any[]).find((p: any) => p.id === pid);
      const nome = prof?.nome || `Profissional ${pid.slice(0, 8)}`;

      if (!prof || prof.status !== 'ativo') {
        out.push(`${nome}: profissional inativo.`);
        return out;
      }

      const [conflictsRes, restRes, doDiaRes, doSemRes] = await Promise.all([
        supabase.rpc('check_shift_conflict', {
          p_profissional_id: pid, p_data: data.data,
          p_hora_inicio: data.hora_inicio, p_hora_fim: data.hora_fim,
          p_exclude_id: editingId,
        }),
        supabase.rpc('check_descanso_minimo', {
          p_profissional_id: pid, p_data: data.data,
          p_hora_inicio: data.hora_inicio, p_hora_fim: data.hora_fim,
          p_descanso_horas: descansoMinimo, p_exclude_id: editingId,
        }),
        (() => {
          let q = supabase.from('shifts').select('carga_horaria')
            .eq('profissional_id', pid).eq('data', data.data).neq('status', 'cancelado');
          if (editingId) q = q.neq('id', editingId);
          return q;
        })(),
        (() => {
          let q = supabase.from('shifts').select('carga_horaria')
            .eq('profissional_id', pid).gte('data', semanaIniStr).lte('data', semanaFimStr).neq('status', 'cancelado');
          if (editingId) q = q.neq('id', editingId);
          return q;
        })(),
      ]);

      if (conflictsRes.error) out.push(`${nome}: falha ao revalidar conflito (${conflictsRes.error.message}).`);
      else if (conflictsRes.data && conflictsRes.data.length > 0) {
        const c: any = conflictsRes.data[0];
        out.push(`${nome}: já possui plantão ${c.conflicting_start}–${c.conflicting_end} neste dia.`);
      }

      if (restRes.error) out.push(`${nome}: falha ao revalidar descanso (${restRes.error.message}).`);
      else if (restRes.data && restRes.data.length > 0) {
        const gap = Number((restRes.data[0] as any).gap_horas).toFixed(1);
        out.push(`${nome}: descanso de ${gap}h (mínimo ${descansoMinimo}h).`);
      }

      const horasDia = (doDiaRes.data || []).reduce((s: number, r: any) => s + Number(r.carga_horaria || 0), 0) + novaCarga;
      if (horasDia > limiteDia) out.push(`${nome}: excede limite diário (${horasDia.toFixed(1)}h > ${limiteDia}h).`);

      const horasSem = (doSemRes.data || []).reduce((s: number, r: any) => s + Number(r.carga_horaria || 0), 0) + novaCarga;
      if (horasSem > limiteSemana) out.push(`${nome}: excede limite semanal (${horasSem.toFixed(1)}h > ${limiteSemana}h).`);

      return out;
    };

    const resultados = await Promise.all(data.profissional_ids.map(validarProfissional));
    resultados.forEach(r => erros.push(...r));

    if (erros.length > 0) {
      const cabecalho = erros.length === 1
        ? 'Não foi possível salvar:'
        : `Não foi possível salvar — ${erros.length} conflitos detectados:`;
      throw new Error(`${cabecalho}\n• ${erros.join('\n• ')}`);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      // Captura snapshot da lista atual no momento exato do submit (deduplicada)
      const idsSnapshot = Array.from(new Set(data.profissional_ids));
      if (!idsSnapshot.length) throw new Error('Selecione ao menos um profissional.');
      const finalData = { ...data, profissional_ids: idsSnapshot };
      // Revalidação server-side final — valida TODOS os selecionados, não apenas o primeiro
      await revalidateServerSide(finalData);
      const hours = calcHours(finalData.hora_inicio, finalData.hora_fim);
      const basePayload = {
        unidade_id: finalData.unidade_id, setor_id: finalData.setor_id, profissao: finalData.profissao as any,
        data: finalData.data, hora_inicio: finalData.hora_inicio, hora_fim: finalData.hora_fim,
        carga_horaria: hours, tipo_plantao: finalData.tipo_plantao,
        observacoes: finalData.observacoes || null, status: finalData.status as any,
      };

      if (editingId) {
        const pid = finalData.profissional_ids[0];
        const { error } = await supabase.from('shifts').update({ ...basePayload, profissional_id: pid }).eq('id', editingId);
        if (error) throw error;
        await logAudit('Plantão editado', 'escala', { id: editingId });
      } else {
        const payloads = finalData.profissional_ids.map(pid => ({ ...basePayload, profissional_id: pid }));
        const { error } = await supabase.from('shifts').insert(payloads);
        if (error) throw error;
        await logAudit('Plantões criados (múltiplos profissionais)', 'escala', { count: payloads.length, data: finalData.data });
        for (const pid of finalData.profissional_ids) {
          await dispatchNotification({
            professionalId: pid, tipo: 'plantao', titulo: 'Novo plantão agendado',
            mensagem: `Você foi escalado para plantão em ${new Date(finalData.data + 'T12:00:00').toLocaleDateString('pt-BR')} das ${finalData.hora_inicio} às ${finalData.hora_fim}.`,
          });
        }
      }
    },
    onSuccess: () => {
      invalidateCrossShifts(qc);
      toast.success(editingId ? 'Plantão atualizado!' : `${form.profissional_ids.length} plantão(ões) criado(s)!`);
      closeModal();
    },
    onError: (e: Error) => {
      const [titulo, ...resto] = e.message.split('\n');
      toast.error(titulo, resto.length ? { description: resto.join('\n'), duration: 8000 } : undefined);
    },
  });

  // Mutation para registrar folga/indisponibilidade (usa shifts com tipo_plantao='folga')
  const folgaMutation = useMutation({
    mutationFn: async (f: typeof folgaForm) => {
      if (!f.profissional_id || !f.data_inicio || !f.data_fim) {
        throw new Error('Preencha profissional e datas.');
      }
      const inicio = new Date(f.data_inicio + 'T00:00:00');
      const fim = new Date(f.data_fim + 'T00:00:00');
      if (fim < inicio) throw new Error('Data fim anterior ao início.');

      const prof = (professionals as any[]).find(p => p.id === f.profissional_id);
      if (!prof) throw new Error('Profissional não encontrado.');

      const dias: string[] = [];
      const cursor = new Date(inicio);
      while (cursor <= fim) {
        dias.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
      }

      const setorId = prof.setor_principal_id ?? (sectors as any[])[0]?.id;
      const unidadeId = prof.unidade_principal_id ?? (units as any[])[0]?.id;
      if (!setorId || !unidadeId) throw new Error('Profissional sem setor/unidade principal definido.');

      const payloads = dias.map(d => ({
        unidade_id: unidadeId, setor_id: setorId, profissao: prof.profissao,
        profissional_id: f.profissional_id, data: d, hora_inicio: '00:00', hora_fim: '23:59',
        carga_horaria: 0, tipo_plantao: f.motivo, status: 'confirmado' as any,
        observacoes: f.observacoes || `Indisponibilidade: ${f.motivo}`,
      }));
      const { error } = await supabase.from('shifts').insert(payloads);
      if (error) throw error;
      await logAudit('Folga/indisponibilidade registrada', 'escala', { profissional: prof.nome, dias: dias.length, motivo: f.motivo });
    },
    onSuccess: () => {
      toast.success('Folga registrada com sucesso.');
      invalidateCrossShifts(qc);
      setFolgaModalOpen(false);
      setFolgaForm(emptyFolga);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (shift: any) => {
      if (shift.status === 'trocando') {
        await supabase.from('shift_swaps')
          .update({ status: 'cancelada' as any, observacao_gestor: 'Troca cancelada — plantão excluído' })
          .eq('shift_id', shift.id)
          .in('status', ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao']);
      }
      const { error } = await supabase.from('shifts').delete().eq('id', shift.id);
      if (error) {
        await supabase.from('shifts').update({ status: 'cancelado' as any }).eq('id', shift.id);
        toast.success('Plantão cancelado');
      } else {
        toast.success('Plantão excluído');
      }
      await logAudit('Plantão excluído', 'escala', { id: shift.id });
      await dispatchNotification({
        professionalId: shift.profissional_id, tipo: 'plantao',
        titulo: '⚠️ Plantão cancelado',
        mensagem: `Seu plantão em ${new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR')} foi cancelado.`,
      });
    },
    onSuccess: () => invalidateCrossShifts(qc),
    onError: (e: Error) => toast.error(`Não foi possível excluir: ${e.message}`),
  });

  const closeModal = () => {
    setModalOpen(false); setEditingId(null); setForm(emptyForm);
    setConflictWarnings([]); setRestWarnings([]); setWorkloadAlerts([]);
    setHorasPorProfissional({});
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      unidade_id: s.unidade_id, setor_id: s.setor_id, profissao: s.profissao,
      profissional_ids: [s.profissional_id], data: s.data,
      hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, tipo_plantao: s.tipo_plantao,
      observacoes: s.observacoes || '', status: s.status,
    });
    setModalOpen(true);
  };

  const openCreateForCell = (date: string, sectorId?: string, unidadeId?: string) => {
    setEditingId(null);
    setForm({
      ...emptyForm, data: date,
      setor_id: sectorId || '', unidade_id: unidadeId || '',
    });
    setModalOpen(true);
  };

  // Aplica preset de tipo de plantão (preenche horários automaticamente)
  const applyTipoPreset = (tipo: string) => {
    const preset = TIPOS_PLANTAO.find(t => t.value === tipo);
    setForm(f => ({
      ...f,
      tipo_plantao: tipo,
      hora_inicio: preset?.start ?? f.hora_inicio,
      hora_fim: preset?.end ?? f.hora_fim,
    }));
    setTimeout(() => { checkConflicts(); checkWorkload(); }, 100);
  };

  const filtered = (shifts as any[]).filter((s: any) => {
    if (filterSetor && s.setor_id !== filterSetor) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const inputClass = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-colors";

  const toggleProfissional = (pid: string) => {
    setForm(f => {
      const has = f.profissional_ids.includes(pid);
      return { ...f, profissional_ids: has ? f.profissional_ids.filter(x => x !== pid) : [...f.profissional_ids, pid] };
    });
    setTimeout(() => { checkConflicts(); checkWorkload(); }, 100);
  };

  const initials = (nome?: string) => (nome || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const isFolga = (s: any) => s?.tipo_plantao === 'folga' || s?.tipo_plantao === 'indisponibilidade';

  // Data for WeeklyGrid
  const gridProfissionais: ProfRow[] = useMemo(() => {
    const profMap: Record<string, ProfRow> = {};
    for (const s of (shifts as any[])) {
      const profId = s.profissional_id;
      const profName = (s.professionals as any)?.nome || 'Sem nome';
      const profissao = PROFISSAO_LABELS[(s.professionals as any)?.profissao] || '';
      if (!profMap[profId]) {
        profMap[profId] = { id: profId, nome: profName, profissao, escala: {} };
      }
      const dateKey = s.data;
      if (!profMap[profId].escala[dateKey]) profMap[profId].escala[dateKey] = [];
      const folga = isFolga(s);
      profMap[profId].escala[dateKey].push({
        id: s.id,
        sigla: folga ? 'F' : tipoToSigla(s.tipo_plantao),
        tipo: s.tipo_plantao || '',
        horario: `${(s.hora_inicio || '').slice(0, 5)}-${(s.hora_fim || '').slice(0, 5)}`,
        setor: (s.sectors as any)?.nome || '',
        status: s.status,
      });
    }
    return Object.values(profMap).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [shifts, TIPOS_PLANTAO]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight font-display">Escala de Plantões</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} plantões encontrados</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button onClick={() => setView('lista')} className={`p-1.5 rounded-md transition-all ${view === 'lista' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><List className="h-4 w-4" /></button>
            <button onClick={() => setView('calendario')} className={`p-1.5 rounded-md transition-all ${view === 'calendario' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><Calendar className="h-4 w-4" /></button>
            <button onClick={() => setView('grade')} className={`p-1.5 rounded-md transition-all ${view === 'grade' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Grade semanal"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={() => { setFolgaForm(emptyFolga); setFolgaModalOpen(true); }} className="flex items-center gap-1.5 border border-input bg-card px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-colors"><Palmtree className="h-3.5 w-3.5 text-amber-600" /> Folga</button>
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setModalOpen(true); }} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"><Plus className="h-3.5 w-3.5" /> Novo Plantão</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterSetor} onChange={e => setFilterSetor(e.target.value)} className="bg-card border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-colors">
          <option value="">Todos os setores</option>
          {sectors.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-card border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-colors">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : view === 'lista' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="text-left p-3">Profissional</th><th className="text-left p-3">Setor</th><th className="text-left p-3">Data</th><th className="text-left p-3">Horário</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Status</th><th className="text-left p-3">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map((s: any) => (
                  <tr key={s.id} className={`border-t border-border hover:bg-muted/30 transition-colors ${isFolga(s) ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isFolga(s) && <Palmtree className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                        <div>
                          <p className="font-medium text-foreground">{(s.professionals as any)?.nome}</p>
                          <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[(s.professionals as any)?.profissao] || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                {sectorCapacity[s.setor_id]?.status === 'critico' ? '🔴' : sectorCapacity[s.setor_id]?.status === 'atencao' ? '🟡' : '🟢'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{sectorCapacity[s.setor_id]?.reason || 'Sem dados'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div>
                          <p className="text-foreground">{(s.sectors as any)?.nome}</p>
                          <p className="text-xs text-muted-foreground">{(s.units as any)?.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-foreground">{new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-3"><div className="flex items-center gap-1 text-foreground"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{s.hora_inicio} - {s.hora_fim}</div><p className="text-xs text-muted-foreground">{s.carga_horaria}h</p></td>
                    <td className="p-3 text-foreground">
                      {isFolga(s) ? <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-medium"><Palmtree className="h-3 w-3" /> {s.tipo_plantao === 'folga' ? 'Folga' : 'Indisponível'}</span> : s.tipo_plantao}
                    </td>
                    <td className="p-3"><span className={`status-badge ${STATUS_CLASSES[s.status] || ''}`}>{STATUS_LABELS[s.status]}</span></td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <ContactActionButton
                          profissional={{ nome: (s.professionals as any)?.nome || '', telefone: (professionals as any[]).find((p: any) => p.id === s.profissional_id)?.telefone }}
                          contexto={{ tipo: 'plantao', data: new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), horario: `${s.hora_inicio} às ${s.hora_fim}`, setor: (s.sectors as any)?.nome, unidade: (s.units as any)?.nome }}
                        />
                        <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-muted"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><button className="p-1 rounded hover:bg-destructive/10" disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir plantão?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {(s.professionals as any)?.nome} — {new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')} {s.hora_inicio}-{s.hora_fim}. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteMutation.isPending} onClick={(e) => { e.preventDefault(); if (!deleteMutation.isPending) deleteMutation.mutate(s); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : view === 'grade' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <WeeklyGrid
            profissionais={gridProfissionais}
            coberturaMinima={2}
            onCellClick={(_profId, dateStr, shift) => {
              if (shift) {
                const found = (shifts as any[]).find((s: any) => s.id === shift.id);
                if (found) setDetailShift(found);
              } else {
                openCreateForCell(dateStr);
              }
            }}
            onCreateClick={(dateStr) => openCreateForCell(dateStr)}
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg border border-border p-6 shadow-[var(--shadow-card)]">
          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground mr-1">Legenda:</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-success/40 border border-success/60" /> Confirmado</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-info/40 border border-info/60" /> Agendado</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-warning/40 border border-warning/60" /> Pendente</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-primary/40 border border-primary/60" /> Em troca</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-orange-500/40 border border-orange-500/60" /> Interrompido</span>
            <span className="inline-flex items-center gap-1"><Palmtree className="h-3 w-3 text-amber-600" /> Folga</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
            {(() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
              return Array.from({ length: totalCells }, (_, i) => {
                const day = i - firstDay + 1;
                const isValid = day >= 1 && day <= daysInMonth;
                const isToday = isValid && day === now.getDate();
                const dateStr = isValid ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                const dayShifts = isValid ? (shifts as any[]).filter((s: any) => s.data === dateStr) : [];
                const onlyFolgas = dayShifts.length > 0 && dayShifts.every(isFolga);
                return (
                  <div key={i}
                    onClick={() => isValid && dayShifts.length === 0 && openCreateForCell(dateStr)}
                    className={`min-h-[110px] p-1.5 rounded-lg border transition-colors text-left ${
                      isValid ? 'border-border/50 hover:border-primary/40 cursor-pointer' : 'border-transparent'
                    } ${isToday ? 'ring-2 ring-primary/40' : ''} ${onlyFolgas ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' : ''}`}>
                    {isValid && (<>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                        {onlyFolgas && <Palmtree className="h-3 w-3 text-amber-600" />}
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        {dayShifts.slice(0, 4).map((s: any) => {
                          const folga = isFolga(s);
                          const cellClass = folga
                            ? 'bg-amber-200/60 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border-amber-400/40'
                            : (STATUS_CELL_BG[s.status] || 'bg-muted border-border text-foreground');
                          return (
                            <button
                              key={s.id}
                              onClick={(e) => { e.stopPropagation(); setDetailShift(s); }}
                              title={`${(s.professionals as any)?.nome} • ${s.tipo_plantao}`}
                              className={`flex items-center gap-1 rounded-md border px-1 py-0.5 text-[10px] font-semibold leading-tight truncate ${cellClass}`}
                            >
                              <span className="font-bold">{initials((s.professionals as any)?.nome)}</span>
                              <span className="opacity-80">·</span>
                              <span className="font-mono">{folga ? 'F' : tipoToSigla(s.tipo_plantao)}</span>
                            </button>
                          );
                        })}
                        {dayShifts.length > 4 && <span className="text-[9px] text-muted-foreground">+{dayShifts.length - 4} mais</span>}
                      </div>
                    </>)}
                  </div>
                );
              });
            })()}
          </div>
        </motion.div>
      )}

      {/* MODAL: Novo / Editar plantão */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Plantão' : 'Novo Plantão'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-foreground">Unidade *</label>
                <select required value={form.unidade_id} onChange={e => setForm(f => ({ ...f, unidade_id: e.target.value, setor_id: '' }))} className={inputClass}>
                  <option value="">Selecione...</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Setor *</label>
                <select required value={form.setor_id} onChange={e => setForm(f => ({ ...f, setor_id: e.target.value }))} className={inputClass}>
                  <option value="">Selecione...</option>{sectors.filter((s: any) => !form.unidade_id || s.unidade_id === form.unidade_id).map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Profissão *</label>
                <select required value={form.profissao} onChange={e => setForm(f => ({ ...f, profissao: e.target.value, profissional_ids: [] }))} className={inputClass}>
                  {Object.entries(PROFISSAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Data *</label><input required type="date" value={form.data} onChange={e => { setForm(f => ({ ...f, data: e.target.value })); setTimeout(() => { checkConflicts(); checkWorkload(); }, 100); }} className={inputClass} /></div>
              <div className="col-span-2"><label className="text-sm font-medium text-foreground">Tipo de plantão *</label>
                <select value={form.tipo_plantao} onChange={e => applyTipoPreset(e.target.value)} className={inputClass}>
                  {TIPOS_PLANTAO.map(t => <option key={t.value} value={t.value}>{t.value} ({t.start}–{t.end})</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Selecionar o tipo preenche os horários automaticamente. Você pode ajustar abaixo.</p>
              </div>
              <div><label className="text-sm font-medium text-foreground">Hora início *</label><input required type="time" value={form.hora_inicio} onChange={e => { setForm(f => ({ ...f, hora_inicio: e.target.value })); setTimeout(checkConflicts, 100); }} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Hora fim *</label><input required type="time" value={form.hora_fim} onChange={e => { setForm(f => ({ ...f, hora_fim: e.target.value })); setTimeout(checkConflicts, 100); }} className={inputClass} /></div>
              <div className="col-span-2"><label className="text-sm font-medium text-foreground">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'trocando').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>

            {/* Multi-select de profissionais com horas no mês */}
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <UsersIcon className="h-4 w-4" /> Profissionais escalados *
                {form.profissional_ids.length > 0 && (
                  <span className="text-xs text-muted-foreground">({form.profissional_ids.length} selecionado{form.profissional_ids.length > 1 ? 's' : ''})</span>
                )}
              </label>
              <p className="text-xs text-muted-foreground mb-2">Filtrado por <strong>{PROFISSAO_LABELS[form.profissao]}</strong>. Horas exibidas: trabalhadas no mês / limite CLT (220h).</p>
              <div className="border border-border rounded-lg p-2 max-h-56 overflow-y-auto space-y-1">
                {profissionaisFiltrados.map((p: any) => {
                  const checked = form.profissional_ids.includes(p.id);
                  const horas = horasPorProfissional[p.id] ?? 0;
                  const overLimit = horas >= LIMITE_HORAS_MENSAL;
                  return (
                    <label key={p.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${checked ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProfissional(p.id)}
                        disabled={!!editingId && !checked && form.profissional_ids.length >= 1}
                        className="rounded"
                      />
                      <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{initials(p.nome)}</span>
                      <span className="text-foreground flex-1 truncate">{p.nome}</span>
                      <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${overLimit ? 'bg-destructive/15 text-destructive' : horas > 180 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`}>
                        {horas}h/{LIMITE_HORAS_MENSAL}h
                      </span>
                    </label>
                  );
                })}
                {profissionaisFiltrados.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Nenhum profissional ativo desta categoria.</p>
                )}
              </div>
              {editingId && <p className="text-xs text-muted-foreground mt-1">Edição permite apenas 1 profissional. Para adicionar outros, crie um novo plantão.</p>}
            </div>

            {conflictWarnings.length > 0 && (
              <div className="space-y-1">
                {conflictWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            {restWarnings.length > 0 && (
              <div className="space-y-1">
                {restWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            {workloadAlerts.length > 0 && (
              <div className="space-y-1">
                {workloadAlerts.map((a, i) => <div key={i} className="p-2 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning font-medium">{a}</div>)}
              </div>
            )}
            <div><label className="text-sm font-medium text-foreground">Observações</label><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className={inputClass} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveMutation.isPending || conflictWarnings.length > 0 || restWarnings.length > 0 || form.profissional_ids.length === 0} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar' : `Escalar ${form.profissional_ids.length || ''}`}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Marcar folga / indisponibilidade */}
      <Dialog open={folgaModalOpen} onOpenChange={setFolgaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-amber-600" /> Marcar folga / indisponibilidade
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); folgaMutation.mutate(folgaForm); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Profissional *</label>
              <select required value={folgaForm.profissional_id} onChange={e => setFolgaForm(f => ({ ...f, profissional_id: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>
                {(professionals as any[]).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nome} — {PROFISSAO_LABELS[p.profissao]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Data início *</label>
                <input required type="date" value={folgaForm.data_inicio} onChange={e => setFolgaForm(f => ({ ...f, data_inicio: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Data fim *</label>
                <input required type="date" value={folgaForm.data_fim} onChange={e => setFolgaForm(f => ({ ...f, data_fim: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Motivo *</label>
              <select value={folgaForm.motivo} onChange={e => setFolgaForm(f => ({ ...f, motivo: e.target.value }))} className={inputClass}>
                <option value="folga">Folga</option>
                <option value="indisponibilidade">Indisponibilidade (férias / licença / atestado)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Observações</label>
              <textarea value={folgaForm.observacoes} onChange={e => setFolgaForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className={inputClass} />
            </div>
            <div className="rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
              ℹ️ Os dias selecionados ficarão bloqueados para escalação automática. Conflitos serão sinalizados na criação de novos plantões.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setFolgaModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={folgaMutation.isPending} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                {folgaMutation.isPending ? 'Registrando...' : 'Registrar folga'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailShift} onOpenChange={(open) => !open && setDetailShift(null)}>
        <DialogContent className="max-w-md">
          {detailShift && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isFolga(detailShift) ? <Palmtree className="h-5 w-5 text-amber-600" /> : <Info className="h-5 w-5 text-primary" />}
                  {isFolga(detailShift) ? 'Folga' : 'Plantão'} — {new Date(detailShift.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">{(detailShift.professionals as any)?.nome}</p>
                <p className="text-sm text-muted-foreground">{PROFISSAO_LABELS[(detailShift.professionals as any)?.profissao] || ''}</p>
                <p className="text-sm text-foreground">🏥 {(detailShift.sectors as any)?.nome} — {(detailShift.units as any)?.nome}</p>
                {!isFolga(detailShift) && (
                  <p className="text-sm text-foreground">⏰ {detailShift.hora_inicio} às {detailShift.hora_fim} ({detailShift.carga_horaria}h) — <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{detailShift.tipo_plantao}</span></p>
                )}
                <span className={`status-badge ${STATUS_CLASSES[detailShift.status] || ''}`}>{STATUS_LABELS[detailShift.status]}</span>
                {swapByShiftId[detailShift.id] && ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao'].includes(swapByShiftId[detailShift.id].status) && (
                  <span className="status-badge bg-warning/10 text-warning ml-2"><ArrowLeftRight className="h-3 w-3 mr-1 inline" />Em troca</span>
                )}
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                <button onClick={() => { openEdit(detailShift); setDetailShift(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                  <Edit className="h-3.5 w-3.5" /> Editar
                </button>
                <button onClick={() => setDetailShift(null)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">
                  Fechar
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
