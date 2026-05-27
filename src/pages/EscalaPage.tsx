import { useState, useEffect, useMemo, useRef, memo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCrossShifts } from "@/lib/queryInvalidation";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { Calendar, List, Clock, Plus, Trash2, Edit, ArrowLeftRight, Info, Users as UsersIcon, Palmtree, AlertTriangle, AlertCircle, LayoutGrid, MoreHorizontal, Printer, FileText, FileSpreadsheet, CopyPlus, ShieldCheck, Send, Megaphone, Loader2, Search, X, Table2, ChevronLeft, ChevronRight, Eye, CalendarDays, Repeat, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

import { WeeklyGrid, type ProfRow, type GridShift } from "@/components/schedule/WeeklyGrid";
import { MonthlyConsolidatedGrid } from "@/components/schedule/MonthlyConsolidatedGrid";
import { ContactActionButton } from "@/components/ContactActionButton";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { exportToPDF, exportToExcel } from "@/lib/exportUtils";
import { abrirVisualizacaoImpressao, gerarPdfEscala, diaSemanaPt, type PrintLinha, type PrintCabecalho, type PrintOptions } from "@/lib/printEscala";
import { abrirEscalaMensalOficial, gerarPdfEscalaMensalOficial, type MensalProfissional, type MensalCabecalho, type MensalOpts, type MensalTipoLegenda, type MensalResponsavel } from "@/lib/printEscalaMensalOficial";
import { resolveSignatureData, resolveRTForUnidade, resolveGestorMasterForUnidade, type ResolvedSignature } from "@/lib/signatureResolution";
import { imprimirComprovantePlantao, type ComprovantePlantaoData } from "@/lib/printComprovantePlantao";
import SignActionButton from "@/components/SignActionButton";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { calculateAdicionalNoturno } from "@/lib/utils";
import { AdnConfig } from "@/components/AdnSettingsManager";

import { MultiSelect } from "@/components/ui/multi-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";



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
  unidade_id: '', 
  setor_ids: [] as string[], 
  profissao_ids: ['medico'] as string[],
  profissional_ids: [] as string[],
  dates: [] as string[], 
  repeat_days: [] as number[],
  repeat_until: '',
  date_mode: 'single' as 'single' | 'multiple' | 'range' | 'repeat',
  hora_inicio: '07:00', hora_fim: '19:00',
  tipo_plantao: 'Diurno 12h', observacoes: '', status: 'confirmado',
};


const emptyFolga = { profissional_id: '', data_inicio: '', data_fim: '', motivo: 'folga', observacoes: '' };

function ShiftHistoryView({ shiftId }: { shiftId: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['shift-history', shiftId],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, created_at, acao, usuario_nome, detalhes')
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []).filter((l: any) => {
        const d = l.detalhes || {};
        return d.id === shiftId || d.shift_id === shiftId;
      });
    },
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Histórico do plantão</DialogTitle>
        <DialogDescription>Eventos registrados na auditoria para este plantão.</DialogDescription>
      </DialogHeader>
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento registrado para este plantão.</p>
      ) : (
        <ul className="divide-y divide-border max-h-[55vh] overflow-y-auto">
          {logs.map((l: any) => (
            <li key={l.id} className="py-2">
              <p className="text-sm font-medium text-foreground">{l.acao}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(l.created_at).toLocaleString('pt-BR')} · {l.usuario_nome || 'Sistema'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// -- Helpers (stable references) --
const isFolgaShift = (s: any) => s.tipo_plantao === 'folga' || s.tipo_plantao === 'indisponibilidade';
const getInitials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// -- Components --
const ShiftRow = memo(({ shift, onDetail, onEdit, onPrint, onDelete, isDeleting, sectorCapacity, isConflict, professionalTelefone }: any) => {
  return (
    <tr className={`border-t border-border hover:bg-muted/40 transition-colors ${isFolgaShift(shift) ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''} ${isConflict ? 'bg-destructive/5' : ''}`}>
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center gap-2">
          {isFolgaShift(shift) && <Palmtree className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
          {isConflict && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Conflito de horário detectado</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <span className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">{getInitials((shift.professionals as any)?.nome || '')}</span>
          <p className="font-medium text-foreground truncate">{(shift.professionals as any)?.nome}</p>
        </div>
      </td>
      <td className="px-3 py-2 align-middle text-xs text-muted-foreground">
        {PROFISSAO_LABELS[(shift.professionals as any)?.profissao] || '—'}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  {sectorCapacity?.status === 'critico' ? '🔴' : sectorCapacity?.status === 'atencao' ? '🟡' : '🟢'}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{sectorCapacity?.reason || 'Sem dados'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div>
            <p className="text-foreground">{(shift.sectors as any)?.nome}</p>
            <p className="text-xs text-muted-foreground">{(shift.units as any)?.nome}</p>
          </div>
        </div>
      </td>
      <td className="p-3 text-foreground">{new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
      <td className="p-3"><div className="flex items-center gap-1 text-foreground"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{shift.hora_inicio} - {shift.hora_fim}</div><p className="text-xs text-muted-foreground">{shift.carga_horaria}h</p></td>
      <td className="p-3 text-foreground">
        {isFolgaShift(shift) ? <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-medium"><Palmtree className="h-3 w-3" /> {shift.tipo_plantao === 'folga' ? 'Folga' : 'Indisponível'}</span> : shift.tipo_plantao}
      </td>
      <td className="p-3"><span className={`status-badge ${STATUS_CLASSES[shift.status] || ''}`}>{STATUS_LABELS[shift.status]}</span></td>
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center justify-end gap-0.5">
          <button onClick={() => onDetail(shift)} title="Ver detalhes" className="p-1.5 rounded hover:bg-muted"><Eye className="h-3.5 w-3.5 text-muted-foreground" /></button>
          <ContactActionButton
            profissional={{ nome: (shift.professionals as any)?.nome || '', telefone: professionalTelefone }}
            contexto={{ tipo: 'plantao', data: new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR'), horario: `${shift.hora_inicio} às ${shift.hora_fim}`, setor: (shift.sectors as any)?.nome, unidade: (shift.units as any)?.nome }}
          />
          <button onClick={() => onEdit(shift)} title="Editar plantão" className="p-1 rounded hover:bg-muted"><Edit className="h-4 w-4 text-muted-foreground" /></button>
          <button onClick={() => onPrint(shift)} title="Imprimir comprovante" className="p-1 rounded hover:bg-muted"><Printer className="h-4 w-4 text-muted-foreground" /></button>
          <AlertDialog>
            <AlertDialogTrigger asChild><button className="p-1 rounded hover:bg-destructive/10" disabled={isDeleting}><Trash2 className="h-4 w-4 text-destructive" /></button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir plantão?</AlertDialogTitle>
                <AlertDialogDescription>
                  {(shift.professionals as any)?.nome} — {new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR')} {shift.hora_inicio}-{shift.hora_fim}. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={isDeleting} onClick={(e) => { e.preventDefault(); onDelete(shift); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isDeleting ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
});

export default function EscalaPage() {
  const { isMaster, isCoordinator, isProfessional, profileName, user, professionalId: currentProfId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sb = supabase as any;
  const { data: settings = {} } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('*');
      return Object.fromEntries((data || []).map(s => [s.key, s.value]));
    },
  });

  const adnConfig = settings.adn_config as unknown as AdnConfig | undefined;

  // -- States --
  const [view, setView] = useState<'lista' | 'calendario' | 'grade' | 'consolidada'>('lista');
  const [calMes, setCalMes] = useState<Date>(() => {
    const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  // ---- Filtros da Escala ----
  type FiltrosEscala = {
    unidadeId: string; setorId: string; profissao: string; profissionalId: string;
    tipoPlantao: string; status: string;
    periodo: '' | 'semana' | 'mes' | 'personalizado';
    dataIni: string; dataFim: string;
    soConflitos: boolean; soDescobertos: boolean;
    soPublicados: boolean; soRascunhos: boolean; soFolgas: boolean;
    competencia?: string;
  };
  const filtrosVazios: FiltrosEscala = {
    unidadeId: '', setorId: '', profissao: '', profissionalId: '',
    tipoPlantao: '', status: '',
    periodo: '', dataIni: '', dataFim: '',
    soConflitos: false, soDescobertos: false,
    soPublicados: false, soRascunhos: false, soFolgas: false,
    competencia: new Date().toISOString().slice(0, 7),
  };
  const [filtros, setFiltros] = useState<FiltrosEscala>(filtrosVazios);
  const [busca, setBusca] = useState("");
  const buscaDebounced = useDebounce(busca, 300);
  // Aliases para compatibilidade com código existente que ainda lê filterSetor/filterStatus
  const filterSetor = filtros.setorId;
  const filterStatus = filtros.status;
  const setFilterSetor = (v: string) => setFiltros(f => ({ ...f, setorId: v }));
  const setFilterStatus = (v: string) => setFiltros(f => ({ ...f, status: v }));
  const [modalOpen, setModalOpen] = useState(false);
  const [folgaModalOpen, setFolgaModalOpen] = useState(false);
  const [folgaForm, setFolgaForm] = useState(emptyFolga);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [restWarnings, setRestWarnings] = useState<string[]>([]);
  const [workloadAlerts, setWorkloadAlerts] = useState<string[]>([]);
  const [horasPorProfissional, setHorasPorProfissional] = useState<Record<string, number>>({});
  const [profSearch, setProfSearch] = useState("");
  const [detailShift, setDetailShift] = useState<any>(null);
  const keepOpenAfterSaveRef = useRef(false);
  // Menu de ações na célula vazia (data + setor opcional)
  const [emptyCell, setEmptyCell] = useState<{ data: string; setorId?: string; unidadeId?: string } | null>(null);
  // Sub-modais a partir do menu de célula
  const [availableProsCell, setAvailableProsCell] = useState<{ data: string; setorId?: string; unidadeId?: string } | null>(null);
  const [coverageCell, setCoverageCell] = useState<{ data: string; setorId?: string } | null>(null);
  const [conflictsDay, setConflictsDay] = useState<string | null>(null);
  // Modais de ações sobre o plantão (a partir do detalhe)
  const [notifyTarget, setNotifyTarget] = useState<any>(null);
  const [notifyMsg, setNotifyMsg] = useState("");
  const [historyTarget, setHistoryTarget] = useState<any>(null);
  const [resolvedSignature, setResolvedSignature] = useState<ResolvedSignature | null>(null);
  const { data: currentStamp } = useQuery({
    queryKey: ['my-stamp', currentProfId],
    queryFn: async () => {
      if (!currentProfId) return null;
      const res = await resolveSignatureData({ professionalId: currentProfId });
      setResolvedSignature(res);
      return res;
    },
    enabled: !!currentProfId
  });

  const { data: shifts = [], isLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao, recebe_adicional_noturno, is_plantonista, cargo), units:unidade_id(nome), sectors:setor_id(nome)').order('data', { ascending: false });
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
      gera_adn: !!t.gera_adicional_noturno,
    }));
  }, [tiposDB]);

  const tipoToSigla = (tipo?: string) => TIPOS_PLANTAO.find(t => t.value === tipo)?.sigla ?? (tipo?.[0]?.toUpperCase() ?? '?');

  // Classificação automática diurno/noturno/24h/folga/sobreaviso a partir do tipo + horários
  const classificarTurno = (tipo: string, ini?: string, fim?: string): { label: string; cls: string } => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('folga') || t.includes('indispon')) return { label: 'Folga', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' };
    if (t.includes('sobreaviso')) return { label: 'Sobreaviso', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300' };
    const carga = ini && fim ? calcHoursSafe(ini, fim) : 0;
    if (carga >= 20) return { label: '24h', cls: 'bg-primary/15 text-primary' };
    const hi = parseInt((ini || '07').slice(0, 2), 10);
    if (hi >= 18 || hi < 6) return { label: 'Noturno', cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' };
    return { label: 'Diurno', cls: 'bg-info/15 text-info' };
  };
  function calcHoursSafe(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  }

  // Realtime cross-invalidation using the optimized hook
  useRealtimeInvalidation({
    tables: ["shifts"],
    invalidate: [["shifts"]],
    channelId: "escala-realtime",
    debounceMs: 600,
  });

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
      const [{ data: profs }, { data: gestores }] = await Promise.all([
        supabase.from('professionals_safe')
          .select('id, nome, profissao, especialidade, telefone, email, status, setor_principal_id, unidade_principal_id, user_id, competencias, registro, conselho, documento_validade, vinculo')
          .eq('status', 'ativo').order('nome'),
        supabase.rpc('list_professional_user_ids_managers'),
      ]);
      const gestorIds = new Set((gestores || []).map((g: any) => g.user_id));
      return (profs || []).filter((p: any) =>
        (p.vinculo ?? '') !== 'gestor_administrativo' && !(p.user_id && gestorIds.has(p.user_id))
      );
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
  // Ordena: vinculados ao setor selecionado vêm primeiro
  const profissionaisFiltrados = useMemo(() => {
    let base = (professionals as any[]).filter((p: any) => 
      !form.profissao_ids.length || form.profissao_ids.includes(p.profissao)
    );

    if (profSearch) {
      const s = profSearch.toLowerCase();
      base = base.filter((p: any) => 
        p.nome?.toLowerCase().includes(s) || 
        p.profissao?.toLowerCase().includes(s) ||
        sectors.find(sec => sec.id === p.setor_principal_id)?.nome?.toLowerCase().includes(s)
      );
    }

    if (!form.setor_ids.length) return base;
    const firstSetorId = form.setor_ids[0];
    return [...base].sort((a, b) => {
      const av = a.setor_principal_id === firstSetorId ? 0 : 1;
      const bv = b.setor_principal_id === firstSetorId ? 0 : 1;
      return av - bv;
    });
  }, [professionals, form.profissao_ids, form.setor_ids, profSearch, sectors]);

  const coberturaSetorDia = useMemo(() => {
    if (!form.setor_ids.length || !form.dates.length) return null;
    const firstSetorId = form.setor_ids[0];
    const firstDate = form.dates[0];
    const escalados = (shifts as any[]).filter((s: any) =>
      s.setor_id === firstSetorId && s.data === firstDate && s.status !== 'cancelado'
      && s.tipo_plantao !== 'folga' && s.tipo_plantao !== 'indisponibilidade'
    );
    const setor = (sectors as any[]).find((s: any) => s.id === firstSetorId);
    const min = setor?.min_profissionais_diurno || 1;
    return { total: escalados.length, min, ids: new Set(escalados.map((e: any) => e.profissional_id)) };
  }, [shifts, sectors, form.setor_ids, form.dates]);


  // Próximos plantões (até 3) do(s) profissional(is) selecionado(s) — janela ±7 dias da data escolhida
  const proxPlantoesPorProf = useMemo(() => {
    const out: Record<string, any[]> = {};
    const firstDate = form.dates[0];
    if (!firstDate) return out;
    const ref = new Date(firstDate + 'T00:00:00').getTime();
    for (const pid of form.profissional_ids) {
      out[pid] = (shifts as any[])
        .filter((s: any) => s.profissional_id === pid && s.status !== 'cancelado'
          && Math.abs(new Date(s.data + 'T00:00:00').getTime() - ref) <= 7 * 86400000
          && s.id !== editingId)
        .sort((a: any, b: any) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio))
        .slice(0, 3);
    }
    return out;
  }, [shifts, form.profissional_ids, form.dates, editingId]);


  // Status por profissional (para badge na lista): conflito de horário no dia ou já escalado no setor
  const statusPorProf = useMemo(() => {
    const out: Record<string, 'conflito' | 'no_setor' | 'disponivel'> = {};
    const firstDate = form.dates[0];
    if (!firstDate) return out;
    const startMin = (() => { const [h, m] = form.hora_inicio.split(':').map(Number); return h * 60 + m; })();
    const endMinRaw = (() => { const [h, m] = form.hora_fim.split(':').map(Number); return h * 60 + m; })();
    const endMin = endMinRaw <= startMin ? endMinRaw + 24 * 60 : endMinRaw;
    for (const p of profissionaisFiltrados) {
      const doDia = (shifts as any[]).filter((s: any) => s.profissional_id === p.id && s.data === firstDate
        && s.status !== 'cancelado' && s.id !== editingId);
      let conflito = false;
      for (const s of doDia) {
        const [sh, sm] = (s.hora_inicio || '00:00').split(':').map(Number);
        const [eh, em] = (s.hora_fim || '00:00').split(':').map(Number);
        const sStart = sh * 60 + sm;
        let sEnd = eh * 60 + em;
        if (sEnd <= sStart) sEnd += 24 * 60;
        if (startMin < sEnd && endMin > sStart) { conflito = true; break; }
      }
      if (conflito) out[p.id] = 'conflito';
      else if (coberturaSetorDia?.ids.has(p.id)) out[p.id] = 'no_setor';
      else out[p.id] = 'disponivel';
    }
    return out;
  }, [profissionaisFiltrados, shifts, form.dates, form.hora_inicio, form.hora_fim, editingId, coberturaSetorDia]);



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
    const datesToCheck = form.date_mode === 'single' && form.dates[0] ? [form.dates[0]] : 
                         form.date_mode === 'multiple' ? form.dates : 
                         form.date_mode === 'range' && form.dates[0] && form.dates[1] ? (() => {
                            const start = new Date(form.dates[0] + 'T00:00:00');
                            const end = new Date(form.dates[1] + 'T00:00:00');
                            const list = [];
                            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) list.push(d.toISOString().split('T')[0]);
                            return list;
                         })() : 
                         form.date_mode === 'repeat' && form.dates[0] && form.repeat_until ? (() => {
                            const start = new Date(form.dates[0] + 'T00:00:00');
                            const end = new Date(form.repeat_until + 'T00:00:00');
                            const list = [];
                            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                              if (form.repeat_days.includes(d.getDay())) list.push(d.toISOString().split('T')[0]);
                            }
                            return list;
                         })() : [];

    if (!form.profissional_ids.length || !datesToCheck.length || !form.hora_inicio || !form.hora_fim) {
      setConflictWarnings([]);
      setRestWarnings([]);
      return;
    }

    const warnings: string[] = [];
    const restWarn: string[] = [];
    for (const pid of form.profissional_ids) {
      for (const date of datesToCheck.slice(0, 10)) {
        const { data: conflicts } = await supabase.rpc('check_shift_conflict', {
          p_profissional_id: pid,
          p_data: date,
          p_hora_inicio: form.hora_inicio,
          p_hora_fim: form.hora_fim,
          p_exclude_id: editingId,
        });
        const prof = (professionals as any[]).find(p => p.id === pid);
        if (conflicts && conflicts.length > 0) {
          warnings.push(`⚠️ ${prof?.nome} (${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}): já tem plantão ${conflicts[0].conflicting_start}-${conflicts[0].conflicting_end} ou folga.`);
        }
        // Verifica descanso mínimo
        const { data: restData } = await sb.rpc('check_descanso_minimo', {
          p_profissional_id: pid,
          p_data: date,
          p_hora_inicio: form.hora_inicio,
          p_hora_fim: form.hora_fim,
          p_descanso_horas: descansoMinimo,
          p_exclude_id: editingId,
        });
        if (restData && restData.length > 0) {
          const gap = Number(restData[0].gap_horas).toFixed(1);
          restWarn.push(`🛌 ${prof?.nome} (${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}): descanso de ${gap}h (mínimo ${descansoMinimo}h).`);
        }
      }
    }

    // Descartar resultado se outra validação foi disparada nesse meio tempo
    if (gen !== undefined && gen !== validationGenRef.current) return;
    setConflictWarnings(warnings);
    setRestWarnings(restWarn);
  };

  const checkWorkload = async (gen?: number) => {
    const firstDate = form.dates[0];
    if (form.profissional_ids.length !== 1 || !firstDate) { setWorkloadAlerts([]); return; }
    const pid = form.profissional_ids[0];
    const alerts: string[] = [];
    const yesterday = new Date(firstDate + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const { data: recent } = await supabase.from('shifts').select('carga_horaria, hora_fim').eq('profissional_id', pid).in('data', [firstDate, yStr]).neq('status', 'cancelado');
    const recentHours = (recent || []).reduce((s: number, r: any) => s + Number(r.carga_horaria), 0);
    if (recentHours >= 24) alerts.push('🟡 Profissional já tem 24h nas últimas 24h');
    if (gen !== undefined && gen !== validationGenRef.current) return;
    setWorkloadAlerts(alerts);
  };


  // Debounce dos campos relevantes para checagem de conflitos.
  // Sempre que o formulário mudar (profissionais, data, horas, setor, unidade, tipo),
  // dispara uma nova validação após 250ms de inatividade, descartando respostas antigas.
  const debouncedFormKey = useDebounce(
    `${form.profissional_ids.join(',')}|${form.dates.join(',')}|${form.hora_inicio}|${form.hora_fim}|${form.setor_ids.join(',')}|${form.unidade_id}|${form.tipo_plantao}`,
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
  const revalidateServerSide = async (data: typeof form): Promise<{ allDates: string[] }> => {
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

    // 2. Setores/Unidade válidos
    for (const sid of data.setor_ids) {
      const setor = (sectors as any[]).find((s: any) => s.id === sid);
      if (!setor) erros.push(`Setor ${sid} é inválido.`);
      else if (setor.unidade_id && setor.unidade_id !== data.unidade_id) {
        erros.push(`Setor ${setor.nome} não pertence à unidade selecionada.`);
      }
    }

    const allDates = data.date_mode === 'single' ? [data.dates[0]] : 
                     data.date_mode === 'multiple' ? data.dates : 
                     data.date_mode === 'range' ? (() => {
                        const start = new Date(data.dates[0] + 'T00:00:00');
                        const end = new Date(data.dates[1] + 'T00:00:00');
                        const list = [];
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) list.push(d.toISOString().split('T')[0]);
                        return list;
                     })() : 
                     data.date_mode === 'repeat' ? (() => {
                        const start = new Date(data.dates[0] + 'T00:00:00');
                        const end = new Date(data.repeat_until + 'T00:00:00');
                        const list = [];
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                          if (data.repeat_days.includes(d.getDay())) list.push(d.toISOString().split('T')[0]);
                        }
                        return list;
                     })() : [];


    // Validação paralela por profissional e data, agregando todos os erros
    const validarProfissionalData = async (pid: string, dateStr: string): Promise<string[]> => {
      const out: string[] = [];
      const prof = (professionals as any[]).find((p: any) => p.id === pid);
      const nome = prof?.nome || `Profissional ${pid.slice(0, 8)}`;
      const dataLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');

      if (!prof || prof.status !== 'ativo') {
        out.push(`${nome}: profissional inativo.`);
        return out;
      }

      // Janela de semana (segunda a domingo) para limite semanal
      const ref = new Date(dateStr + 'T00:00:00');
      const dow = ref.getDay();
      const diffToMon = (dow + 6) % 7;
      const semanaIni = new Date(ref); semanaIni.setDate(ref.getDate() - diffToMon);
      const semanaFim = new Date(semanaIni); semanaFim.setDate(semanaIni.getDate() + 6);
      const semanaIniStr = semanaIni.toISOString().split('T')[0];
      const semanaFimStr = semanaFim.toISOString().split('T')[0];

      const [conflictsRes, restRes, doDiaRes, doSemRes] = await Promise.all([
        supabase.rpc('check_shift_conflict', {
          p_profissional_id: pid, p_data: dateStr,
          p_hora_inicio: data.hora_inicio, p_hora_fim: data.hora_fim,
          p_exclude_id: editingId,
        }),
        supabase.rpc('check_descanso_minimo', {
          p_profissional_id: pid, p_data: dateStr,
          p_hora_inicio: data.hora_inicio, p_hora_fim: data.hora_fim,
          p_descanso_horas: descansoMinimo, p_exclude_id: editingId,
        }),
        (() => {
          let q = supabase.from('shifts').select('carga_horaria')
            .eq('profissional_id', pid).eq('data', dateStr).neq('status', 'cancelado');
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

    const resultados = await Promise.all(
      data.profissional_ids.flatMap(pid => 
        allDates.map(date => validarProfissionalData(pid, date))
      )
    );
    resultados.forEach(r => erros.push(...r));


    if (erros.length > 0) {
      const cabecalho = erros.length === 1
        ? 'Não foi possível salvar:'
        : `Não foi possível salvar — ${erros.length} conflitos detectados:`;
      throw new Error(`${cabecalho}\n• ${erros.join('\n• ')}`);
    }
    return { allDates };
  };


  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      // Captura snapshot da lista atual no momento exato do submit (deduplicada)
      const idsSnapshot = Array.from(new Set(data.profissional_ids));
      if (!idsSnapshot.length) throw new Error('Selecione ao menos um profissional.');
      const finalData = { ...data, profissional_ids: idsSnapshot };
      // Revalidação server-side final — valida TODOS os selecionados, não apenas o primeiro
      const { allDates } = await revalidateServerSide(finalData);

      const hours = calcHours(finalData.hora_inicio, finalData.hora_fim);
      
      if (editingId) {
        const pid = finalData.profissional_ids[0];
        const prof = (professionals as any[]).find(p => p.id === pid);
        const payload = {
          unidade_id: finalData.unidade_id, 
          setor_id: finalData.setor_ids[0], 
          profissao: prof?.profissao || finalData.profissao_ids[0] as any,
          data: allDates[0], 
          hora_inicio: finalData.hora_inicio, 
          hora_fim: finalData.hora_fim,
          carga_horaria: hours, 
          tipo_plantao: finalData.tipo_plantao,
          observacoes: finalData.observacoes || null, 
          status: finalData.status as any,
          profissional_id: pid
        };
        const { error } = await supabase.from('shifts').update(payload).eq('id', editingId);
        if (error) throw error;
        await logAudit('Plantão editado', 'escala', { id: editingId });
      } else {
        const payloads = finalData.profissional_ids.flatMap(pid => {
          const prof = (professionals as any[]).find(p => p.id === pid);
          return finalData.setor_ids.flatMap(sid => 
            allDates.map(date => ({
              unidade_id: finalData.unidade_id, 
              setor_id: sid, 
              profissao: prof?.profissao || finalData.profissao_ids[0] as any,
              data: date, 
              hora_inicio: finalData.hora_inicio, 
              hora_fim: finalData.hora_fim,
              carga_horaria: hours, 
              tipo_plantao: finalData.tipo_plantao,
              observacoes: finalData.observacoes || null, 
              status: finalData.status as any,
              profissional_id: pid
            }))
          );
        });
        const { error } = await supabase.from('shifts').insert(payloads);
        if (error) throw error;
        await logAudit('Plantões criados em lote', 'escala', { 
          count: payloads.length, 
          profissionais: finalData.profissional_ids.length,
          setores: finalData.setor_ids.length,
          datas: allDates.length
        });
        for (const pid of finalData.profissional_ids) {
          await dispatchNotification({
            professionalId: pid, tipo: 'plantao', titulo: 'Novos plantões agendados',
            mensagem: `${allDates.length} novos plantões foram escalados para você entre ${allDates[0]} e ${allDates[allDates.length-1]}.`,
          });
        }
      }

    },
    onSuccess: () => {
      invalidateCrossShifts(qc);
      toast.success(editingId ? 'Plantão atualizado!' : `${form.profissional_ids.length} plantão(ões) criado(s)!`);
      if (keepOpenAfterSaveRef.current && !editingId) {
        // Mantém unidade/setor/profissão/data/tipo/horário; limpa apenas profissionais e observações
        setForm(f => ({ ...f, profissional_ids: [], observacoes: '' }));
        setConflictWarnings([]); setRestWarnings([]); setWorkloadAlerts([]);
        keepOpenAfterSaveRef.current = false;
      } else {
        closeModal();
      }
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

  // ------ Cancelar plantão (sem excluir) ------
  const cancelMutation = useMutation({
    mutationFn: async (shift: any) => {
      const { error } = await supabase.from('shifts')
        .update({ status: 'cancelado' as any })
        .eq('id', shift.id);
      if (error) throw error;
      await logAudit('Plantão cancelado', 'escala', {
        id: shift.id, profissional_id: shift.profissional_id, data: shift.data,
      });
      await dispatchNotification({
        professionalId: shift.profissional_id, tipo: 'plantao',
        titulo: '⚠️ Plantão cancelado',
        mensagem: `Seu plantão em ${new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR')} (${shift.hora_inicio}-${shift.hora_fim}) foi cancelado pela gestão.`,
      });
    },
    onSuccess: () => { toast.success('Plantão cancelado'); invalidateCrossShifts(qc); },
    onError: (e: Error) => toast.error(`Não foi possível cancelar: ${e.message}`),
  });

  // ------ Envio de notificação manual ao profissional do plantão ------
  const notifyMutation = useMutation({
    mutationFn: async ({ shift, mensagem }: { shift: any; mensagem: string }) => {
      await dispatchNotification({
        professionalId: shift.profissional_id, tipo: 'plantao',
        titulo: '🔔 Aviso sobre plantão',
        mensagem: `${new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR')} ${shift.hora_inicio}-${shift.hora_fim} — ${mensagem}`,
      });
      await logAudit('Notificação manual enviada', 'escala', { shift_id: shift.id, mensagem });
    },
    onSuccess: () => toast.success('Notificação enviada'),
    onError: (e: Error) => toast.error(`Falha ao notificar: ${e.message}`),
  });

  // ------ Solicitar troca a partir de uma célula (gestor cria solicitação aberta) ------
  const requestSwapMutation = useMutation({
    mutationFn: async (shift: any) => {
      const profissionalId = isProfessional ? null : shift.profissional_id;
      const solicitanteId = isProfessional ? shift.profissional_id : shift.profissional_id;
      const { error } = await supabase.from('shift_swaps').insert({
        shift_id: shift.id,
        solicitante_id: solicitanteId,
        destinatario_id: null,
        tipo: 'grupo',
        motivo: 'Solicitação aberta pela escala',
        status: 'solicitada' as any,
      } as any);
      if (error) throw error;
      await logAudit('Troca solicitada via escala', 'trocas', { shift_id: shift.id });
    },
    onSuccess: () => { toast.success('Solicitação de troca aberta'); invalidateCrossShifts(qc); },
    onError: (e: Error) => toast.error(`Falha ao solicitar troca: ${e.message}`),
  });


  // ============================================================
  // Ações secundárias da Escala (Imprimir, Exportar, Copiar, Validar, Publicar, Enviar)
  // ============================================================
  
  const canManage = isMaster || isCoordinator;

  const [copySemanaOpen, setCopySemanaOpen] = useState(false);
  const [copyMesOpen, setCopyMesOpen] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [validatingAll, setValidatingAll] = useState(false);
  const [copySemanaForm, setCopySemanaForm] = useState({ origem: '', destino: '' });
  const [copyMesForm, setCopyMesForm] = useState({ origem: '', destino: '' });
  const [enviarForm, setEnviarForm] = useState({ canal: 'email' as 'email' | 'whatsapp', mensagem: '' });

  // Helpers de período
  const ymd = (d: Date) => d.toISOString().split('T')[0];
  const startOfWeek = (d: Date) => { const x = new Date(d); const dow = x.getDay(); const diff = (dow + 6) % 7; x.setDate(x.getDate() - diff); x.setHours(0,0,0,0); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfMonth = (year: number, month: number) => new Date(year, month, 1);
  const endOfMonth = (year: number, month: number) => new Date(year, month + 1, 0);

  const EXPORT_COLS = ['Profissional', 'Profissão', 'Unidade', 'Setor', 'Data', 'Horário', 'Carga', 'Tipo', 'Status'];

  // ==========================================================
  // Imprimir Escala — modal completo, dados reais e seguros
  // (NÃO expõe CPF, banco, endereço residencial ou observações privadas do profissional)
  // ==========================================================
  type PrintModelo =
    | 'mensal_oficial'
    | 'semanal_simples'
    | 'lista'
    | 'por_profissional'
    | 'por_setor'
    | 'detalhado'; // legado mantido p/ compatibilidade
  type PrintForm = {
    modelo: PrintModelo;
    periodo: 'semana' | 'mes' | 'personalizado';
    dataIni: string;
    dataFim: string;
    mesRef: string; // YYYY-MM (usado no modelo mensal_oficial)
    unidadeId: string;
    setorId: string;
    profissionalId: string;
    profissao: string;
    tipoPlantao: string;
    status: string;
    somentePublicada: boolean;
    incluirFolgas: boolean;
    incluirAfastamentos: boolean;
    incluirObservacoes: boolean;
    incluirObservacoesRodape: boolean;
    incluirTotalHoras: boolean;
    incluirADN: boolean;
    incluirAssinatura: boolean;
    incluirConselho: boolean;
    incluirLogo: boolean;
    totalLabel: 'TOTAL' | 'ADN';
    responsavelNome: string;
    responsavelCargo: string;
    responsavelConselho: string;
  };

  const _hojeRef = new Date();
  const _semIni = startOfWeek(_hojeRef);
  const _mesRefStr = `${_hojeRef.getFullYear()}-${String(_hojeRef.getMonth() + 1).padStart(2, '0')}`;
  const [printForm, setPrintForm] = useState<PrintForm>({
    modelo: 'detalhado',
    periodo: 'semana',
    dataIni: ymd(_semIni),
    dataFim: ymd(addDays(_semIni, 6)),
    mesRef: _mesRefStr,
    unidadeId: '', setorId: '', profissionalId: '', profissao: '',
    tipoPlantao: '', status: '',
    somentePublicada: false,
    incluirFolgas: false,
    incluirAfastamentos: false,
    incluirObservacoes: true,
    incluirObservacoesRodape: true,
    incluirTotalHoras: true,
    incluirADN: true,
    incluirAssinatura: true,
    incluirConselho: true,
    incluirLogo: true,
    totalLabel: 'TOTAL',
    responsavelNome: '',
    responsavelCargo: 'Coordenação',
    responsavelConselho: '',
  });
  const [printBusy, setPrintBusy] = useState<null | 'view' | 'print' | 'pdf-open' | 'pdf-save'>(null);

  // Dados da instituição (system_settings.hospital)
  const { data: instituicaoCfg } = useQuery({
    queryKey: ['settings', 'hospital'],
    queryFn: async () => {
      const { data } = await sb.from('system_settings').select('value').eq('key', 'hospital').maybeSingle();
      return (data?.value as { nome?: string; cnpj?: string; endereco?: string }) || {};
    },
  });

  // Responsável padrão da escala (system_settings.escala_responsavel)
  const { data: respCfg } = useQuery({
    queryKey: ['settings', 'escala_responsavel'],
    queryFn: async () => {
      const { data } = await sb.from('system_settings').select('value').eq('key', 'escala_responsavel').maybeSingle();
      return (data?.value as { nome?: string; cargo?: string; conselho?: string }) || {};
    },
  });

  // Aplica defaults do responsável quando o config carregar (apenas se usuário ainda não digitou)
  useEffect(() => {
    if (!respCfg) return;
    setPrintForm((f) => ({
      ...f,
      responsavelNome: f.responsavelNome || respCfg.nome || '',
      responsavelCargo: f.responsavelCargo || respCfg.cargo || 'Coordenação',
      responsavelConselho: f.responsavelConselho || respCfg.conselho || '',
    }));
  }, [respCfg]);

  const aplicarPeriodo = (p: PrintForm['periodo']) => {
    const today = new Date();
    if (p === 'semana') {
      const s = startOfWeek(today);
      setPrintForm(f => ({ ...f, periodo: p, dataIni: ymd(s), dataFim: ymd(addDays(s, 6)) }));
    } else if (p === 'mes') {
      setPrintForm(f => ({
        ...f, periodo: p,
        dataIni: ymd(startOfMonth(today.getFullYear(), today.getMonth())),
        dataFim: ymd(endOfMonth(today.getFullYear(), today.getMonth())),
      }));
    } else {
      setPrintForm(f => ({ ...f, periodo: p }));
    }
  };

  const buildPrintLinhas = async (): Promise<{ linhas: PrintLinha[]; cab: PrintCabecalho } | null> => {
    if (!printForm.dataIni || !printForm.dataFim) {
      toast.error('Selecione o período.'); return null;
    }
    if (printForm.dataFim < printForm.dataIni) {
      toast.error('Período inválido: data final é anterior à inicial.'); return null;
    }

    // Busca real do banco respeitando RLS, sem expor PII (sem CPF/banco/endereço)
    let q = sb.from('shifts')
      .select('id, data, hora_inicio, hora_fim, carga_horaria, tipo_plantao, status, observacoes, profissional_id, professionals:profissional_id(nome, profissao, conselho, registro, documento_numero, documento_conselho), units:unidade_id(nome), sectors:setor_id(nome), unidade_id, setor_id, profissao')
      .gte('data', printForm.dataIni)
      .lte('data', printForm.dataFim)
      .order('data', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (printForm.unidadeId) q = q.eq('unidade_id', printForm.unidadeId);
    if (printForm.setorId) q = q.eq('setor_id', printForm.setorId);
    if (printForm.profissionalId) q = q.eq('profissional_id', printForm.profissionalId);
    if (printForm.profissao) q = q.eq('profissao', printForm.profissao);
    if (printForm.tipoPlantao) q = q.eq('tipo_plantao', printForm.tipoPlantao);
    if (printForm.status) q = q.eq('status', printForm.status);
    if (printForm.somentePublicada) q = q.in('status', ['confirmado', 'concluido', 'agendado']);

    const { data, error } = await q;
    if (error) { toast.error('Falha ao carregar plantões: ' + error.message); return null; }

    let rows = (data as any[]) || [];
    if (!printForm.incluirFolgas) {
      rows = rows.filter((r) => !['folga', 'indisponibilidade'].includes(String(r.tipo_plantao || '').toLowerCase()));
    }

    const linhas: PrintLinha[] = rows.map((s: any) => {
      const prof = s.professionals || {};
      const conselho = (prof.conselho || prof.registro || prof.documento_conselho || prof.documento_numero)
        ? `${prof.conselho || prof.documento_conselho || ''} ${prof.registro || prof.documento_numero || ''}`.trim()
        : 'Não informado';
      return {
        profissional: prof.nome || '—',
        profissao: PROFISSAO_LABELS[prof.profissao] || prof.profissao || '',
        conselho,
        unidade: s.units?.nome || '',
        setor: s.sectors?.nome || '',
        data: new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'),
        diaSemana: diaSemanaPt(s.data),
        tipo: s.tipo_plantao || '',
        horario: `${(s.hora_inicio || '').slice(0, 5)} - ${(s.hora_fim || '').slice(0, 5)}`,
        status: STATUS_LABELS[s.status] || s.status,
        cargaHoras: Number(s.carga_horaria) || 0,
        observacoes: printForm.incluirObservacoes ? (s.observacoes || '') : '',
      };
    });

    const periodoLabel = `${new Date(printForm.dataIni + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(printForm.dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`;
    const unidadeNome = printForm.unidadeId
      ? ((units as any[]).find((u: any) => u.id === printForm.unidadeId)?.nome || '')
      : 'Todas';
    const setorNome = printForm.setorId
      ? ((sectors as any[]).find((x: any) => x.id === printForm.setorId)?.nome || '')
      : 'Todos';

    const cab: PrintCabecalho = {
      instituicao: {
        nome: instituicaoCfg?.nome || 'HOSPITAL MUNICIPAL DE ORIXIMINÁ',
        cnpj: instituicaoCfg?.cnpj,
        endereco: instituicaoCfg?.endereco,
      },
      unidade: unidadeNome,
      setor: setorNome,
      periodoLabel,
      emitidoPor: profileName || user?.email || '—',
      sistema: 'GestorPlantão SMS Oriximiná',
    };

    return { linhas, cab };
  };

  const printOpts = (): PrintOptions => ({
    incluirObservacoes: printForm.incluirObservacoes,
    incluirAssinatura: printForm.incluirAssinatura,
    incluirTotalHoras: printForm.incluirTotalHoras,
    incluirConselho: printForm.incluirConselho,
  });

  // ============== Builder do modelo "Escala Mensal Oficial" ==============
  // Agrupa por profissional × dia do mês selecionado (printForm.mesRef)
  const buildMensalOficial = async (): Promise<{ profs: MensalProfissional[]; cab: MensalCabecalho; tipos: MensalTipoLegenda[] } | null> => {
    if (!printForm.mesRef) { toast.error('Selecione o mês.'); return null; }
    const [yStr, mStr] = printForm.mesRef.split('-');
    const ano = parseInt(yStr, 10);
    const mes = parseInt(mStr, 10);
    if (!ano || !mes) { toast.error('Mês inválido.'); return null; }
    const dataIni = `${yStr}-${mStr}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${yStr}-${mStr}-${String(ultimoDia).padStart(2, '0')}`;

    let q = sb.from('shifts')
      .select('id, data, hora_inicio, hora_fim, carga_horaria, tipo_plantao, status, profissional_id, professionals:profissional_id(nome, profissao, conselho, registro, documento_numero, documento_conselho, recebe_adicional_noturno, is_plantonista, cargo), units:unidade_id(nome), sectors:setor_id(nome), unidade_id, setor_id, profissao')
      .gte('data', dataIni).lte('data', dataFim)
      .order('data', { ascending: true })
      .order('hora_inicio', { ascending: true });
    if (printForm.unidadeId) q = q.eq('unidade_id', printForm.unidadeId);
    if (printForm.setorId) q = q.eq('setor_id', printForm.setorId);
    if (printForm.profissionalId) q = q.eq('profissional_id', printForm.profissionalId);
    if (printForm.profissao) q = q.eq('profissao', printForm.profissao);
    if (printForm.tipoPlantao) q = q.eq('tipo_plantao', printForm.tipoPlantao);
    if (printForm.status) q = q.eq('status', printForm.status);
    if (printForm.somentePublicada) q = q.in('status', ['confirmado', 'concluido', 'agendado']);

    const { data, error } = await q;
    if (error) { toast.error('Falha ao carregar plantões: ' + error.message); return null; }

    let rows = (data as any[]) || [];
    if (!printForm.incluirFolgas) {
      rows = rows.filter((r) => !['folga', 'indisponibilidade'].includes(String(r.tipo_plantao || '').toLowerCase()));
    }
    if (!printForm.incluirAfastamentos) {
      rows = rows.filter((r) => {
        const t = String(r.tipo_plantao || '').toLowerCase();
        return !['ferias', 'férias', 'licenca', 'licença', 'licenca premio', 'licença prêmio', 'lp', 'atestado'].some((k) => t.includes(k));
      });
    }

    // Agrupa por profissional
    const map = new Map<string, MensalProfissional>();
    for (const s of rows) {
      const profId = s.profissional_id;
      if (!profId) continue;
      const prof = s.professionals || {};
      let row = map.get(profId);
      if (!row) {
        const conselho = (prof.conselho || prof.registro || prof.documento_conselho || prof.documento_numero)
          ? `${prof.conselho || prof.documento_conselho || ''} ${prof.registro || prof.documento_numero || ''}`.trim()
          : 'Não inf.';
        
        // Normalização rigorosa do cargo para conferir se é plantonista
        const cargoNormalizado = (prof.cargo || '').toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
          .trim();
        
        const isPlantonista = cargoNormalizado.includes('plantonista');
        
        // Verifica elegibilidade ADN com base nas novas configurações
        let elegivelADN = false;
        if (adnConfig && adnConfig.enabled) {
          const byFlag = adnConfig.eligibility.by_flag && (!!prof.recebe_adicional_noturno || !!prof.is_plantonista);
          const byRole = adnConfig.eligibility.by_role && adnConfig.eligibility.roles.some(r => {
            const rNorm = r.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
            return cargoNormalizado === rNorm || (prof.cargo || '').toLowerCase().trim() === r.toLowerCase().trim();
          });
          elegivelADN = byFlag || byRole;
        } else if (!adnConfig) {
          // Fallback para regra antiga se não houver config
          elegivelADN = !!prof.recebe_adicional_noturno || !!prof.is_plantonista || isPlantonista;
        }

        row = {
          id: profId,
          nome: prof.nome || '—',
          profissao: PROFISSAO_LABELS[prof.profissao] || prof.profissao || '',
          conselho,
          unidade: (s.units as any)?.nome || '',
          setor: (s.sectors as any)?.nome || '',
          porDia: {},
          totalHoras: 0,
          totalPlantoes: 0,
          totalADN: 0,
          elegivelADN,
        };
        map.set(profId, row);
      }
      const dia = parseInt(String(s.data).slice(8, 10), 10);
      const currentSigla = tipoToSigla(s.tipo_plantao);
      if (!row.porDia[dia]) row.porDia[dia] = [];
      row.porDia[dia].push({
        dia,
        sigla: currentSigla,
        tipo: s.tipo_plantao,
        hora_inicio: s.hora_inicio,
        hora_fim: s.hora_fim,
        carga: Number(s.carga_horaria) || 0,
        status: s.status,
      });
      const carga = Number(s.carga_horaria) || 0;
      if (s.status !== 'cancelado' && !['folga', 'indisponibilidade'].includes(String(s.tipo_plantao || '').toLowerCase())) {
        row.totalHoras += carga;
        row.totalPlantoes += 1;
        
        // Cálculo ADN (Adicional Noturno) - Regra configurável
        if (row.elegivelADN) {
          const shiftName = s.tipo_plantao;
          const generatesADN = !adnConfig?.shift_types?.length || (shiftName && adnConfig.shift_types.includes(shiftName));
          
          if (generatesADN) {
            const adnHoras = calculateAdicionalNoturno(
              s.hora_inicio, 
              s.hora_fim, 
              adnConfig?.start_time || "23:00", 
              adnConfig?.end_time || "07:00"
            );
            row.totalADN += adnHoras;
          }
        }


      }
    }

    const profs = Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));

    const setorNome = printForm.setorId
      ? ((sectors as any[]).find((x: any) => x.id === printForm.setorId)?.nome || '')
      : undefined;
    const unidadeNome = printForm.unidadeId
      ? ((units as any[]).find((u: any) => u.id === printForm.unidadeId)?.nome || '')
      : (instituicaoCfg?.nome || 'Hospital Municipal de Oriximiná');

    const profissaoLabel = printForm.profissao
      ? (PROFISSAO_LABELS[printForm.profissao] || printForm.profissao)
      : undefined;

    const cab: MensalCabecalho = {
      instituicao: {
        prefeitura: 'Prefeitura Municipal de Oriximiná',
        secretaria: 'Secretaria Municipal de Saúde',
        unidade: unidadeNome,
        cnpj: instituicaoCfg?.cnpj,
      },
      ano, mes,
      setor: setorNome,
      profissaoLabel,
      emitidoPor: profileName || user?.email || '—',
      sistema: 'GestorPlantão SMS Oriximiná',
    };

    // Legenda automática a partir dos tipos configurados
    const tipos: MensalTipoLegenda[] = (TIPOS_PLANTAO || []).map((t) => ({
      sigla: t.sigla,
      nome: t.value,
      start: t.start,
      end: t.end,
      carga: t.carga,
    }));

    return { profs, cab, tipos };
  };

  const getMensalOpts = async (unidadeId?: string): Promise<MensalOpts> => {
    // 1. Identifica o perfil do usuário logado que está gerando a escala
    let gestorSignature: ResolvedSignature | null = null;
    
    // Tenta buscar o profissional vinculado ao usuário logado
    const { data: profProfile } = await supabase
      .from('profiles')
      .select('profissional_id')
      .eq('user_id', user?.id || '')
      .maybeSingle();
      
    const effectiveProfId = profProfile?.profissional_id || currentProfId;

    if (effectiveProfId) {
      gestorSignature = await resolveSignatureData({ professionalId: effectiveProfId });
    }
    
    // 2. Determina os blocos esquerdo e direito conforme a regra de negócio
    let responsavel: ResolvedSignature | null = gestorSignature;
    let responsavelSecundario: ResolvedSignature | null = null;

    if (isMaster) {
      // SE quem gera é GESTOR MASTER:
      // BLOCO ESQUERDO: Gestor Master (ele mesmo)
      // BLOCO DIREITO: Responsável Técnico da Unidade
      responsavelSecundario = await resolveRTForUnidade(unidadeId);
    } else if (isCoordinator) {
      // SE quem gera é COORDENADOR:
      // BLOCO ESQUERDO: Coordenador (ele mesmo)
      // BLOCO DIREITO: Gestor Master da Unidade
      responsavelSecundario = await resolveGestorMasterForUnidade(unidadeId);
    } else {
      // Outros casos: mantemos o padrão anterior
      responsavelSecundario = await resolveRTForUnidade(unidadeId);
    }

    // Validação de carimbo próprio para o aviso em tela
    const hasAnySignature = gestorSignature?.hasVisualSignature || gestorSignature?.hasStamp || gestorSignature?.hasDigitalSeal;
    if (!hasAnySignature) {
      toast.warning(
        "Atenção: você não possui assinatura ou carimbo cadastrado. O documento será gerado com campo em branco para assinatura manual.", 
        { duration: 8000 }
      );
    }

    const showTotalSetting = settings.exibir_total_escala_consolidada !== false;
    const showADNSetting = adnConfig ? (adnConfig.enabled && adnConfig.display.monthly_scale) : (settings.exibir_adn_escala_consolidada !== false);

    return {
      incluirLogo: printForm.incluirLogo,
      incluirAssinatura: printForm.incluirAssinatura,
      incluirTotalHoras: !isProfessional && showTotalSetting && printForm.incluirTotalHoras,
      incluirADN: showADNSetting && printForm.incluirADN,
      adnLabel: adnConfig?.label,
      adnDecimals: adnConfig?.display?.decimals,
      incluirObservacoesRodape: printForm.incluirObservacoesRodape,
      totalLabel: printForm.totalLabel,
      responsavel: responsavel || {
        nome: profileName || user?.email || "",
        cargo: isMaster ? 'Gestor Master' : (isCoordinator ? 'Coordenador' : 'Gestor'),
        conselho: "",
        unidade: "",
        tipo: isMaster ? 'gestor_master' : 'coordenador'
      },
      responsavelTecnico: responsavelSecundario || {
        nome: "",
        cargo: "",
        conselho: "",
        unidade: "",
        tipo: 'responsavel_tecnico'
      }
    };
  };

  useEffect(() => {
    if (currentStamp && printOpen) {
      setPrintForm(f => ({
        ...f,
        responsavelNome: currentStamp.nome,
        responsavelCargo: currentStamp.cargo,
        responsavelConselho: currentStamp.conselho
      }));
    }
  }, [currentStamp, printOpen]);
  
  // Sincroniza configuração de exibição do total com o formulário de impressão
  useEffect(() => {
    if (settings.exibir_total_escala_consolidada !== undefined) {
      setPrintForm(f => ({ ...f, incluirTotalHoras: settings.exibir_total_escala_consolidada !== false }));
    }
  }, [settings.exibir_total_escala_consolidada]);

  const handlePrintAction = async (acao: 'view' | 'print' | 'pdf-open' | 'pdf-save') => {
    if (printBusy) return;

    // Validação de Carimbo para Gestor/Coordenador
    if (isMaster || isCoordinator) {
      if (!currentStamp) {
        toast.error("Cadastre seu carimbo e assinatura antes de imprimir ou publicar a escala.");
        return;
      }
    }

    // Validações específicas por modelo
    if (printForm.modelo === 'por_profissional' && !printForm.profissionalId) {
      toast.error('Selecione um profissional para o modelo "Escala por profissional".');
      return;
    }
    if (printForm.modelo === 'por_setor' && !printForm.setorId) {
      toast.error('Selecione um setor para o modelo "Escala por setor".');
      return;
    }

    setPrintBusy(acao);
    try {
      // ===== Modelo "Escala Mensal Oficial" =====
      if (printForm.modelo === 'mensal_oficial') {
        const built = await buildMensalOficial();
        if (!built) return;
        const { profs, cab, tipos } = built;
        if (!profs.length) {
          toast.warning('Nenhum plantão encontrado para os filtros selecionados.');
          return;
        }
        const opts = await getMensalOpts(printForm.unidadeId);
        const filename = `escala_oficial_${printForm.mesRef}`;
        if (acao === 'view') {
          const ok = abrirEscalaMensalOficial(cab, profs, tipos, opts, false);
          if (!ok) toast.error('Bloqueador de popups impediu a visualização.');
        } else if (acao === 'print') {
          const ok = abrirEscalaMensalOficial(cab, profs, tipos, opts, true);
          if (!ok) toast.error('Bloqueador de popups impediu a impressão.');
        } else if (acao === 'pdf-open') {
          await gerarPdfEscalaMensalOficial(cab, profs, tipos, opts, filename, 'open');
        } else if (acao === 'pdf-save') {
          await gerarPdfEscalaMensalOficial(cab, profs, tipos, opts, filename, 'save');
        }
        logAudit('Escala impressa/PDF (Mensal Oficial)', 'escala', {
          acao, total: profs.length, mesRef: printForm.mesRef,
          filtros: {
            unidade: printForm.unidadeId || null, setor: printForm.setorId || null,
            profissional: printForm.profissionalId || null, profissao: printForm.profissao || null,
            tipo: printForm.tipoPlantao || null, status: printForm.status || null,
            publicada: printForm.somentePublicada,
          },
        });
        return;
      }

      // ===== Modelo Detalhado (legado, mantido) =====
      const built = await buildPrintLinhas();
      if (!built) return;
      const { linhas, cab } = built;
      if (!linhas.length) {
        toast.warning('Nenhum plantão encontrado para os filtros selecionados.');
        return;
      }
      
      const opts = await getMensalOpts(printForm.unidadeId);
      const pOpts: PrintOptions = {
        ...printOpts(),
        responsavel: opts.responsavel,
        responsavelTecnico: opts.responsavelTecnico
      };

      const filename = `escala_${printForm.dataIni}_a_${printForm.dataFim}`;
      if (acao === 'view') {
        const ok = abrirVisualizacaoImpressao(cab, linhas, pOpts, false);
        if (!ok) toast.error('Bloqueador de popups impediu a visualização.');
      } else if (acao === 'print') {
        const ok = abrirVisualizacaoImpressao(cab, linhas, pOpts, true);
        if (!ok) toast.error('Bloqueador de popups impediu a impressão.');
      } else if (acao === 'pdf-open') {
        await gerarPdfEscala(cab, linhas, pOpts, filename, 'open');
      } else if (acao === 'pdf-save') {
        await gerarPdfEscala(cab, linhas, pOpts, filename, 'save');
      }
      logAudit('Escala impressa/PDF', 'escala', {
        acao, total: linhas.length,
        periodo: `${printForm.dataIni}..${printForm.dataFim}`,
        filtros: {
          unidade: printForm.unidadeId || null, setor: printForm.setorId || null,
          profissional: printForm.profissionalId || null, profissao: printForm.profissao || null,
          tipo: printForm.tipoPlantao || null, status: printForm.status || null,
          publicada: printForm.somentePublicada,
        },
      });
    } catch (e: any) {
      toast.error('Falha: ' + (e?.message || e));
    } finally {
      setPrintBusy(null);
    }
  };

  // Ref para acessar a lista filtrada nas mutations sem reordenar o código
  const filteredRef = useRef<any[]>([]);

  // Copiar período (semana ou mês)
  const copyShifts = async (origemIni: Date, origemFim: Date, destinoIni: Date) => {
    const oIni = ymd(origemIni), oFim = ymd(origemFim);
    const { data: src, error } = await supabase.from('shifts')
      .select('unidade_id, setor_id, profissao, profissional_id, data, hora_inicio, hora_fim, carga_horaria, tipo_plantao, observacoes, status')
      .gte('data', oIni).lte('data', oFim).neq('status', 'cancelado');
    if (error) throw error;
    if (!src || !src.length) throw new Error('Não há plantões no período de origem.');
    const offsetDays = Math.round((destinoIni.getTime() - origemIni.getTime()) / (1000 * 60 * 60 * 24));
    const payloads = src.map((s: any) => {
      const newDate = addDays(new Date(s.data + 'T12:00:00'), offsetDays);
      return {
        unidade_id: s.unidade_id, setor_id: s.setor_id, profissao: s.profissao,
        profissional_id: s.profissional_id, data: ymd(newDate),
        hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, carga_horaria: s.carga_horaria,
        tipo_plantao: s.tipo_plantao, observacoes: s.observacoes,
        status: 'pendente' as any,
      };
    });
    const { error: insErr } = await supabase.from('shifts').insert(payloads);
    if (insErr) throw insErr;
    return payloads.length;
  };

  const copySemanaMutation = useMutation({
    mutationFn: async (f: { origem: string; destino: string }) => {
      if (!f.origem || !f.destino) throw new Error('Selecione semana de origem e de destino.');
      const oIni = startOfWeek(new Date(f.origem + 'T12:00:00'));
      const dIni = startOfWeek(new Date(f.destino + 'T12:00:00'));
      const oFim = addDays(oIni, 6);
      return copyShifts(oIni, oFim, dIni);
    },
    onSuccess: (n) => {
      toast.success(`${n} plantões copiados como rascunho (pendente). Revise e publique.`);
      invalidateCrossShifts(qc);
      setCopySemanaOpen(false); setCopySemanaForm({ origem: '', destino: '' });
      logAudit('Semana copiada', 'escala', { total: n });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyMesMutation = useMutation({
    mutationFn: async (f: { origem: string; destino: string }) => {
      if (!f.origem || !f.destino) throw new Error('Selecione mês de origem e de destino (formato AAAA-MM).');
      const [oy, om] = f.origem.split('-').map(Number);
      const [dy, dm] = f.destino.split('-').map(Number);
      const oIni = startOfMonth(oy, om - 1);
      const oFim = endOfMonth(oy, om - 1);
      const dIni = startOfMonth(dy, dm - 1);
      return copyShifts(oIni, oFim, dIni);
    },
    onSuccess: (n) => {
      toast.success(`${n} plantões copiados como rascunho. Revise e publique.`);
      invalidateCrossShifts(qc);
      setCopyMesOpen(false); setCopyMesForm({ origem: '', destino: '' });
      logAudit('Mês copiado', 'escala', { total: n });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Validar Conflitos da escala filtrada
  const handleValidarConflitos = async () => {
    if (validatingAll) return;
    setValidatingAll(true);
    try {
      const list = filteredRef.current || [];
      const erros: string[] = [];
      const sample = list.slice(0, 200);
      for (const s of sample) {
        const { data: c } = await supabase.rpc('check_shift_conflict', {
          p_profissional_id: s.profissional_id, p_data: s.data,
          p_hora_inicio: s.hora_inicio, p_hora_fim: s.hora_fim, p_exclude_id: s.id,
        });
        if (c && c.length > 0) {
          erros.push(`${(s.professionals as any)?.nome} em ${new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')}: choque com ${c[0].conflicting_start}-${c[0].conflicting_end}`);
        }
      }
      if (!erros.length) toast.success(`✅ Nenhum conflito encontrado em ${sample.length} plantões.`);
      else toast.error(`${erros.length} conflito(s) detectado(s)`, { description: erros.slice(0, 5).join('\n'), duration: 10000 });
      logAudit('Validação de conflitos', 'escala', { total: sample.length, conflitos: erros.length });
    } catch (e: any) {
      toast.error('Falha ao validar: ' + e.message);
    } finally {
      setValidatingAll(false);
    }
  };

  // Publicar Escala — confirma plantões em rascunho (pendente / em_aberto)
  const publishMutation = useMutation({
    mutationFn: async () => {
      const list = filteredRef.current || [];
      const candidates = list.filter((s: any) => ['pendente', 'em_aberto'].includes(s.status));
      if (!candidates.length) throw new Error('Nenhum plantão em rascunho (pendente/em aberto) com os filtros atuais.');
      const ids = candidates.map((s: any) => s.id);
      const { error } = await supabase.from('shifts').update({ status: 'confirmado' as any }).in('id', ids);
      if (error) throw error;
      for (const s of candidates) {
        await dispatchNotification({
          professionalId: s.profissional_id, tipo: 'plantao',
          titulo: '📢 Escala publicada',
          mensagem: `Seu plantão em ${new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')} (${s.hora_inicio}-${s.hora_fim}) foi confirmado.`,
        });
      }
      await logAudit('Escala publicada', 'escala', { total: candidates.length });
      return candidates.length;
    },
    onSuccess: (n) => { toast.success(`${n} plantão(ões) publicado(s) e profissionais notificados.`); invalidateCrossShifts(qc); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Enviar Escala (WhatsApp/E-mail) via webhook configurado
  const enviarMutation = useMutation({
    mutationFn: async (f: { canal: 'email' | 'whatsapp'; mensagem: string }) => {
      const list = filteredRef.current || [];
      const { data: setting } = await sb.from('system_settings').select('value').eq('key', 'webhook').maybeSingle();
      const w: any = setting?.value || {};
      if (!w.url || !w.ativo) throw new Error('Webhook não configurado. Configure em Configurações → Integrações.');
      const payload = {
        evento: 'envio_escala',
        canal: f.canal,
        mensagem: f.mensagem || `Escala de plantões — ${new Date().toLocaleDateString('pt-BR')}`,
        total_plantoes: list.length,
        plantoes: list.slice(0, 200).map((s: any) => ({
          profissional: (s.professionals as any)?.nome,
          email: (professionals as any[]).find((p: any) => p.id === s.profissional_id)?.email,
          telefone: (professionals as any[]).find((p: any) => p.id === s.profissional_id)?.telefone,
          data: s.data, hora_inicio: s.hora_inicio, hora_fim: s.hora_fim,
          setor: (s.sectors as any)?.nome, unidade: (s.units as any)?.nome,
          tipo: s.tipo_plantao, status: s.status,
        })),
      };
      const resp = await fetch(w.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!resp.ok) throw new Error(`Webhook respondeu ${resp.status}`);
      await logAudit('Escala enviada', 'escala', { canal: f.canal, total: payload.total_plantoes });
    },
    onSuccess: () => { toast.success('Escala enviada com sucesso.'); setEnviarOpen(false); setEnviarForm({ canal: 'email', mensagem: '' }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExportPDF = () => {
    const list = filteredRef.current || [];
    if (!list.length) { toast.warning('Nada para exportar com os filtros atuais.'); return; }
    const rows = list.map((s: any) => [
      (s.professionals as any)?.nome || '',
      PROFISSAO_LABELS[(s.professionals as any)?.profissao] || '',
      (s.units as any)?.nome || '',
      (s.sectors as any)?.nome || '',
      new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'),
      `${(s.hora_inicio || '').slice(0,5)} - ${(s.hora_fim || '').slice(0,5)}`,
      `${s.carga_horaria}h`, s.tipo_plantao || '', STATUS_LABELS[s.status] || s.status,
    ]);
    exportToPDF('Escala de Plantões', EXPORT_COLS, rows, `escala_${todayStr}`);
    logAudit('Escala exportada (PDF)', 'escala', { total: list.length });
  };
  const handleExportExcel = () => {
    const list = filteredRef.current || [];
    if (!list.length) { toast.warning('Nada para exportar com os filtros atuais.'); return; }
    const rows = list.map((s: any) => [
      (s.professionals as any)?.nome || '',
      PROFISSAO_LABELS[(s.professionals as any)?.profissao] || '',
      (s.units as any)?.nome || '',
      (s.sectors as any)?.nome || '',
      new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'),
      `${(s.hora_inicio || '').slice(0,5)} - ${(s.hora_fim || '').slice(0,5)}`,
      `${s.carga_horaria}h`, s.tipo_plantao || '', STATUS_LABELS[s.status] || s.status,
    ]);
    exportToExcel('Escala', EXPORT_COLS, rows, `escala_${todayStr}`);
    logAudit('Escala exportada (Excel)', 'escala', { total: list.length });
  };

  const closeModal = () => {
    setModalOpen(false); setEditingId(null); setForm(emptyForm);
    setConflictWarnings([]); setRestWarnings([]); setWorkloadAlerts([]);
    setHorasPorProfissional({});
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      unidade_id: s.unidade_id, setor_ids: [s.setor_id], profissao_ids: [s.profissao],
      profissional_ids: [s.profissional_id], dates: [s.data],
      repeat_days: [], repeat_until: '', date_mode: 'single',
      hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, tipo_plantao: s.tipo_plantao,
      observacoes: s.observacoes || '', status: s.status,
    });
    setModalOpen(true);
  };

  const openCreateForCell = (date: string, sectorId?: string, unidadeId?: string, tipoSugerido?: string) => {
    setEditingId(null);
    const tipoDefault = tipoSugerido
      || filtros.tipoPlantao
      || (TIPOS_PLANTAO[0]?.value ?? '');
    const preset = TIPOS_PLANTAO.find(t => t.value === tipoDefault);
    setForm({
      ...emptyForm, 
      dates: [date],
      setor_ids: sectorId ? [sectorId] : (filtros.setorId ? [filtros.setorId] : []),
      unidade_id: unidadeId || filtros.unidadeId || '',
      tipo_plantao: tipoDefault || emptyForm.tipo_plantao,
      hora_inicio: preset?.start ?? emptyForm.hora_inicio,
      hora_fim: preset?.end ?? emptyForm.hora_fim,
    });
    setModalOpen(true);
  };


  // Filtro inicial vindo de outras telas (ex.: SetoresPage → "Ver escala do setor/unidade")
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('escala:filtroInicial');
      if (!raw) return;
      sessionStorage.removeItem('escala:filtroInicial');
      const f = JSON.parse(raw) as { unidadeId?: string; setorId?: string };
      if (f && (f.unidadeId || f.setorId)) {
        setFiltros(prev => ({ ...prev, unidadeId: f.unidadeId || '', setorId: f.setorId || '' }));
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recebe instruções vindas de outras telas (ex.: SetoresPage → "Criar plantão para setor")
  // Estrutura no sessionStorage: { unidadeId, setorId, data?, tipo? }
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('escala:prefillNovoPlantao');
      if (!raw) return;
      sessionStorage.removeItem('escala:prefillNovoPlantao');
      const p = JSON.parse(raw) as { unidadeId?: string; setorId?: string; data?: string; tipo?: string };
      if (p?.unidadeId) setFiltros(f => ({ ...f, unidadeId: p.unidadeId!, setorId: p.setorId || '' }));
      const data = p?.data || new Date().toISOString().slice(0, 10);
      // Aguarda um tick para garantir que filtros sejam aplicados
      setTimeout(() => openCreateForCell(data, p?.setorId, p?.unidadeId, p?.tipo), 50);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Abre o menu de ações da célula vazia (com data + setor/unidade do filtro)
  const openEmptyCellMenu = (date: string, sectorId?: string, unidadeId?: string) => {
    setEmptyCell({
      data: date,
      setorId: sectorId || filtros.setorId || undefined,
      unidadeId: unidadeId || filtros.unidadeId || undefined,
    });
  };

  // Imprime comprovante individual de plantão (sem expor dados sensíveis).
  const printShiftReceipt = (s: any) => {
    if (!s) return;
    const prof = (s.professionals as any) || (professionals as any[]).find((p: any) => p.id === s.profissional_id) || {};
    const unidadeNome = (s.units as any)?.nome || (units as any[]).find((u: any) => u.id === s.unidade_id)?.nome || '';
    const setorNome = (s.sectors as any)?.nome || (sectors as any[]).find((sec: any) => sec.id === s.setor_id)?.nome || '';
    const conselho = prof.conselho && prof.registro ? `${prof.conselho} ${prof.registro}` : (prof.registro || prof.conselho || '');
    const data: ComprovantePlantaoData = {
      shiftId: s.id,
      data: s.data,
      horaInicio: s.hora_inicio,
      horaFim: s.hora_fim,
      cargaHoraria: s.carga_horaria,
      tipoPlantao: s.tipo_plantao || '',
      status: STATUS_LABELS[s.status] || s.status || '',
      observacoes: s.observacoes || '',
      profissionalNome: prof.nome || '—',
      profissaoLabel: PROFISSAO_LABELS[prof.profissao || s.profissao] || prof.profissao || s.profissao || '',
      conselho,
      unidadeNome,
      setorNome,
      emitidoPor: profileName || user?.email || '—',
    };
    const ok = imprimirComprovantePlantao(data);
    if (!ok) { toast.error('Bloqueador de pop-up impediu a impressão'); return; }
    logAudit('Comprovante de plantão impresso', 'escala', { shift_id: s.id });
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
    // Validação acontece via useEffect debouncado quando o form mudar.
  };

  const isFolgaShift = (s: any) => s?.tipo_plantao === 'folga' || s?.tipo_plantao === 'indisponibilidade';

  // Setores sem cobertura no dia (hoje) — usado pelo filtro "Somente setores descobertos"
  const setoresDescobertosIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of (sectors as any[])) {
      const escalados = (todayAllShifts as any[]).filter((sh: any) => sh.setor_id === s.id).length;
      if (escalados === 0) ids.add(s.id);
    }
    return ids;
  }, [sectors, todayAllShifts]);

  // Conflitos detectados em memória: mesmo profissional+data com sobreposição de horário
  const conflictIds = useMemo(() => {
    const out = new Set<string>();
    const groups = new Map<string, any[]>();
    for (const s of (shifts as any[])) {
      if (s.status === 'cancelado' || isFolgaShift(s)) continue;
      const k = `${s.profissional_id}|${s.data}`;
      (groups.get(k) || groups.set(k, []).get(k)!).push(s);
    }
    for (const arr of groups.values()) {
      if (arr.length < 2) continue;
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          if (a.hora_inicio < b.hora_fim && b.hora_inicio < a.hora_fim) {
            out.add(a.id); out.add(b.id);
          }
        }
      }
    }
    return out;
  }, [shifts]);

  const lookupMaps = useMemo(() => {
    const u: Record<string, string> = {};
    (units as any[]).forEach(x => { u[x.id] = x.nome || ''; });
    const s: Record<string, string> = {};
    (sectors as any[]).forEach(x => { s[x.id] = x.nome || ''; });
    const p: Record<string, { nome: string; profissao: string }> = {};
    (professionals as any[]).forEach(x => { p[x.id] = { nome: x.nome || '', profissao: x.profissao || '' }; });
    return { u, s, p };
  }, [units, sectors, professionals]);

  const buscaTokens = useMemo(() => {
    return buscaDebounced.trim().toLowerCase().split(/\s+/).filter(Boolean);
  }, [buscaDebounced]);

  const filtered = useMemo(() => (shifts as any[]).filter((s: any) => {
    const f = filtros;
    if (f.unidadeId && s.unidade_id !== f.unidadeId) return false;
    if (f.setorId && s.setor_id !== f.setorId) return false;
    if (f.profissao && s.profissao !== f.profissao) return false;
    if (f.profissionalId && s.profissional_id !== f.profissionalId) return false;
    if (f.tipoPlantao && s.tipo_plantao !== f.tipoPlantao) return false;
    if (f.status && s.status !== f.status) return false;
    if (f.dataIni && s.data < f.dataIni) return false;
    if (f.dataFim && s.data > f.dataFim) return false;
    if (f.soPublicados && !['confirmado', 'concluido', 'agendado'].includes(s.status)) return false;
    if (f.soRascunhos && !['pendente', 'em_aberto'].includes(s.status)) return false;
    if (f.soFolgas && !isFolgaShift(s)) return false;
    if (f.soConflitos && !conflictIds.has(s.id)) return false;
    if (f.soDescobertos && !setoresDescobertosIds.has(s.setor_id)) return false;
    if (buscaTokens.length > 0) {
      const prof = lookupMaps.p[s.profissional_id];
      const profNome = (prof?.nome || (s.professionals as any)?.nome || '').toLowerCase();
      const profissaoKey = (prof?.profissao || s.profissao || '').toLowerCase();
      const profissaoLabel = (PROFISSAO_LABELS[prof?.profissao || s.profissao] || '').toLowerCase();
      const unidade = (lookupMaps.u[s.unidade_id] || '').toLowerCase();
      const setor = (lookupMaps.s[s.setor_id] || '').toLowerCase();
      const tipo = (s.tipo_plantao || '').toLowerCase();
      const horario = `${s.hora_inicio || ''} ${s.hora_fim || ''} ${s.hora_inicio || ''}-${s.hora_fim || ''}`.toLowerCase();
      const data = (s.data || '').toLowerCase();
      let dataBR = '';
      if (s.data) { const [y,m,d] = String(s.data).split('-'); dataBR = `${d}/${m}/${y}`; }
      const statusKey = (s.status || '').toLowerCase();
      const statusLabel = (STATUS_LABELS[s.status] || '').toLowerCase();
      const obs = (s.observacoes || '').toLowerCase();
      const haystack = [profNome, profissaoKey, profissaoLabel, unidade, setor, tipo, horario, data, dataBR, statusKey, statusLabel, obs].join(' | ');
      for (const t of buscaTokens) { if (!haystack.includes(t)) return false; }
    }
    return true;
  }), [shifts, filtros, conflictIds, setoresDescobertosIds, buscaTokens, lookupMaps]);
  filteredRef.current = filtered;

  const filtrosAtivos = useMemo(() => {
    const f = filtros;
    let n = 0;
    (['unidadeId','setorId','profissao','profissionalId','tipoPlantao','status','dataIni','dataFim'] as const)
      .forEach(k => { if ((f as any)[k]) n++; });
    if (f.soConflitos) n++; if (f.soDescobertos) n++;
    if (f.soPublicados) n++; if (f.soRascunhos) n++; if (f.soFolgas) n++;
    return n;
  }, [filtros]);

  const aplicarPeriodoFiltro = (p: FiltrosEscala['periodo']) => {
    const t = new Date();
    const ymdL = (d: Date) => d.toISOString().split('T')[0];
    const sow = (d: Date) => { const x = new Date(d); const dow = x.getDay(); const diff = (dow + 6) % 7; x.setDate(x.getDate() - diff); x.setHours(0,0,0,0); return x; };
    const addD = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    if (p === 'semana') {
      const ini = sow(t);
      setFiltros(f => ({ ...f, periodo: p, dataIni: ymdL(ini), dataFim: ymdL(addD(ini, 6)) }));
    } else if (p === 'mes') {
      const ini = new Date(t.getFullYear(), t.getMonth(), 1);
      const fim = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      setFiltros(f => ({ ...f, periodo: p, dataIni: ymdL(ini), dataFim: ymdL(fim) }));
    } else if (p === 'personalizado') {
      setFiltros(f => ({ ...f, periodo: p }));
    } else {
      setFiltros(f => ({ ...f, periodo: '', dataIni: '', dataFim: '' }));
    }
  };

  const limparFiltros = () => setFiltros(filtrosVazios);


  const inputClass = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-colors";

  const toggleProfissional = (pid: string) => {
    setForm(f => {
      const has = f.profissional_ids.includes(pid);
      return { ...f, profissional_ids: has ? f.profissional_ids.filter(x => x !== pid) : [...f.profissional_ids, pid] };
    });
    // Validação acontece via useEffect debouncado quando o form mudar.
  };

  const initials = getInitials;
  const isFolga = isFolgaShift;

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
        hasConflict: conflictIds.has(s.id),
      });
    }
    return Object.values(profMap).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [shifts, TIPOS_PLANTAO, conflictIds]);

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
            <button onClick={() => setView('consolidada')} className={`p-1.5 rounded-md transition-all ${view === 'consolidada' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Escala mensal consolidada"><Table2 className="h-4 w-4" /></button>
          </div>
          {!isProfessional && (
            <button onClick={() => { setFolgaForm(emptyFolga); setFolgaModalOpen(true); }} className="flex items-center gap-1.5 border border-input bg-card px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-colors"><Palmtree className="h-3.5 w-3.5 text-amber-600" /> Folga</button>
          )}
          {!isProfessional && (
            <button onClick={() => { setForm(emptyForm); setEditingId(null); setModalOpen(true); }} className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"><Plus className="h-3.5 w-3.5" /> Novo Plantão</button>
          )}
          <button
            onClick={() => {
              setPrintForm(pf => ({
                ...pf,
                unidadeId: filtros.unidadeId, setorId: filtros.setorId,
                profissionalId: filtros.profissionalId, profissao: filtros.profissao,
                tipoPlantao: filtros.tipoPlantao, status: filtros.status,
                somentePublicada: filtros.soPublicados,
                incluirFolgas: filtros.soFolgas ? true : pf.incluirFolgas,
                ...(filtros.dataIni && filtros.dataFim
                  ? { periodo: 'personalizado' as const, dataIni: filtros.dataIni, dataFim: filtros.dataFim }
                  : {}),
              }));
              setPrintOpen(true);
            }}
            className="flex items-center gap-1.5 border border-input bg-card px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-colors"
            title="Imprimir Escala"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir Escala
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 border border-input bg-card px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-muted text-foreground transition-colors"
            title="Exportar PDF"
          >
            <FileText className="h-3.5 w-3.5" /> Exportar PDF
          </button>
          {canManage && (() => {
            const ref = filtros.dataIni ? new Date(filtros.dataIni + 'T12:00:00') : new Date();
            const ano = ref.getFullYear();
            const mes = ref.getMonth() + 1;
            const escalaKey = `escala_${ano}_${String(mes).padStart(2, '0')}_${filtros.unidadeId || 'all'}_${filtros.setorId || 'all'}`;
            return (
              <SignActionButton
                signLabel="Assinar escala"
                variant="outline"
                competence={`${ano}-${String(mes).padStart(2, '0')}`}
                document={{
                  document_type: 'escala_mensal',
                  document_id: escalaKey,
                  document_title: `Escala ${String(mes).padStart(2, '0')}/${ano}`,
                  content: JSON.stringify({
                    ano, mes,
                    unidadeId: filtros.unidadeId || null,
                    setorId: filtros.setorId || null,
                    totalPlantoes: filtered.length,
                    plantoes: filtered.slice(0, 500).map((s: any) => ({
                      id: s.id, data: s.data, hi: s.hora_inicio, hf: s.hora_fim,
                      profissional: (s.professionals as any)?.nome,
                      setor: (s.sectors as any)?.nome,
                      status: s.status,
                    })),
                  }),
                  metadata: { ano, mes, unidadeId: filtros.unidadeId, setorId: filtros.setorId },
                }}
              />
            );
          })()}
          <MoreActionsMenu
            items={[
              { id: 'exp-excel', label: 'Exportar Excel', icon: <FileSpreadsheet />, onClick: handleExportExcel, group: 'Documentos' },
              { id: 'copy-semana', label: 'Copiar Semana', icon: <CopyPlus />, onClick: () => setCopySemanaOpen(true), hidden: !canManage, group: 'Gestão da escala' },
              { id: 'copy-mes', label: 'Copiar Mês', icon: <CopyPlus />, onClick: () => setCopyMesOpen(true), hidden: !canManage, group: 'Gestão da escala' },
              { id: 'validar', label: validatingAll ? 'Validando...' : 'Validar Conflitos', icon: <ShieldCheck />, onClick: handleValidarConflitos, loading: validatingAll, hidden: !canManage, group: 'Gestão da escala' },
              { id: 'publicar', label: publishMutation.isPending ? 'Publicando...' : 'Publicar Escala', icon: <Megaphone />, onClick: () => publishMutation.mutate(), loading: publishMutation.isPending, hidden: !canManage, group: 'Gestão da escala' },
              { id: 'enviar', label: 'Enviar Escala', icon: <Send />, onClick: () => setEnviarOpen(true), hidden: !canManage, group: 'Gestão da escala' },
            ]}
          />

        </div>
      </div>

      {/* ===== Filtros da Escala ===== */}
      <div className="bg-card border border-border/60 rounded-xl p-3 shadow-[var(--shadow-card)] space-y-3">
        {/* Busca global */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por profissional, profissão, unidade, setor, tipo, horário, data, status ou observação..."
              className="w-full bg-background border border-input rounded-lg pl-9 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50"
              aria-label="Buscar na escala"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {buscaDebounced && (
            <span className="text-[11px] text-muted-foreground">
              {filtered.length} resultado{filtered.length === 1 ? '' : 's'} para "{buscaDebounced}"
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {/* Unidade */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Unidade</label>
            <select value={filtros.unidadeId}
              onChange={e => setFiltros(f => ({ ...f, unidadeId: e.target.value, setorId: '' }))}
              className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 min-w-[140px]">
              <option value="">Todas</option>
              {(units as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>

          {/* Setor (filtrado pela unidade) */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Setor</label>
            <select value={filtros.setorId}
              onChange={e => setFiltros(f => ({ ...f, setorId: e.target.value }))}
              className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 min-w-[140px]">
              <option value="">Todos</option>
              {(sectors as any[])
                .filter((s: any) => !filtros.unidadeId || s.unidade_id === filtros.unidadeId)
                .map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          {/* Profissão */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Profissão</label>
            <select value={filtros.profissao}
              onChange={e => setFiltros(f => ({ ...f, profissao: e.target.value, profissionalId: '' }))}
              className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 min-w-[140px]">
              <option value="">Todas</option>
              {Object.entries(PROFISSAO_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          {/* Profissional (filtrado por profissão / unidade / setor) */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Profissional</label>
            <select value={filtros.profissionalId}
              onChange={e => setFiltros(f => ({ ...f, profissionalId: e.target.value }))}
              className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 min-w-[180px]">
              <option value="">Todos</option>
              {(professionals as any[])
                .filter((p: any) => !filtros.profissao || p.profissao === filtros.profissao)
                .filter((p: any) => !filtros.unidadeId || !p.unidade_principal_id || p.unidade_principal_id === filtros.unidadeId)
                .filter((p: any) => !filtros.setorId || !p.setor_principal_id || p.setor_principal_id === filtros.setorId)
                .map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          {/* Tipo de plantão */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Tipo</label>
            <select value={filtros.tipoPlantao}
              onChange={e => setFiltros(f => ({ ...f, tipoPlantao: e.target.value }))}
              className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 min-w-[140px]">
              <option value="">Todos</option>
              {TIPOS_PLANTAO.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Status</label>
            <select value={filtros.status}
              onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}
              className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 min-w-[130px]">
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Período (preset) */}
          <div className="flex flex-col">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Período</label>
            <div className="flex items-center gap-1">
              {([
                { v: '', l: 'Tudo' },
                { v: 'semana', l: 'Semana' },
                { v: 'mes', l: 'Mês' },
                { v: 'personalizado', l: 'Custom' },
              ] as const).map(o => (
                <button key={o.v} type="button" onClick={() => aplicarPeriodoFiltro(o.v as any)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] border transition ${filtros.periodo === o.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input hover:bg-muted'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Datas (apenas se período definido) */}
          {(filtros.periodo === 'personalizado' || filtros.dataIni || filtros.dataFim) && (
            <>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">De</label>
                <input type="date" value={filtros.dataIni}
                  onChange={e => setFiltros(f => ({ ...f, dataIni: e.target.value, periodo: 'personalizado' }))}
                  className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Até</label>
                <input type="date" value={filtros.dataFim}
                  onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value, periodo: 'personalizado' }))}
                  className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
            </>
          )}

          {/* Limpar */}
          <button type="button" onClick={limparFiltros} disabled={filtrosAtivos === 0}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input bg-background hover:bg-muted text-xs font-medium disabled:opacity-50">
            Limpar filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
          </button>
        </div>

        {/* Toggles rápidos */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/60">
          {([
            ['soConflitos', '⚠️ Somente conflitos'],
            ['soDescobertos', '🚫 Setores descobertos'],
            ['soPublicados', '📢 Publicados'],
            ['soRascunhos', '📝 Rascunhos'],
            ['soFolgas', '🌴 Folgas'],
          ] as const).map(([k, l]) => {
            const active = (filtros as any)[k] as boolean;
            return (
              <button key={k} type="button"
                onClick={() => setFiltros(f => ({ ...f, [k]: !(f as any)[k] }))}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input text-foreground hover:bg-muted'}`}>
                {l}
              </button>
            );
          })}
          <span className="ml-auto text-[11px] text-muted-foreground">{filtered.length} resultado(s)</span>
        </div>
      </div>


      {isLoading ? (
        view === 'lista' ? (
          <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-[var(--shadow-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="table-header">
                  <th className="text-left p-3">Profissional</th><th className="text-left p-3">Profissão</th><th className="text-left p-3">Setor</th><th className="text-left p-3">Data</th><th className="text-left p-3">Horário</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Status</th><th className="text-left p-3">Ações</th>
                </tr></thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="p-3"><div className="h-3 bg-muted rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
        )
      ) : view === 'lista' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2.5">Profissional</th>
                <th className="text-left px-3 py-2.5">Profissão</th>
                <th className="text-left px-3 py-2.5">Setor</th>
                <th className="text-left px-3 py-2.5">Data</th>
                <th className="text-left px-3 py-2.5">Horário</th>
                <th className="text-left px-3 py-2.5">Tipo</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-12 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Calendar className="h-10 w-10 text-muted-foreground/40" />
                      <p className="font-medium text-foreground">
                        {buscaDebounced
                          ? 'Nenhum resultado encontrado para sua busca.'
                          : 'Nenhum plantão encontrado.'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {filtrosAtivos > 0 ? 'Tente ajustar os filtros ativos para ver mais resultados.' : 'Cadastre um novo plantão para começar.'}
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-3">
                        {buscaDebounced && (
                          <button onClick={() => setBusca("")} className="text-primary hover:underline text-xs font-medium">Limpar busca</button>
                        )}
                        {filtrosAtivos > 0 && (
                          <button onClick={limparFiltros} className="text-primary hover:underline text-xs font-medium">Limpar filtros</button>
                        )}
                      </div>
                    </div>
                  </td></tr>
                )}
                {filtered.map((s: any) => (
                  <ShiftRow 
                    key={s.id} 
                    shift={s} 
                    onDetail={setDetailShift}
                    onEdit={openEdit}
                    onPrint={printShiftReceipt}
                    onDelete={(shift) => deleteMutation.mutate(shift)}
                    isDeleting={deleteMutation.isPending}
                    sectorCapacity={sectorCapacity[s.setor_id]}
                    isConflict={conflictIds.has(s.id)}
                    professionalTelefone={(professionals as any[]).find((p: any) => p.id === s.profissional_id)?.telefone}
                  />
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={8} className="px-3 py-2 text-xs text-muted-foreground">
                      Total: <strong className="text-foreground">{filtered.length}</strong> plantão(ões) listado(s)
                      {filtrosAtivos > 0 && <span className="ml-2">· {filtrosAtivos} filtro(s) aplicado(s)</span>}
                    </td>
                  </tr>
                </tfoot>
              )}
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
                openEmptyCellMenu(dateStr);
              }
            }}
            onCreateClick={(dateStr) => openEmptyCellMenu(dateStr)}
          />
        </motion.div>
      ) : view === 'consolidada' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <MonthlyConsolidatedGrid
            shifts={filtered.map((s: any) => ({
              id: s.id,
              profissional_id: s.profissional_id,
              profissional_nome: (s.professionals as any)?.nome || 'Sem nome',
              profissao: PROFISSAO_LABELS[(s.professionals as any)?.profissao] || (s.professionals as any)?.profissao || '',
              cargo: (s.professionals as any)?.cargo || '',
              unidade_nome: (s.units as any)?.nome || '',
              setor_nome: (s.sectors as any)?.nome || '',
              data: s.data,
              tipo_plantao: s.tipo_plantao,
              hora_inicio: s.hora_inicio,
              hora_fim: s.hora_fim,
              carga_horaria: Number(s.carga_horaria || 0),
              status: s.status,
              recebe_adn: (s.professionals as any)?.recebe_adicional_noturno || (s.professionals as any)?.is_plantonista || String((s.professionals as any)?.cargo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim().includes('plantonista'),
              gera_adn: TIPOS_PLANTAO.find(t => t.value === s.tipo_plantao)?.gera_adn,
            }))}
            tipos={TIPOS_PLANTAO}
            initialMonth={filtros.dataIni ? filtros.dataIni.slice(0, 7) : undefined}
            showTotalHours={!isProfessional && settings.exibir_total_escala_consolidada !== false}
            showADN={showADNSetting}
            adnConfig={adnConfig}
            onCellClick={(dateStr, cellShifts) => {
              if (cellShifts.length > 0) {
                // Se houver plantões, abre o detalhe do primeiro (padrão do sistema para simplificar)
                const found = (shifts as any[]).find((s: any) => s.id === cellShifts[0].id);
                if (found) setDetailShift(found);
              } else {
                // Se estiver vazio, abre menu para criar novo
                openEmptyCellMenu(dateStr);
              }
            }}
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-xl border border-border/60 p-5 shadow-[var(--shadow-card)]">
          {/* Navegação do mês */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalMes(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                title="Mês anterior"
              ><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm font-semibold capitalize min-w-[140px] text-center">
                {calMes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCalMes(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                title="Próximo mês"
              ><ChevronRight className="h-4 w-4" /></button>
              <button
                onClick={() => { const t = new Date(); setCalMes(new Date(t.getFullYear(), t.getMonth(), 1)); }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground"
              >Hoje</button>
            </div>
            {/* Legenda compacta */}
            <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Legenda:</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-success/40 border border-success/60" /> Confirmado</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-info/40 border border-info/60" /> Agendado</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-warning/40 border border-warning/60" /> Pendente</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-primary/40 border border-primary/60" /> Em troca</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-orange-500/40 border border-orange-500/60" /> Interrompido</span>
              <span className="inline-flex items-center gap-1"><Palmtree className="h-3 w-3 text-amber-600" /> Folga</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-[11px] font-semibold text-muted-foreground py-2 uppercase tracking-wide">{d}</div>
            ))}
            {(() => {
              const ref = calMes;
              const today = new Date();
              const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1).getDay();
              const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
              const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
              return Array.from({ length: totalCells }, (_, i) => {
                const day = i - firstDay + 1;
                const isValid = day >= 1 && day <= daysInMonth;
                const isToday = isValid && day === today.getDate() && ref.getMonth() === today.getMonth() && ref.getFullYear() === today.getFullYear();
                const dateStr = isValid ? `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                const dayShifts = isValid ? (filtered as any[]).filter((s: any) => s.data === dateStr) : [];
                const onlyFolgas = dayShifts.length > 0 && dayShifts.every(isFolga);
                const setoresCobertos = new Set(dayShifts.filter((s: any) => !isFolga(s)).map((s: any) => s.setor_id));
                const semCobertura = isValid && dayShifts.length > 0 && setoresCobertos.size === 0;
                const isWeekend = isValid && (i % 7 === 0 || i % 7 === 6);
                return (
                  <div key={i}
                    onClick={() => isValid && dayShifts.length === 0 && openEmptyCellMenu(dateStr)}
                    className={`min-h-[110px] p-1.5 rounded-lg border transition-colors text-left ${
                      isValid ? 'border-border/50 hover:border-primary/40 cursor-pointer' : 'border-transparent bg-transparent'
                    } ${isToday ? 'ring-2 ring-primary/50 bg-primary/5' : isWeekend && isValid ? 'bg-muted/30' : ''} ${onlyFolgas ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800' : ''} ${semCobertura ? 'bg-destructive/5 border-destructive/30' : ''}`}>
                    {isValid && (<>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                        <div className="flex items-center gap-0.5">
                          {semCobertura && <AlertCircle className="h-3 w-3 text-destructive" />}
                          {onlyFolgas && <Palmtree className="h-3 w-3 text-amber-600" />}
                          {dayShifts.length > 0 && <span className="text-[9px] text-muted-foreground font-medium">{dayShifts.length}</span>}
                        </div>
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
                              title={`${(s.professionals as any)?.nome} • ${s.tipo_plantao} • ${s.hora_inicio}-${s.hora_fim}`}
                              className={`flex items-center gap-1 rounded-md border px-1 py-0.5 text-[10px] font-semibold leading-tight truncate ${cellClass}`}
                            >
                              <span className="font-bold truncate">{initials((s.professionals as any)?.nome)}</span>
                              <span className="opacity-60">·</span>
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
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Plantão' : 'Lançamento de Plantões em Massa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-muted/30 p-4 rounded-xl space-y-4 border border-border/50">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Configurações Básicas</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Unidade *</label>
                      <select required value={form.unidade_id} onChange={e => setForm(f => ({ ...f, unidade_id: e.target.value, setor_ids: [] }))} className={inputClass}>
                        <option value="">Selecione...</option>
                        {units.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Setores *</label>
                      <MultiSelect
                        options={sectors.filter((s: any) => !form.unidade_id || s.unidade_id === form.unidade_id).map(s => ({ label: s.nome, value: s.id }))}
                        selected={form.setor_ids}
                        onChange={(ids) => setForm(f => ({ ...f, setor_ids: ids }))}
                        placeholder="Selecione os setores..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Profissão *</label>
                      <MultiSelect
                        options={Object.entries(PROFISSAO_LABELS).map(([k, v]) => ({ label: v, value: k }))}
                        selected={form.profissao_ids}
                        onChange={(ids) => setForm(f => ({ ...f, profissao_ids: ids, profissional_ids: [] }))}
                        placeholder="Selecione as profissões..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Tipo de plantão *</label>
                      <select value={form.tipo_plantao} onChange={e => applyTipoPreset(e.target.value)} className={inputClass}>
                        {TIPOS_PLANTAO.map(t => <option key={t.value} value={t.value}>{t.value} ({t.start}–{t.end})</option>)}
                      </select>
                      <div className="flex items-center gap-2 mt-1.5">
                        {(() => { const c = classificarTurno(form.tipo_plantao, form.hora_inicio, form.hora_fim); return (
                          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${c.cls}`}>{c.label}</span>
                        ); })()}
                        <span className="text-[11px] text-muted-foreground">Carga: <strong>{calcHoursSafe(form.hora_inicio, form.hora_fim).toFixed(1)}h</strong></span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Hora início *</label>
                        <input required type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Hora fim *</label>
                        <input required type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} className={inputClass} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Status</label>
                      <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                        {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'trocando').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>





              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Datas *</label>
                  <Tabs value={form.date_mode} onValueChange={(v: any) => setForm(f => ({ ...f, date_mode: v }))} className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-9">
                      <TabsTrigger value="single" title="Data única"><CalendarDays className="h-4 w-4" /></TabsTrigger>
                      <TabsTrigger value="multiple" title="Datas múltiplas"><List className="h-4 w-4" /></TabsTrigger>
                      <TabsTrigger value="range" title="Intervalo"><ArrowLeftRight className="h-4 w-4" /></TabsTrigger>
                      <TabsTrigger value="repeat" title="Repetir"><Repeat className="h-4 w-4" /></TabsTrigger>
                    </TabsList>
                    <TabsContent value="single" className="mt-2">
                      <input required type="date" value={form.dates[0] || ''} onChange={e => setForm(f => ({ ...f, dates: [e.target.value] }))} className={inputClass} />
                    </TabsContent>
                    <TabsContent value="multiple" className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {form.dates.map((d, i) => (
                          <div key={i} className="flex gap-1">
                            <input type="date" value={d} onChange={e => {
                              const newDates = [...form.dates];
                              newDates[i] = e.target.value;
                              setForm(f => ({ ...f, dates: newDates }));
                            }} className={inputClass} />
                            <button type="button" onClick={() => setForm(f => ({ ...f, dates: f.dates.filter((_, idx) => idx !== i) }))} className="p-2 text-destructive"><X className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => setForm(f => ({ ...f, dates: [...f.dates, ''] }))} className="text-xs text-primary font-medium hover:underline">+ Adicionar data</button>
                    </TabsContent>
                    <TabsContent value="range" className="mt-2 grid grid-cols-2 gap-2">
                      <input placeholder="Início" type="date" value={form.dates[0] || ''} onChange={e => setForm(f => {
                        const d = [...f.dates]; d[0] = e.target.value; return { ...f, dates: d };
                      })} className={inputClass} />
                      <input placeholder="Fim" type="date" value={form.dates[1] || ''} onChange={e => setForm(f => {
                        const d = [...f.dates]; d[1] = e.target.value; return { ...f, dates: d };
                      })} className={inputClass} />
                    </TabsContent>
                    <TabsContent value="repeat" className="mt-2 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Início</label>
                          <input type="date" value={form.dates[0] || ''} onChange={e => setForm(f => ({ ...f, dates: [e.target.value] }))} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground">Até</label>
                          <input type="date" value={form.repeat_until} onChange={e => setForm(f => ({ ...f, repeat_until: e.target.value }))} className={inputClass} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setForm(f => {
                              const days = f.repeat_days.includes(i) ? f.repeat_days.filter(d => d !== i) : [...f.repeat_days, i];
                              return { ...f, repeat_days: days };
                            })}
                            className={cn(
                              "h-8 w-8 rounded-full border text-[10px] font-bold transition-colors",
                              form.repeat_days.includes(i) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                  <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-0.5">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                          <UsersIcon className="h-4 w-4 text-primary" /> Profissionais escalados *
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          {profissionaisFiltrados.length} encontrados · {form.profissional_ids.length} selecionados
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, profissional_ids: profissionaisFiltrados.map(p => p.id) }))}
                          className="text-[10px] px-2 py-1 bg-primary/10 text-primary rounded-md font-bold hover:bg-primary/20 transition-colors uppercase"
                        >
                          Selecionar todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, profissional_ids: [] }))}
                          className="text-[10px] px-2 py-1 bg-muted text-muted-foreground rounded-md font-bold hover:bg-muted/80 transition-colors uppercase"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="text"
                        placeholder="Pesquisar por nome, setor ou profissão..."
                        value={profSearch}
                        onChange={(e) => setProfSearch(e.target.value)}
                        className={cn(inputClass, "pl-10 h-10")}
                      />
                      {profSearch && (
                        <button 
                          type="button" 
                          onClick={() => setProfSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="border border-border rounded-lg max-h-[450px] overflow-y-auto bg-background divide-y divide-border/40 shadow-inner">
                      {profissionaisFiltrados.map((p: any) => {
                        const checked = form.profissional_ids.includes(p.id);
                        const horas = horasPorProfissional[p.id] ?? 0;
                        const st = statusPorProf[p.id];
                        const vinculado = form.setor_ids.some(sid => p.setor_principal_id === sid);
                        const pSetor = sectors.find(s => s.id === p.setor_principal_id)?.nome;
                        
                        return (
                          <div 
                            key={p.id} 
                            onClick={() => toggleProfissional(p.id)}
                            className={cn(
                              "flex items-center gap-3 p-4 cursor-pointer transition-all hover:bg-muted/40",
                              checked ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                            )}
                          >
                            <div className="pt-0.5">
                              <input 
                                type="checkbox" 
                                checked={checked} 
                                onChange={(e) => { e.stopPropagation(); toggleProfissional(p.id); }} 
                                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" 
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className={cn(
                                        "text-sm font-bold leading-tight break-words",
                                        checked ? "text-primary" : "text-foreground"
                                      )}>
                                        {p.nome}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="start">
                                      {p.nome}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                  <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 uppercase tracking-tight">
                                    {PROFISSAO_LABELS[p.profissao] || p.profissao}
                                  </span>
                                  {pSetor && (
                                    <span className={cn(
                                      "text-[10px] px-2 py-0.5 rounded-full font-semibold border",
                                      vinculado 
                                        ? "bg-primary/10 text-primary border-primary/20" 
                                        : "bg-muted text-muted-foreground border-border/50"
                                    )}>
                                      {pSetor}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {form.dates[0] && st === 'conflito' && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-destructive text-destructive-foreground flex items-center gap-1.5 shadow-sm">
                                          <AlertTriangle className="h-3.5 w-3.5" /> conflito
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>Conflito detectado na primeira data do lote</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <span className={cn(
                                  "text-[12px] font-bold font-mono px-2.5 py-1 rounded-md border shadow-sm",
                                  horas >= LIMITE_HORAS_MENSAL 
                                    ? "bg-destructive/10 text-destructive border-destructive/30" 
                                    : "bg-muted text-muted-foreground border-border"
                                )}>
                                  {horas}h/220h
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {profissionaisFiltrados.length === 0 && (
                        <div className="p-12 text-center space-y-3">
                          <UsersIcon className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                          <p className="text-sm text-muted-foreground font-medium">Nenhum profissional encontrado com os filtros e busca atuais.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* Resumo do Lote */}
            {!editingId && form.setor_ids.length > 0 && form.profissional_ids.length > 0 && form.dates.length > 0 && (
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between text-sm shadow-sm">
                <div className="flex gap-6">
                  <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">Setores</span><span className="font-bold text-base">{form.setor_ids.length}</span></div>
                  <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-muted-foreground">Profissionais</span><span className="font-bold text-base">{form.profissional_ids.length}</span></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Dias</span>
                    <span className="font-bold text-base">{(() => {
                      if (form.date_mode === 'single') return 1;
                      if (form.date_mode === 'multiple') return form.dates.filter(Boolean).length;
                      if (form.date_mode === 'range' && form.dates[0] && form.dates[1]) {
                        const s = new Date(form.dates[0] + 'T00:00:00'); 
                        const e = new Date(form.dates[1] + 'T00:00:00');
                        return Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
                      }
                      if (form.date_mode === 'repeat' && form.dates[0] && form.repeat_until) {
                        const s = new Date(form.dates[0] + 'T00:00:00');
                        const e = new Date(form.repeat_until + 'T00:00:00');
                        let count = 0;
                        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                          if (form.repeat_days.includes(d.getDay())) count++;
                        }
                        return count;
                      }
                      return 0;
                    })()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-primary block">Total de Lançamentos</span>
                  <div className="text-2xl font-black text-primary tracking-tight">
                    {form.setor_ids.length * form.profissional_ids.length * (() => {
                      if (form.date_mode === 'single') return 1;
                      if (form.date_mode === 'multiple') return form.dates.filter(Boolean).length;
                      if (form.date_mode === 'range' && form.dates[0] && form.dates[1]) {
                        const s = new Date(form.dates[0] + 'T00:00:00'); const e = new Date(form.dates[1] + 'T00:00:00');
                        return Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
                      }
                      if (form.date_mode === 'repeat' && form.dates[0] && form.repeat_until) {
                        const s = new Date(form.dates[0] + 'T00:00:00');
                        const e = new Date(form.repeat_until + 'T00:00:00');
                        let count = 0;
                        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                          if (form.repeat_days.includes(d.getDay())) count++;
                        }
                        return count;
                      }
                      return 0;
                    })()}
                  </div>
                </div>
              </div>
            )}

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
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Observações</label>
              <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className={inputClass} placeholder="Opcional..." />
            </div>
            
            <div className="flex flex-wrap justify-end gap-3 pt-6 border-t">
              <button type="button" onClick={closeModal} className="px-6 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancelar</button>
              {!editingId && (
                <button
                  type="button"
                  onClick={() => {
                    if (saveMutation.isPending || conflictWarnings.length > 0 || restWarnings.length > 0 || form.profissional_ids.length === 0 || form.setor_ids.length === 0) return;
                    keepOpenAfterSaveRef.current = true;
                    saveMutation.mutate(form);
                  }}
                  disabled={saveMutation.isPending || conflictWarnings.length > 0 || restWarnings.length > 0 || form.profissional_ids.length === 0 || form.setor_ids.length === 0}
                  className="px-6 py-2.5 rounded-xl border border-primary/40 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                >
                  Salvar e adicionar outro
                </button>
              )}
              <button type="submit" disabled={saveMutation.isPending || conflictWarnings.length > 0 || restWarnings.length > 0 || form.profissional_ids.length === 0 || form.setor_ids.length === 0} className="px-8 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/20 transition-all">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : editingId ? 'Salvar Alteração' : 'Confirmar Lançamento em Massa'}
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
              {(() => {
                const myProfId = (professionals as any[]).find((p: any) => p.user_id === user?.id)?.id;
                const isOwn = !!myProfId && detailShift.profissional_id === myProfId;
                const isAdministrativo = detailShift.tipo_plantao === 'administrativa' || detailShift.tipo_plantao === 'administrativo';
                const canEdit = canManage && !(isProfessional && isAdministrativo);
                const canCancel = canManage && detailShift.status !== 'cancelado';
                const canDelete = isMaster;
                const canSwap = isOwn || canManage;
                const canNotify = canManage;
                const canViewHistory = canManage;
                const swapState = swapByShiftId[detailShift.id];
                const hasOpenSwap = !!swapState && ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao'].includes(swapState.status);

                return (
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border">
                    {canEdit && (
                      <button onClick={() => { openEdit(detailShift); setDetailShift(null); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                        <Edit className="h-3.5 w-3.5" /> Editar
                      </button>
                    )}
                    {canSwap && !hasOpenSwap && (
                      <button
                        disabled={requestSwapMutation.isPending}
                        onClick={() => { if (!confirm('Solicitar troca para este plantão?')) return; requestSwapMutation.mutate(detailShift, { onSuccess: () => setDetailShift(null) }); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
                        {requestSwapMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />} Solicitar troca
                      </button>
                    )}
                    {canCancel && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button disabled={cancelMutation.isPending}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-warning/40 text-warning text-sm font-medium hover:bg-warning/10 disabled:opacity-50">
                            {cancelMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />} Cancelar
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar plantão?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O profissional será notificado. O registro permanece para histórico.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={cancelMutation.isPending}>Voltar</AlertDialogCancel>
                            <AlertDialogAction disabled={cancelMutation.isPending}
                              onClick={(e) => { e.preventDefault(); if (cancelMutation.isPending) return; cancelMutation.mutate(detailShift, { onSuccess: () => setDetailShift(null) }); }}
                              className="bg-warning text-warning-foreground hover:bg-warning/90">
                              {cancelMutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button disabled={deleteMutation.isPending}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50">
                            {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Excluir
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir plantão?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. {hasOpenSwap && 'A solicitação de troca em aberto será cancelada.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleteMutation.isPending}>Voltar</AlertDialogCancel>
                            <AlertDialogAction disabled={deleteMutation.isPending}
                              onClick={(e) => { e.preventDefault(); if (deleteMutation.isPending) return; deleteMutation.mutate(detailShift, { onSuccess: () => setDetailShift(null) } as any); }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <button
                      onClick={() => printShiftReceipt(detailShift)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                      <Printer className="h-3.5 w-3.5" /> Imprimir comprovante
                    </button>
                    {canNotify && (
                      <button onClick={() => { setNotifyMsg(''); setNotifyTarget(detailShift); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                        <Megaphone className="h-3.5 w-3.5" /> Notificar
                      </button>
                    )}
                    {canViewHistory && (
                      <button onClick={() => setHistoryTarget(detailShift)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                        <FileText className="h-3.5 w-3.5" /> Histórico
                      </button>
                    )}
                    <button onClick={() => setDetailShift(null)}
                      className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
                      Fechar
                    </button>
                  </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Ações da célula vazia */}
      <Dialog open={!!emptyCell} onOpenChange={(o) => !o && setEmptyCell(null)}>
        <DialogContent className="max-w-md">
          {emptyCell && (() => {
            const dataBR = new Date(emptyCell.data + 'T12:00:00').toLocaleDateString('pt-BR');
            const setorNome = emptyCell.setorId ? (sectors as any[]).find(s => s.id === emptyCell.setorId)?.nome : null;
            const unidadeNome = emptyCell.unidadeId ? (units as any[]).find(u => u.id === emptyCell.unidadeId)?.nome : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Ações para {dataBR}</DialogTitle>
                  <DialogDescription>
                    {setorNome ? `Setor: ${setorNome}` : 'Sem setor selecionado'}{unidadeNome ? ` · ${unidadeNome}` : ''}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {canManage && (
                    <button onClick={() => { openCreateForCell(emptyCell.data, emptyCell.setorId, emptyCell.unidadeId); setEmptyCell(null); }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                      <Plus className="h-4 w-4" /> Criar plantão neste dia
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => { openCreateForCell(emptyCell.data, emptyCell.setorId, emptyCell.unidadeId, 'folga'); setEmptyCell(null); }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-400/40 text-amber-700 dark:text-amber-300 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-950/30">
                      <Palmtree className="h-4 w-4" /> Criar folga
                    </button>
                  )}
                  <button onClick={() => { setAvailableProsCell(emptyCell); setEmptyCell(null); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                    <UsersIcon className="h-4 w-4" /> Ver profissionais disponíveis
                  </button>
                  <button onClick={() => { setCoverageCell({ data: emptyCell.data, setorId: emptyCell.setorId }); setEmptyCell(null); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                    <ShieldCheck className="h-4 w-4" /> Ver cobertura do setor
                  </button>
                  <button onClick={() => { setConflictsDay(emptyCell.data); setEmptyCell(null); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted">
                    <AlertTriangle className="h-4 w-4" /> Ver conflitos do dia
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAL: Profissionais disponíveis no dia */}
      <Dialog open={!!availableProsCell} onOpenChange={(o) => !o && setAvailableProsCell(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {availableProsCell && (() => {
            const dataBR = new Date(availableProsCell.data + 'T12:00:00').toLocaleDateString('pt-BR');
            const dayShifts = (shifts as any[]).filter((s: any) => s.data === availableProsCell.data && !isFolgaShift(s) && s.status !== 'cancelado');
            const ocupados = new Set(dayShifts.map((s: any) => s.profissional_id));
            const lista = (professionals as any[])
              .filter((p: any) => p.status === 'ativo')
              .filter((p: any) => !availableProsCell.setorId || !p.setor_principal_id || p.setor_principal_id === availableProsCell.setorId)
              .filter((p: any) => !availableProsCell.unidadeId || !p.unidade_principal_id || p.unidade_principal_id === availableProsCell.unidadeId)
              .filter((p: any) => !ocupados.has(p.id));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5 text-primary" /> Disponíveis em {dataBR}</DialogTitle>
                  <DialogDescription>{lista.length} profissional(is) sem plantão atribuído neste dia.</DialogDescription>
                </DialogHeader>
                <div className="divide-y divide-border max-h-[55vh] overflow-y-auto">
                  {lista.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum profissional disponível.</p>}
                  {lista.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao] || p.profissao}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => {
                            const cell = availableProsCell;
                            setAvailableProsCell(null);
                            openCreateForCell(cell.data, cell.setorId, cell.unidadeId);
                            setForm(f => ({ ...f, profissional_ids: [p.id], profissao: p.profissao }));
                          }}
                          className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90">
                          Escalar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAL: Cobertura do setor no dia */}
      <Dialog open={!!coverageCell} onOpenChange={(o) => !o && setCoverageCell(null)}>
        <DialogContent className="max-w-lg">
          {coverageCell && (() => {
            const dataBR = new Date(coverageCell.data + 'T12:00:00').toLocaleDateString('pt-BR');
            const setoresAlvo = coverageCell.setorId
              ? (sectors as any[]).filter(s => s.id === coverageCell.setorId)
              : (sectors as any[]);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Cobertura — {dataBR}</DialogTitle>
                  <DialogDescription>{setoresAlvo.length} setor(es). Comparativo entre escalados e mínimo configurado.</DialogDescription>
                </DialogHeader>
                <div className="divide-y divide-border max-h-[55vh] overflow-y-auto">
                  {setoresAlvo.map((sec: any) => {
                    const dia = new Date(coverageCell.data + 'T12:00:00').getDay();
                    const isFds = dia === 0 || dia === 6;
                    const minimo = isFds ? (sec.min_profissionais_fds ?? 1) : (sec.min_profissionais_diurno ?? 1);
                    const escalados = (shifts as any[]).filter((s: any) => s.setor_id === sec.id && s.data === coverageCell.data && !isFolgaShift(s) && s.status !== 'cancelado').length;
                    const ok = escalados >= minimo;
                    return (
                      <div key={sec.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{sec.nome}</p>
                          <p className="text-xs text-muted-foreground">Mínimo: {minimo} · Escalados: {escalados}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ok ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {ok ? 'OK' : 'Descoberto'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAL: Conflitos do dia */}
      <Dialog open={!!conflictsDay} onOpenChange={(o) => !o && setConflictsDay(null)}>
        <DialogContent className="max-w-lg">
          {conflictsDay && (() => {
            const dataBR = new Date(conflictsDay + 'T12:00:00').toLocaleDateString('pt-BR');
            const dayConflicts = (shifts as any[]).filter((s: any) => s.data === conflictsDay && conflictIds.has(s.id));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Conflitos em {dataBR}</DialogTitle>
                  <DialogDescription>{dayConflicts.length} plantão(ões) com sobreposição de horário.</DialogDescription>
                </DialogHeader>
                <div className="divide-y divide-border max-h-[55vh] overflow-y-auto">
                  {dayConflicts.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum conflito detectado neste dia.</p>}
                  {dayConflicts.map((s: any) => (
                    <button key={s.id} onClick={() => { setConflictsDay(null); setDetailShift(s); }}
                      className="w-full text-left py-2 hover:bg-muted/40 rounded px-2">
                      <p className="text-sm font-medium text-foreground">{(s.professionals as any)?.nome}</p>
                      <p className="text-xs text-muted-foreground">{(s.sectors as any)?.nome} · {s.hora_inicio}-{s.hora_fim} · {s.tipo_plantao}</p>
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* MODAL: Notificar profissional */}
      <Dialog open={!!notifyTarget} onOpenChange={(o) => { if (!notifyMutation.isPending && !o) setNotifyTarget(null); }}>
        <DialogContent className="max-w-md">
          {notifyTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Enviar notificação</DialogTitle>
                <DialogDescription>
                  Para {(notifyTarget.professionals as any)?.nome} sobre o plantão de {new Date(notifyTarget.data + 'T12:00:00').toLocaleDateString('pt-BR')}.
                </DialogDescription>
              </DialogHeader>
              <textarea
                value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)}
                placeholder="Digite a mensagem..." rows={4}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <DialogFooter>
                <button onClick={() => setNotifyTarget(null)} disabled={notifyMutation.isPending}
                  className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
                  Cancelar
                </button>
                <button
                  disabled={notifyMutation.isPending || !notifyMsg.trim()}
                  onClick={() => notifyMutation.mutate(
                    { shift: notifyTarget, mensagem: notifyMsg.trim() },
                    { onSuccess: () => { setNotifyTarget(null); setDetailShift(null); } }
                  )}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
                  {notifyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {notifyMutation.isPending ? 'Enviando...' : 'Enviar'}
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Histórico/Auditoria do plantão */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {historyTarget && <ShiftHistoryView shiftId={historyTarget.id} />}
        </DialogContent>
      </Dialog>

      {/* MODAL: Imprimir Escala */}
      <Dialog open={printOpen} onOpenChange={(o) => { if (!printBusy) setPrintOpen(o); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Imprimir Escala</DialogTitle>
            <DialogDescription>
              Configure período, filtros e o que deve aparecer no documento. A impressão usa dados reais e respeita as permissões de acesso.
              <span className="block mt-1 text-xs">🔒 Não são impressos CPF, dados bancários nem endereço residencial dos profissionais.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* MODELO */}
            <section>
              <h4 className="text-sm font-semibold mb-2">Modelo de impressão</h4>
              <div className="flex flex-wrap gap-2">
                {([
                  { v: 'mensal_oficial', l: 'Escala Mensal Oficial' },
                  { v: 'semanal_simples', l: 'Escala Semanal Simples' },
                  { v: 'lista', l: 'Lista de Plantões' },
                  { v: 'por_profissional', l: 'Escala por Profissional' },
                  { v: 'por_setor', l: 'Escala por Setor' },
                  { v: 'detalhado', l: 'Detalhado (legado)' },
                ] as const).map(o => (
                  <button key={o.v} type="button"
                    onClick={() => {
                      // Auto-aplica período conforme modelo escolhido
                      if (o.v === 'semanal_simples') {
                        const s = startOfWeek(new Date());
                        setPrintForm(f => ({ ...f, modelo: o.v, periodo: 'semana', dataIni: ymd(s), dataFim: ymd(addDays(s, 6)) }));
                      } else if (o.v === 'lista' || o.v === 'por_profissional' || o.v === 'por_setor') {
                        const t = new Date();
                        setPrintForm(f => ({
                          ...f, modelo: o.v,
                          periodo: 'mes',
                          dataIni: ymd(startOfMonth(t.getFullYear(), t.getMonth())),
                          dataFim: ymd(endOfMonth(t.getFullYear(), t.getMonth())),
                        }));
                      } else {
                        setPrintForm(f => ({ ...f, modelo: o.v }));
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition ${printForm.modelo === o.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
              {printForm.modelo === 'mensal_oficial' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Layout em grade tipo escala em papel hospitalar (Profissional × dias do mês), A4 paisagem, com legenda e assinatura.
                </p>
              )}
              {printForm.modelo === 'semanal_simples' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Imprime a semana selecionada em formato de tabela simples (segunda a domingo).
                </p>
              )}
              {printForm.modelo === 'lista' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Tabela linear com todos os plantões do período aplicando os filtros.
                </p>
              )}
              {printForm.modelo === 'por_profissional' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  ⚠️ Selecione um profissional nos filtros abaixo. Imprime apenas os plantões dele no período.
                </p>
              )}
              {printForm.modelo === 'por_setor' && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  ⚠️ Selecione um setor nos filtros abaixo. Imprime apenas os plantões desse setor no período.
                </p>
              )}
            </section>

            {/* PERÍODO (todos exceto mensal_oficial) */}
            {printForm.modelo !== 'mensal_oficial' && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Período</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {([
                    { v: 'semana', l: 'Semana atual' },
                    { v: 'mes', l: 'Mês atual' },
                    { v: 'personalizado', l: 'Personalizado' },
                  ] as const).map(o => (
                    <button key={o.v} type="button"
                      onClick={() => aplicarPeriodo(o.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition ${printForm.periodo === o.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Data inicial</label>
                    <input type="date" value={printForm.dataIni}
                      onChange={e => setPrintForm(f => ({ ...f, dataIni: e.target.value, periodo: 'personalizado' }))}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Data final</label>
                    <input type="date" value={printForm.dataFim}
                      onChange={e => setPrintForm(f => ({ ...f, dataFim: e.target.value, periodo: 'personalizado' }))}
                      className={inputClass} />
                  </div>
                </div>
              </section>
            )}

            {/* MÊS (modelo mensal_oficial) */}
            {printForm.modelo === 'mensal_oficial' && (
              <section>
                <h4 className="text-sm font-semibold mb-2">Mês de referência</h4>
                <input type="month" value={printForm.mesRef}
                  onChange={e => setPrintForm(f => ({ ...f, mesRef: e.target.value }))}

                  className={inputClass} />
              </section>
            )}

            {/* FILTROS */}
            <section>
              <h4 className="text-sm font-semibold mb-2">Filtros</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Unidade</label>
                  <select value={printForm.unidadeId} onChange={e => setPrintForm(f => ({ ...f, unidadeId: e.target.value, setorId: '' }))} className={inputClass}>
                    <option value="">Todas</option>
                    {(units as any[]).map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Setor</label>
                  <select value={printForm.setorId} onChange={e => setPrintForm(f => ({ ...f, setorId: e.target.value }))} className={inputClass}>
                    <option value="">Todos</option>
                    {(sectors as any[])
                      .filter((s: any) => !printForm.unidadeId || s.unidade_id === printForm.unidadeId)
                      .map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Profissional</label>
                  <select value={printForm.profissionalId} onChange={e => setPrintForm(f => ({ ...f, profissionalId: e.target.value }))} className={inputClass}>
                    <option value="">Todos</option>
                    {(professionals as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Profissão</label>
                  <select value={printForm.profissao} onChange={e => setPrintForm(f => ({ ...f, profissao: e.target.value }))} className={inputClass}>
                    <option value="">Todas</option>
                    {Object.entries(PROFISSAO_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo de plantão</label>
                  <select value={printForm.tipoPlantao} onChange={e => setPrintForm(f => ({ ...f, tipoPlantao: e.target.value }))} className={inputClass}>
                    <option value="">Todos</option>
                    {TIPOS_PLANTAO.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select value={printForm.status} onChange={e => setPrintForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="">Todos</option>
                    {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* OPÇÕES */}
            <section>
              <h4 className="text-sm font-semibold mb-2">Opções de impressão</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(printForm.modelo !== 'mensal_oficial' ? ([
                  ['somentePublicada', 'Somente escala publicada'],
                  ['incluirFolgas', 'Incluir folgas/indisponibilidades'],
                  ['incluirObservacoes', 'Incluir observações'],
                  !isProfessional ? ['incluirTotalHoras', 'Incluir total de horas'] : null,
                  ['incluirAssinatura', 'Incluir campo de assinatura'],
                  ['incluirConselho', 'Incluir conselho/registro'],
                ].filter(Boolean) as any) : ([
                  ['somentePublicada', 'Somente escala publicada'],
                  ['incluirFolgas', 'Incluir folgas'],
                  ['incluirAfastamentos', 'Incluir afastamentos (FE/LP/A)'],
                  (!isProfessional && settings.exibir_total_escala_consolidada !== false) ? ['incluirTotalHoras', 'Mostrar total de horas (em vez de qtd. plantões)'] : null,
                  settings.exibir_adn_escala_consolidada !== false ? ['incluirADN', 'Mostrar Adicional Noturno (ADN)'] : null,
                  ['incluirAssinatura', 'Incluir campo de assinatura'],
                  ['incluirConselho', 'Incluir conselho/registro'],
                  ['incluirLogo', 'Incluir logo da instituição'],
                  ['incluirObservacoesRodape', 'Incluir observações no rodapé'],
                ] as const).filter(Boolean as any)).map(([k, l]: any) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox"
                      checked={(printForm as any)[k]}
                      onChange={e => setPrintForm(f => ({ ...f, [k]: e.target.checked }))}
                      className="rounded border-input" />
                    <span>{l}</span>
                  </label>
                ))}
              </div>
              {printForm.modelo === 'mensal_oficial' && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-muted-foreground">Rótulo da coluna total</label>
                  <div className="flex gap-2 mt-1">
                    {(['TOTAL', 'ADN'] as const).map(v => (
                      <button key={v} type="button"
                        onClick={() => setPrintForm(f => ({ ...f, totalLabel: v }))}
                        className={`px-3 py-1 rounded-md text-xs border ${printForm.totalLabel === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* RESPONSÁVEL (apenas mensal_oficial) */}
            {printForm.modelo === 'mensal_oficial' && printForm.incluirAssinatura && (
              <section className="p-3 bg-muted/30 rounded-lg border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Responsável pela escala</h4>
                  {resolvedSignature && (
                    <div className="flex gap-2">
                      {resolvedSignature.hasVisualSignature ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 text-[10px] py-0">
                          <ShieldCheck className="h-3 w-3" /> Assinatura Visual
                        </Badge>
                      ) : resolvedSignature.hasDigitalSeal ? (
                        <Badge variant="outline" className="bg-info/10 text-info border-info/20 gap-1 text-[10px] py-0">
                          <ShieldCheck className="h-3 w-3" /> Selo Digital
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1 text-[10px] py-0">
                          <AlertTriangle className="h-3 w-3" /> Apenas Texto
                        </Badge>
                      )}
                      {resolvedSignature.hasStamp && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 text-[10px] py-0">
                          <Stamp className="h-3 w-3" /> Carimbo
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Nome</label>
                    <input type="text" value={printForm.responsavelNome}
                      placeholder="Nome do responsável"
                      onChange={e => setPrintForm(f => ({ ...f, responsavelNome: e.target.value }))}
                      className={inputClass} disabled />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Cargo/Função</label>
                    <input type="text" value={printForm.responsavelCargo}
                      placeholder="Coordenação"
                      onChange={e => setPrintForm(f => ({ ...f, responsavelCargo: e.target.value }))}
                      className={inputClass} disabled />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Conselho/Registro</label>
                    <input type="text" value={printForm.responsavelConselho}
                      placeholder="Ex.: COREN-PA 12345"
                      onChange={e => setPrintForm(f => ({ ...f, responsavelConselho: e.target.value }))}
                      className={inputClass} disabled />
                  </div>
                </div>
              </section>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2 flex-wrap">
            <button type="button" onClick={() => setPrintOpen(false)} disabled={!!printBusy}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={() => handlePrintAction('view')} disabled={!!printBusy}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 inline-flex items-center gap-2">
              {printBusy === 'view' && <Loader2 className="h-4 w-4 animate-spin" />} Visualizar
            </button>
            <button type="button" onClick={() => handlePrintAction('pdf-open')} disabled={!!printBusy}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 inline-flex items-center gap-2">
              {printBusy === 'pdf-open' && <Loader2 className="h-4 w-4 animate-spin" />} Gerar PDF
            </button>
            <button type="button" onClick={() => handlePrintAction('pdf-save')} disabled={!!printBusy}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50 inline-flex items-center gap-2">
              {printBusy === 'pdf-save' && <Loader2 className="h-4 w-4 animate-spin" />} Baixar PDF
            </button>
            <button type="button" onClick={() => handlePrintAction('print')} disabled={!!printBusy}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {printBusy === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir direto
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Copiar Semana */}
      <Dialog open={copySemanaOpen} onOpenChange={setCopySemanaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CopyPlus className="h-5 w-5" /> Copiar Semana</DialogTitle>
            <DialogDescription>Copia todos os plantões da semana de origem (segunda a domingo) para a semana de destino. Plantões cancelados são ignorados. Os novos plantões ficam como <strong>pendente</strong> até serem publicados.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!copySemanaMutation.isPending) copySemanaMutation.mutate(copySemanaForm); }} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Data dentro da semana de origem</label>
              <input required type="date" value={copySemanaForm.origem} onChange={e => setCopySemanaForm(f => ({ ...f, origem: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Data dentro da semana de destino</label>
              <input required type="date" value={copySemanaForm.destino} onChange={e => setCopySemanaForm(f => ({ ...f, destino: e.target.value }))} className={inputClass} />
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setCopySemanaOpen(false)} disabled={copySemanaMutation.isPending} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={copySemanaMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
                {copySemanaMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {copySemanaMutation.isPending ? 'Copiando...' : 'Copiar semana'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Copiar Mês */}
      <Dialog open={copyMesOpen} onOpenChange={setCopyMesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CopyPlus className="h-5 w-5" /> Copiar Mês</DialogTitle>
            <DialogDescription>Copia todos os plantões do mês de origem para o mês de destino, mantendo o dia. Os novos plantões ficam como <strong>pendente</strong> até serem publicados.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!copyMesMutation.isPending) copyMesMutation.mutate(copyMesForm); }} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Mês de origem</label>
              <input required type="month" value={copyMesForm.origem} onChange={e => setCopyMesForm(f => ({ ...f, origem: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium">Mês de destino</label>
              <input required type="month" value={copyMesForm.destino} onChange={e => setCopyMesForm(f => ({ ...f, destino: e.target.value }))} className={inputClass} />
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setCopyMesOpen(false)} disabled={copyMesMutation.isPending} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={copyMesMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
                {copyMesMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {copyMesMutation.isPending ? 'Copiando...' : 'Copiar mês'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Enviar Escala */}
      <Dialog open={enviarOpen} onOpenChange={setEnviarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Enviar Escala</DialogTitle>
            <DialogDescription>Envia a escala filtrada via webhook configurado em Configurações → Integrações. {filtered.length} plantões serão incluídos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (!enviarMutation.isPending) enviarMutation.mutate(enviarForm); }} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Canal</label>
              <select value={enviarForm.canal} onChange={e => setEnviarForm(f => ({ ...f, canal: e.target.value as any }))} className={inputClass}>
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem (opcional)</label>
              <textarea rows={3} value={enviarForm.mensagem} onChange={e => setEnviarForm(f => ({ ...f, mensagem: e.target.value }))} className={inputClass} placeholder="Mensagem que acompanhará a escala..." />
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setEnviarOpen(false)} disabled={enviarMutation.isPending} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={enviarMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
                {enviarMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {enviarMutation.isPending ? 'Enviando...' : 'Enviar agora'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
