import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { exportToPDF, exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { abrirVisualizacaoRelatorio, type RelatorioFiltroAplicado, type RelatorioPrintCab } from "@/lib/printRelatorio";
import { fetchStampData, fetchRTForUnidade, fetchGestorMasterForUnidade, type StampData } from "@/lib/pdfStampUtils";
import { Download, Loader2, Eye, Printer, FileText, FileSpreadsheet, Mail, Filter, X, TrendingUp, TrendingDown, Users, Clock, Activity, AlertTriangle, CheckCircle2, RefreshCw, Building2, Calendar as CalendarIcon, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area } from "recharts";
import { isPlantaoContabilizavel } from "@/lib/horas";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { MoreActionsMenu } from "@/components/MoreActionsMenu";
import SignActionButton from "@/components/SignActionButton";

const PROFISSAO_LABELS: Record<string, string> = { medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta', tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)', terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista', fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro' };

const CORES = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))'];

const STATUS_PLANTAO = ['agendado', 'confirmado', 'pendente', 'em_aberto', 'trocando', 'interrompido', 'concluido', 'cancelado'];
const STATUS_TROCA = ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita', 'aprovada', 'concluida', 'rejeitada', 'recusada', 'cancelada'];

type FormatoExport = 'pdf' | 'excel' | 'csv';

const reports = [
  { id: 'profissionais', nome: 'Relatório de Profissionais', descricao: 'Lista completa de profissionais cadastrados', icon: '👥', kind: 'professionals' as const, categoria: 'Cadastros' },
  { id: 'plantoes', nome: 'Relatório de Plantões', descricao: 'Todos os plantões organizados por período', icon: '📋', kind: 'shifts' as const, categoria: 'Operacional' },
  { id: 'horas_profissional', nome: 'Horas por Profissional', descricao: 'Total de horas trabalhadas por profissional', icon: '⏱️', hasChart: true, kind: 'shifts' as const, categoria: 'Operacional' },
  { id: 'trocas', nome: 'Relatório de Trocas', descricao: 'Histórico completo de trocas de plantão', icon: '🔄', hasChart: true, kind: 'swaps' as const, categoria: 'Trocas' },
  { id: 'setores', nome: 'Relatório por Setor', descricao: 'Plantões agrupados por setor', icon: '🏥', hasChart: true, kind: 'shifts' as const, categoria: 'Operacional' },
  { id: 'cancelados', nome: 'Relatório de Plantões Cancelados', descricao: 'Plantões que foram cancelados', icon: '❌', kind: 'shifts' as const, categoria: 'Qualidade' },
  { id: 'escala_mensal', nome: 'Escala Mensal Consolidada', descricao: 'Grid profissional × dia do mês', icon: '📆', kind: 'shifts' as const, categoria: 'Operacional' },
  { id: 'analise_trocas', nome: 'Análise de Trocas', descricao: 'Estatísticas e taxa de aprovação', icon: '📊', hasChart: true, kind: 'swaps' as const, categoria: 'Trocas' },
  { id: 'cobertura_setor', nome: 'Cobertura por Setor', descricao: 'Plantões por setor com visualização', icon: '📈', hasChart: true, kind: 'shifts' as const, categoria: 'Operacional' },
  // ===== Novos relatórios analíticos =====
  { id: 'absenteismo', nome: 'Absenteísmo (Faltas)', descricao: 'Faltas por profissional, taxa e ranking', icon: '🚫', hasChart: true, kind: 'shifts' as const, categoria: 'Qualidade' },
  { id: 'atrasos', nome: 'Pontualidade & Atrasos', descricao: 'Atrasos registrados no check-in por profissional', icon: '⏰', hasChart: true, kind: 'shifts' as const, categoria: 'Qualidade' },
  { id: 'checkin_compliance', nome: 'Compliance de Check-in', descricao: '% de plantões com check-in/check-out registrado', icon: '✅', hasChart: true, kind: 'shifts' as const, categoria: 'Qualidade' },
  { id: 'ranking_horas', nome: 'Ranking de Produtividade', descricao: 'Top profissionais por horas realizadas', icon: '🏆', hasChart: true, kind: 'shifts' as const, categoria: 'Analítico' },
  { id: 'plantoes_por_tipo', nome: 'Distribuição por Tipo de Plantão', descricao: 'Diurno, noturno, sobreaviso, 12h, 24h', icon: '🌓', hasChart: true, kind: 'shifts' as const, categoria: 'Analítico' },
  { id: 'trocas_por_profissional', nome: 'Trocas por Profissional', descricao: 'Solicitadas vs recebidas por profissional', icon: '👥', hasChart: true, kind: 'swaps' as const, categoria: 'Trocas' },
  { id: 'carga_semanal', nome: 'Carga Horária Semanal Média', descricao: 'Horas/semana por profissional (alerta >60h)', icon: '📅', kind: 'shifts' as const, categoria: 'Analítico' },
  { id: 'evolucao_mensal', nome: 'Evolução Mensal de Plantões', descricao: 'Série temporal de plantões e horas por mês', icon: '📉', hasChart: true, kind: 'shifts' as const, categoria: 'Analítico' },
];

type ReportDef = (typeof reports)[number];

interface Filtros {
  dataIni: string;
  dataFim: string;
  unidadeId: string;
  setorId: string;
  profissionalId: string;
  profissao: string;
  status: string;
  tipoPlantao: string;
  formato: FormatoExport;
  incluirAssinatura: boolean;
}

const filtrosVazios: Filtros = {
  dataIni: '', dataFim: '', unidadeId: '', setorId: '',
  profissionalId: '', profissao: '', status: '', tipoPlantao: '',
  formato: 'pdf', incluirAssinatura: false,
};

export default function RelatoriosPage() {
  const { profileName, isMaster, isCoordinator, professionalId: currentProfId } = useAuth();
  const canRead = isMaster || isCoordinator;

  const { data: currentStamp } = useQuery({
    queryKey: ['my-stamp', currentProfId],
    queryFn: async () => {
      if (!currentProfId) return null;
      const { data } = await supabase.from('professional_stamps').select('*').eq('profissional_id', currentProfId).eq('bloqueado', false).maybeSingle();
      return data;
    },
    enabled: !!currentProfId
  });

  const [exporting, setExporting] = useState('');
  const [chartReport, setChartReport] = useState<string | null>(null);
  const [modalReport, setModalReport] = useState<ReportDef | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(filtrosVazios);

  useRealtimeInvalidation({
    tables: ["shifts", "shift_swaps", "professionals", "sectors", "units"],
    invalidate: [["professionals-rep"], ["shifts-report"], ["swaps-report"], ["units-rep"], ["sectors-rep"]],
    channelId: "relatorios-realtime",
  });

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals-rep'],
    queryFn: async () => { const { data } = await supabase.from('professionals_safe').select('id, nome, profissao, especialidade, telefone, email, status, setor_principal_id, unidade_principal_id, conselho, registro, documento_numero, documento_conselho').order('nome'); return data || []; }
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts-report'],
    queryFn: async () => { const { data } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao, conselho, registro, documento_conselho, documento_numero), sectors:setor_id(nome), units:unidade_id(nome)').order('data', { ascending: false }); return data || []; }
  });
  const { data: swaps = [] } = useQuery({
    queryKey: ['swaps-report'],
    queryFn: async () => {
      const { data } = await supabase
        .from('shift_swaps')
        .select(`*,
          solicitante:solicitante_id(nome, profissao),
          destinatario:destinatario_id(nome, profissao),
          shift:shift_id(data, hora_inicio, hora_fim, carga_horaria, tipo_plantao, sectors:setor_id(nome), units:unidade_id(nome)),
          shift_destino:shift_id_destino(data, hora_inicio, hora_fim, carga_horaria, tipo_plantao, sectors:setor_id(nome))
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });
  const { data: units = [] } = useQuery({ queryKey: ['units-rep'], queryFn: async () => { const { data } = await supabase.from('units').select('id, nome').order('nome'); return data || []; } });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors-rep'], queryFn: async () => { const { data } = await supabase.from('sectors').select('id, nome, unidade_id').order('nome'); return data || []; } });
  const { data: shiftTypes = [] } = useQuery({ queryKey: ['shift-types-rep'], queryFn: async () => { const { data } = await supabase.from('shift_types').select('sigla, nome').eq('ativo', true).order('ordem'); return data || []; } });
  const { data: settings = {} } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('*');
      return Object.fromEntries((data || []).map(s => [s.key, s.value]));
    },
  });
  const instituicao = settings.institucional as any || null;
  const { data: gmailSetting } = useQuery({
    queryKey: ['gmail-smtp'],
    queryFn: async () => { const { data } = await supabase.from('system_settings').select('value').eq('key', 'gmail_smtp').maybeSingle(); return (data?.value as any) || null; }
  });
  const emailHabilitado = gmailSetting?.status === 'ativo' && !!gmailSetting?.email_remetente;

  // ===== Helpers =====
  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  const setoresFiltrados = useMemo(() => {
    if (!filtros.unidadeId) return sectors as any[];
    return (sectors as any[]).filter(s => s.unidade_id === filtros.unidadeId);
  }, [sectors, filtros.unidadeId]);

  const inRange = (iso?: string | null) => {
    if (!iso) return false;
    if (filtros.dataIni && iso < filtros.dataIni) return false;
    if (filtros.dataFim && iso > filtros.dataFim) return false;
    return true;
  };

  // Dataset filtrado por relatório (espelho do que será impresso/exportado)
  const filteredShifts = useMemo(() => {
    return (shifts as any[]).filter(s => {
      if (!inRange(s.data) && (filtros.dataIni || filtros.dataFim)) return false;
      if (filtros.unidadeId && s.unidade_id !== filtros.unidadeId) return false;
      if (filtros.setorId && s.setor_id !== filtros.setorId) return false;
      if (filtros.profissionalId && s.profissional_id !== filtros.profissionalId) return false;
      if (filtros.profissao && (s.professionals as any)?.profissao !== filtros.profissao) return false;
      if (filtros.status && s.status !== filtros.status) return false;
      if (filtros.tipoPlantao && s.tipo_plantao !== filtros.tipoPlantao) return false;
      return true;
    });
  }, [shifts, filtros]);

  const filteredSwaps = useMemo(() => {
    return (swaps as any[]).filter(s => {
      const iso = (s.created_at || '').slice(0, 10);
      if ((filtros.dataIni || filtros.dataFim) && !inRange(iso)) return false;
      if (filtros.status && s.status !== filtros.status) return false;
      // Profissional: solicitante OU destinatário
      if (filtros.profissionalId && s.solicitante_id !== filtros.profissionalId && s.destinatario_id !== filtros.profissionalId) return false;
      return true;
    });
  }, [swaps, filtros]);

  const filteredProfessionals = useMemo(() => {
    return (professionals as any[]).filter(p => {
      if (filtros.unidadeId && p.unidade_principal_id !== filtros.unidadeId) return false;
      if (filtros.setorId && p.setor_principal_id !== filtros.setorId) return false;
      if (filtros.profissao && p.profissao !== filtros.profissao) return false;
      if (filtros.status && p.status !== filtros.status) return false;
      if (filtros.profissionalId && p.id !== filtros.profissionalId) return false;
      return true;
    });
  }, [professionals, filtros]);

  // Chart data (preview)
  const horasChartData = useMemo(() => {
    const byProf: Record<string, { nome: string; horas: number }> = {};
    filteredShifts.forEach((s: any) => {
      if (!isPlantaoContabilizavel(s)) return;
      const nome = (s.professionals as any)?.nome || 'Desc.';
      if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, horas: 0 };
      byProf[s.profissional_id].horas += Number(s.carga_horaria || 0);
    });
    return Object.values(byProf).sort((a, b) => b.horas - a.horas).slice(0, 10);
  }, [filteredShifts]);

  const setorChartData = useMemo(() => {
    const bySetor: Record<string, { nome: string; count: number }> = {};
    filteredShifts.forEach((s: any) => {
      const nome = (s.sectors as any)?.nome || 'Desc.';
      if (!bySetor[s.setor_id]) bySetor[s.setor_id] = { nome, count: 0 };
      bySetor[s.setor_id].count++;
    });
    return Object.values(bySetor);
  }, [filteredShifts]);

  const trocasChartData = useMemo(() => {
    const total = filteredSwaps.length;
    const aprovadas = filteredSwaps.filter((s: any) => s.status === 'aprovada' || s.status === 'concluida').length;
    const rejeitadas = filteredSwaps.filter((s: any) => s.status === 'rejeitada' || s.status === 'recusada').length;
    const pendentes = filteredSwaps.filter((s: any) => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'].includes(s.status)).length;
    return [
      { name: 'Aprovadas', value: aprovadas },
      { name: 'Rejeitadas', value: rejeitadas },
      { name: 'Pendentes', value: pendentes },
      { name: 'Canceladas', value: total - aprovadas - rejeitadas - pendentes },
    ].filter(d => d.value > 0);
  }, [filteredSwaps]);

  // Build rows by report (usa datasets filtrados)
  const getReportData = (id: string): { columns: string[]; rows: string[][]; totalHoras?: number | null } => {
    switch (id) {
      case 'profissionais':
        return {
          columns: ['Nome', 'Profissão', 'Conselho', 'Especialidade', 'E-mail', 'Telefone', 'Status'],
          rows: filteredProfessionals.map((p: any) => {
            const conselho = (p.conselho || p.registro || p.documento_conselho || p.documento_numero)
              ? `${p.conselho || p.documento_conselho || ''} ${p.registro || p.documento_numero || ''}`.trim()
              : 'Não informado';
            return [
              p.nome, 
              PROFISSAO_LABELS[p.profissao] || p.profissao, 
              conselho,
              p.especialidade || '', 
              p.email, 
              p.telefone || '', 
              p.status
            ];
          }),
        };
      case 'plantoes':
        return {
          columns: ['Profissional', 'Conselho', 'Setor', 'Unidade', 'Data', 'Horário', 'Carga', 'Status'],
          rows: filteredShifts.map((s: any) => {
            const prof = s.professionals || {};
            const conselho = (prof.conselho || prof.registro || prof.documento_conselho || prof.documento_numero)
              ? `${prof.conselho || prof.documento_conselho || ''} ${prof.registro || prof.documento_numero || ''}`.trim()
              : 'Não informado';
            return [
              prof.nome || '', 
              conselho,
              (s.sectors as any)?.nome || '', 
              (s.units as any)?.nome || '', 
              new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), 
              `${s.hora_inicio}-${s.hora_fim}`, 
              `${s.carga_horaria}h`, 
              s.status
            ];
          }),
          totalHoras: filteredShifts.reduce((a, s: any) => a + (isPlantaoContabilizavel(s) ? Number(s.carga_horaria || 0) : 0), 0),
        };
      case 'horas_profissional': {
        const byProf: Record<string, { nome: string; hours: number; count: number }> = {};
        filteredShifts.forEach((s: any) => {
          if (!isPlantaoContabilizavel(s)) return;
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, hours: 0, count: 0 };
          byProf[s.profissional_id].hours += Number(s.carga_horaria || 0);
          byProf[s.profissional_id].count++;
        });
        const totalHoras = Object.values(byProf).reduce((a, p) => a + p.hours, 0);
        return { columns: ['Profissional', 'Plantões', 'Horas Totais'], rows: Object.values(byProf).map(p => [p.nome, String(p.count), `${p.hours.toFixed(1)}h`]), totalHoras };
      }
      case 'trocas': {
        const fmtData = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
        const fmtDT = (d?: string) => d ? new Date(d).toLocaleString('pt-BR') : '—';
        const tempoResolucao = (s: any) => {
          const fim = s.aprovado_em || s.rejeitado_em || (['concluida','cancelada'].includes(s.status) ? s.updated_at : null);
          if (!fim) return '—';
          const ms = new Date(fim).getTime() - new Date(s.created_at).getTime();
          const h = Math.floor(ms / 3600000);
          if (h < 24) return `${h}h`;
          const d = Math.floor(h / 24);
          return `${d}d ${h % 24}h`;
        };
        return {
          columns: ['Protocolo', 'Tipo', 'Solicitante', 'Destinatário', 'Unidade', 'Setor', 'Plantão (data)', 'Horário', 'Carga', 'Tipo Plantão', 'Motivo', 'Status', 'Criada em', 'Resolvida em', 'Tempo até resolução', 'Aprovador/Obs.'],
          rows: filteredSwaps.map((s: any) => [
            `TRO-${String(s.id).slice(0, 6).toUpperCase()}`,
            s.tipo === 'administrativa' ? 'Administrativa' : (s.tipo === 'grupo' ? 'Grupo' : 'Direta'),
            (s.solicitante as any)?.nome || '—',
            (s.destinatario as any)?.nome || (s.tipo === 'grupo' ? 'Grupo aberto' : '—'),
            (s.shift as any)?.units?.nome || '—',
            (s.shift as any)?.sectors?.nome || '—',
            fmtData((s.shift as any)?.data),
            (s.shift as any)?.hora_inicio ? `${(s.shift as any).hora_inicio}-${(s.shift as any).hora_fim}` : '—',
            (s.shift as any)?.carga_horaria ? `${(s.shift as any).carga_horaria}h` : '—',
            (s.shift as any)?.tipo_plantao || '—',
            s.motivo || '—',
            s.status,
            fmtDT(s.created_at),
            fmtDT(s.aprovado_em || s.rejeitado_em),
            tempoResolucao(s),
            s.observacao_gestor || s.observacao_rejeicao || s.motivo_administrativo || '—',
          ]),
        };
      }
      case 'cancelados':
        return {
          columns: ['Profissional', 'Setor', 'Data', 'Horário', 'Carga'],
          rows: filteredShifts.filter((s: any) => s.status === 'cancelado').map((s: any) => [(s.professionals as any)?.nome || '', (s.sectors as any)?.nome || '', new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), `${s.hora_inicio}-${s.hora_fim}`, `${s.carga_horaria}h`]),
        };
      case 'setores':
      case 'cobertura_setor': {
        const bySetor: Record<string, { nome: string; count: number; horas: number }> = {};
        filteredShifts.forEach((s: any) => {
          const nome = (s.sectors as any)?.nome || 'Desconhecido';
          if (!bySetor[s.setor_id]) bySetor[s.setor_id] = { nome, count: 0, horas: 0 };
          bySetor[s.setor_id].count++;
          if (isPlantaoContabilizavel(s)) bySetor[s.setor_id].horas += Number(s.carga_horaria || 0);
        });
        const totalHoras = Object.values(bySetor).reduce((a, s) => a + s.horas, 0);
        return { columns: ['Setor', 'Qtd. Plantões', 'Horas Totais'], rows: Object.values(bySetor).map(s => [s.nome, String(s.count), `${s.horas.toFixed(1)}h`]), totalHoras };
      }
      case 'escala_mensal': {
        const ref = filtros.dataIni ? new Date(filtros.dataIni + 'T12:00:00') : new Date();
        const year = ref.getFullYear();
        const month = ref.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const showTotal = settings.exibir_total_escala_consolidada !== false;
        
        const cols = ['Profissional', 'Setor', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))];
        if (showTotal) cols.push('Total');
        
        // Agrupa por profissional + setor para evitar duplicidade e manter organização
        const profSetorMap: Record<string, { nome: string; setor: string; days: Record<number, string>; totalHoras: number }> = {};
        
        filteredShifts.forEach((s: any) => {
          const d = new Date(s.data + 'T12:00:00');
          if (d.getMonth() === month && d.getFullYear() === year) {
            const nome = (s.professionals as any)?.nome || '?';
            const setor = (s.sectors as any)?.nome || 'Sem Setor';
            const key = `${s.profissional_id}_${s.setor_id}`;
            
            if (!profSetorMap[key]) {
              profSetorMap[key] = { nome, setor, days: {}, totalHoras: 0 };
            }
            profSetorMap[key].days[d.getDate()] = s.tipo_plantao?.substring(0, 3) || '✓';
            
            if (isPlantaoContabilizavel(s)) {
              profSetorMap[key].totalHoras += Number(s.carga_horaria || 0);
            }
          }
        });
        
        const rows = Object.values(profSetorMap)
          .sort((a, b) => a.setor.localeCompare(b.setor) || a.nome.localeCompare(b.nome))
          .map(p => {
            const row = [
              p.nome, 
              p.setor, 
              ...Array.from({ length: daysInMonth }, (_, i) => p.days[i + 1] || '')
            ];
            if (showTotal) row.push(`${p.totalHoras}h`);
            return row;
          });
        const totalGeral = Object.values(profSetorMap).reduce((a, b) => a + b.totalHoras, 0);
        return { columns: cols, rows, totalHoras: showTotal ? totalGeral : null };
      }
      case 'analise_trocas': {
        const total = filteredSwaps.length;
        const aprovadas = filteredSwaps.filter((s: any) => ['aprovada', 'concluida'].includes(s.status)).length;
        const taxa = total > 0 ? ((aprovadas / total) * 100).toFixed(1) : '0';
        return { columns: ['Métrica', 'Valor'], rows: [['Total de Trocas', String(total)], ['Aprovadas/Concluídas', String(aprovadas)], ['Taxa de Aprovação', `${taxa}%`], ['Rejeitadas', String(filteredSwaps.filter((s: any) => ['rejeitada', 'recusada'].includes(s.status)).length)], ['Pendentes', String(filteredSwaps.filter((s: any) => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao'].includes(s.status)).length)]] };
      }
      case 'absenteismo': {
        const byProf: Record<string, { nome: string; total: number; faltas: number }> = {};
        filteredShifts.forEach((s: any) => {
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, total: 0, faltas: 0 };
          byProf[s.profissional_id].total++;
          if (s.faltou) byProf[s.profissional_id].faltas++;
        });
        const rows = Object.values(byProf)
          .filter(p => p.total > 0)
          .sort((a, b) => (b.faltas / b.total) - (a.faltas / a.total))
          .map(p => [p.nome, String(p.total), String(p.faltas), `${((p.faltas / p.total) * 100).toFixed(1)}%`]);
        return { columns: ['Profissional', 'Plantões', 'Faltas', 'Taxa de Absenteísmo'], rows };
      }
      case 'atrasos': {
        const byProf: Record<string, { nome: string; qtd: number; minutos: number }> = {};
        filteredShifts.forEach((s: any) => {
          if (!s.atraso_minutos || Number(s.atraso_minutos) <= 0) return;
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, qtd: 0, minutos: 0 };
          byProf[s.profissional_id].qtd++;
          byProf[s.profissional_id].minutos += Number(s.atraso_minutos);
        });
        const rows = Object.values(byProf)
          .sort((a, b) => b.minutos - a.minutos)
          .map(p => [p.nome, String(p.qtd), `${p.minutos} min`, `${(p.minutos / p.qtd).toFixed(1)} min`]);
        return { columns: ['Profissional', 'Ocorrências', 'Total Atraso', 'Média por ocorrência'], rows };
      }
      case 'checkin_compliance': {
        const byProf: Record<string, { nome: string; total: number; comCheckin: number; comCheckout: number }> = {};
        filteredShifts.forEach((s: any) => {
          if (!isPlantaoContabilizavel(s)) return;
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, total: 0, comCheckin: 0, comCheckout: 0 };
          byProf[s.profissional_id].total++;
          if (s.checkin_em) byProf[s.profissional_id].comCheckin++;
          if (s.checkout_em) byProf[s.profissional_id].comCheckout++;
        });
        const rows = Object.values(byProf)
          .filter(p => p.total > 0)
          .sort((a, b) => (a.comCheckin / a.total) - (b.comCheckin / b.total))
          .map(p => [p.nome, String(p.total), `${((p.comCheckin / p.total) * 100).toFixed(0)}%`, `${((p.comCheckout / p.total) * 100).toFixed(0)}%`]);
        return { columns: ['Profissional', 'Plantões', '% Check-in', '% Check-out'], rows };
      }
      case 'ranking_horas': {
        const byProf: Record<string, { nome: string; hours: number; count: number }> = {};
        filteredShifts.forEach((s: any) => {
          if (!isPlantaoContabilizavel(s)) return;
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, hours: 0, count: 0 };
          byProf[s.profissional_id].hours += Number(s.carga_horaria || 0);
          byProf[s.profissional_id].count++;
        });
        const ordered = Object.values(byProf).sort((a, b) => b.hours - a.hours);
        const totalHoras = ordered.reduce((a, p) => a + p.hours, 0);
        const rows = ordered.map((p, i) => [`${i + 1}º`, p.nome, String(p.count), `${p.hours.toFixed(1)}h`, `${totalHoras ? ((p.hours / totalHoras) * 100).toFixed(1) : '0'}%`]);
        return { columns: ['#', 'Profissional', 'Plantões', 'Horas', '% do Total'], rows, totalHoras };
      }
      case 'plantoes_por_tipo': {
        const byTipo: Record<string, { count: number; horas: number }> = {};
        filteredShifts.forEach((s: any) => {
          const t = s.tipo_plantao || 'não definido';
          if (!byTipo[t]) byTipo[t] = { count: 0, horas: 0 };
          byTipo[t].count++;
          if (isPlantaoContabilizavel(s)) byTipo[t].horas += Number(s.carga_horaria || 0);
        });
        const totalHoras = Object.values(byTipo).reduce((a, b) => a + b.horas, 0);
        const rows = Object.entries(byTipo)
          .sort((a, b) => b[1].count - a[1].count)
          .map(([t, v]) => [t, String(v.count), `${v.horas.toFixed(1)}h`]);
        return { columns: ['Tipo de Plantão', 'Quantidade', 'Horas'], rows, totalHoras };
      }
      case 'trocas_por_profissional': {
        const byProf: Record<string, { nome: string; solicitadas: number; recebidas: number; aprovadas: number }> = {};
        const nomeById: Record<string, string> = {};
        (professionals as any[]).forEach(p => { nomeById[p.id] = p.nome; });
        filteredSwaps.forEach((s: any) => {
          if (s.solicitante_id) {
            const n = (s.solicitante as any)?.nome || nomeById[s.solicitante_id] || '—';
            if (!byProf[s.solicitante_id]) byProf[s.solicitante_id] = { nome: n, solicitadas: 0, recebidas: 0, aprovadas: 0 };
            byProf[s.solicitante_id].solicitadas++;
            if (['aprovada', 'concluida'].includes(s.status)) byProf[s.solicitante_id].aprovadas++;
          }
          if (s.destinatario_id) {
            const n = (s.destinatario as any)?.nome || nomeById[s.destinatario_id] || '—';
            if (!byProf[s.destinatario_id]) byProf[s.destinatario_id] = { nome: n, solicitadas: 0, recebidas: 0, aprovadas: 0 };
            byProf[s.destinatario_id].recebidas++;
          }
        });
        const rows = Object.values(byProf)
          .sort((a, b) => (b.solicitadas + b.recebidas) - (a.solicitadas + a.recebidas))
          .map(p => [p.nome, String(p.solicitadas), String(p.recebidas), String(p.aprovadas), `${p.solicitadas ? ((p.aprovadas / p.solicitadas) * 100).toFixed(0) : '0'}%`]);
        return { columns: ['Profissional', 'Solicitadas', 'Recebidas', 'Aprovadas', 'Taxa aprov.'], rows };
      }
      case 'carga_semanal': {
        const byProf: Record<string, { nome: string; semanas: Record<string, number> }> = {};
        filteredShifts.forEach((s: any) => {
          if (!isPlantaoContabilizavel(s)) return;
          const d = new Date(s.data + 'T12:00:00');
          const dow = d.getDay();
          const mon = new Date(d); mon.setDate(d.getDate() - ((dow + 6) % 7));
          const wKey = mon.toISOString().slice(0, 10);
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, semanas: {} };
          byProf[s.profissional_id].semanas[wKey] = (byProf[s.profissional_id].semanas[wKey] || 0) + Number(s.carga_horaria || 0);
        });
        const rows = Object.values(byProf).map(p => {
          const vals = Object.values(p.semanas);
          const media = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          const max = vals.length ? Math.max(...vals) : 0;
          const alerta = max > 60 ? '⚠️ Excedeu 60h' : (media > 44 ? '⚠️ Acima CLT' : 'OK');
          return [p.nome, String(vals.length), `${media.toFixed(1)}h`, `${max.toFixed(1)}h`, alerta];
        }).sort((a, b) => parseFloat(b[3]) - parseFloat(a[3]));
        return { columns: ['Profissional', 'Semanas', 'Média/sem', 'Pico', 'Status'], rows };
      }
      case 'evolucao_mensal': {
        const byMonth: Record<string, { count: number; horas: number; faltas: number }> = {};
        filteredShifts.forEach((s: any) => {
          const m = (s.data || '').slice(0, 7);
          if (!m) return;
          if (!byMonth[m]) byMonth[m] = { count: 0, horas: 0, faltas: 0 };
          byMonth[m].count++;
          if (isPlantaoContabilizavel(s)) byMonth[m].horas += Number(s.carga_horaria || 0);
          if (s.faltou) byMonth[m].faltas++;
        });
        const totalHoras = Object.values(byMonth).reduce((a, b) => a + b.horas, 0);
        const rows = Object.entries(byMonth)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([m, v]) => [m, String(v.count), `${v.horas.toFixed(1)}h`, String(v.faltas)]);
        return { columns: ['Mês', 'Plantões', 'Horas', 'Faltas'], rows, totalHoras };
      }
      default: return { columns: [], rows: [] };
    }
  };

  // ===== Modal Open / Close =====
  const openReportModal = (r: ReportDef) => {
    if (!canRead) { toast.error('Sem permissão para acessar relatórios.'); return; }
    setFiltros(filtrosVazios);
    setModalReport(r);
  };
  const closeModal = () => { setModalReport(null); };

  // Recompute preview
  const preview = useMemo(() => {
    if (!modalReport) return null;
    const { columns, rows, totalHoras } = getReportData(modalReport.id);
    return { columns, rows, totalHoras };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalReport, filteredShifts, filteredSwaps, filteredProfessionals, filtros.dataIni]);

  const filtrosAplicados = useMemo<RelatorioFiltroAplicado[]>(() => {
    const u = (units as any[]).find(x => x.id === filtros.unidadeId);
    const s = (sectors as any[]).find(x => x.id === filtros.setorId);
    const p = (professionals as any[]).find(x => x.id === filtros.profissionalId);
    const tp = (shiftTypes as any[]).find(x => x.sigla === filtros.tipoPlantao);
    return [
      { label: 'Unidade', value: u?.nome || '—' },
      { label: 'Setor', value: s?.nome || '—' },
      { label: 'Profissional', value: p?.nome || '—' },
      { label: 'Profissão', value: filtros.profissao ? (PROFISSAO_LABELS[filtros.profissao] || filtros.profissao) : '—' },
      { label: 'Status', value: filtros.status || '—' },
      { label: 'Tipo de Plantão', value: tp ? `${tp.sigla} — ${tp.nome}` : (filtros.tipoPlantao || '—') },
    ];
  }, [filtros, units, sectors, professionals, shiftTypes]);

  const periodoLabel = useMemo(() => {
    if (!filtros.dataIni && !filtros.dataFim) return 'Todos os períodos';
    const fmt = (v: string) => v ? new Date(v + 'T12:00:00').toLocaleDateString('pt-BR') : '…';
    return `${fmt(filtros.dataIni)} a ${fmt(filtros.dataFim)}`;
  }, [filtros]);

  const buildCab = async (): Promise<RelatorioPrintCab> => {
    // 1. Identifica o perfil do usuário logado que está gerando o relatório
    const gestorStamp = currentProfId ? await fetchStampData(currentProfId) : null;
    
    // 2. Determina os blocos esquerdo e direito conforme a regra de negócio
    let responsavel: StampData | null = gestorStamp;
    let responsavelSecundario: StampData | null = null;

    if (isMaster) {
      // SE quem gera é GESTOR MASTER:
      // BLOCO ESQUERDO: Gestor Master (ele mesmo)
      // BLOCO DIREITO: Responsável Técnico da Unidade
      responsavelSecundario = await fetchRTForUnidade(filtros.unidadeId);
    } else if (isCoordinator) {
      // SE quem gera é COORDENADOR:
      // BLOCO ESQUERDO: Coordenador (ele mesmo)
      // BLOCO DIREITO: Gestor Master da Unidade
      responsavelSecundario = await fetchGestorMasterForUnidade(filtros.unidadeId);
    } else {
      responsavelSecundario = await fetchRTForUnidade(filtros.unidadeId);
    }

    if (filtros.incluirAssinatura && !gestorStamp) {
      toast.warning(
        "Atenção: você não possui assinatura cadastrada. O documento será gerado com campo em branco para assinatura manual.", 
        { duration: 8000 }
      );
    }

    return {
      instituicao: {
        nome: instituicao?.nome || 'Secretaria Municipal de Saúde de Oriximiná',
        cnpj: instituicao?.cnpj || '05.131.081/0001-82',
        endereco: instituicao?.endereco || undefined,
      },
      nomeRelatorio: modalReport?.nome || 'Relatório',
      periodoLabel,
      filtros: filtrosAplicados,
      emitidoPor: profileName || 'Gestor',
      totalRegistros: preview?.rows.length || 0,
      totalHoras: preview?.totalHoras ?? null,
      incluirAssinatura: filtros.incluirAssinatura,
      responsavel: responsavel || {
        nome: profileName || 'Gestor',
        cargo: isMaster ? 'Gestor Master' : (isCoordinator ? 'Coordenador' : 'Gestor'),
        conselho: "",
        unidade: ""
      },
      responsavelTecnico: responsavelSecundario || {
        nome: "",
        cargo: "",
        conselho: "",
        unidade: ""
      },
      sistema: 'GestorPlantão SMS Oriximiná',
    };
  };

  // ===== Ações =====
  const acaoVisualizar = async () => {
    if (!modalReport || !preview) return;
    const cab = await buildCab();
    const ok = abrirVisualizacaoRelatorio(cab, preview.columns, preview.rows, false);
    if (!ok) toast.error('Bloqueio de pop-up. Permita janelas para visualizar.');
    else logAudit(`Relatório visualizado: ${modalReport.nome}`, 'relatorios', { reportId: modalReport.id });
  };

  const acaoImprimir = async () => {
    if (!modalReport || !preview) return;
    const cab = await buildCab();
    const ok = abrirVisualizacaoRelatorio(cab, preview.columns, preview.rows, true);
    if (!ok) toast.error('Bloqueio de pop-up. Permita janelas para imprimir.');
    else logAudit(`Relatório impresso: ${modalReport.nome}`, 'relatorios', { reportId: modalReport.id });
  };

  const acaoBaixar = async (formato: FormatoExport) => {
    if (!modalReport || !preview) return;
    if (filtros.incluirAssinatura && !currentStamp) {
      toast.error("Cadastre seu carimbo e assinatura antes de gerar documentos com assinatura.");
      return;
    }
    setExporting(`${modalReport.id}-${formato}`);
    try {
      if (preview.rows.length === 0) { toast.warning('Nenhum dado para exportar com os filtros aplicados.'); return; }
      const filename = `${modalReport.id}_${new Date().toISOString().slice(0, 10)}`;
      if (formato === 'pdf') exportToPDF(modalReport.nome, preview.columns, preview.rows, filename);
      else if (formato === 'excel') exportToExcel(modalReport.nome, preview.columns, preview.rows, filename);
      else exportToCSV(preview.columns, preview.rows, filename);
      toast.success(`${modalReport.nome} exportado em ${formato.toUpperCase()}`);
      await logAudit(`Relatório exportado: ${modalReport.nome} (${formato.toUpperCase()})`, 'relatorios', { reportId: modalReport.id, formato, total: preview.rows.length });
    } catch (e: any) {
      toast.error('Erro na exportação: ' + e.message);
    } finally {
      setExporting('');
    }
  };

  const acaoEnviarEmail = async () => {
    if (!modalReport || !preview) return;
    if (!emailHabilitado) { toast.error('Envio por e-mail não configurado. Configure SMTP em Configurações.'); return; }
    if (preview.rows.length === 0) { toast.warning('Nenhum dado para enviar.'); return; }
    // Comportamento sem servidor de envio próprio: gera CSV anexável e abre composição via mailto.
    try {
      const filename = `${modalReport.id}_${new Date().toISOString().slice(0, 10)}`;
      exportToCSV(preview.columns, preview.rows, filename);
      const subject = encodeURIComponent(`${modalReport.nome} — ${periodoLabel}`);
      const body = encodeURIComponent(
        `Olá,\n\nSegue em anexo o relatório "${modalReport.nome}".\n` +
        `Período: ${periodoLabel}\n` +
        `Total de registros: ${preview.rows.length}\n` +
        `Emitido por: ${profileName || 'Gestor'}\n\n` +
        `O arquivo CSV foi baixado neste dispositivo. Anexe-o ao e-mail antes de enviar.\n\n` +
        `Documento emitido pelo GestorPlantão SMS Oriximiná.`
      );
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      await logAudit(`Relatório preparado para envio por e-mail: ${modalReport.nome}`, 'relatorios', { reportId: modalReport.id });
      toast.success('Arquivo gerado. Anexe-o ao e-mail aberto.');
    } catch (e: any) {
      toast.error('Falha ao preparar envio: ' + e.message);
    }
  };

  // Reseta setor quando muda unidade
  useEffect(() => { setFiltros(f => ({ ...f, setorId: '' })); }, [filtros.unidadeId]);

  // ===== Charts (cards) — agora usam dataset não filtrado para preview rápido =====
  const horasChartCard = useMemo(() => {
    const byProf: Record<string, { nome: string; horas: number }> = {};
    (shifts as any[]).forEach((s: any) => {
      if (!isPlantaoContabilizavel(s)) return;
      const nome = (s.professionals as any)?.nome || 'Desc.';
      if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, horas: 0 };
      byProf[s.profissional_id].horas += Number(s.carga_horaria || 0);
    });
    return Object.values(byProf).sort((a, b) => b.horas - a.horas).slice(0, 10);
  }, [shifts]);

  const setorChartCard = useMemo(() => {
    const bySetor: Record<string, { nome: string; count: number }> = {};
    (shifts as any[]).forEach((s: any) => {
      const nome = (s.sectors as any)?.nome || 'Desc.';
      if (!bySetor[s.setor_id]) bySetor[s.setor_id] = { nome, count: 0 };
      bySetor[s.setor_id].count++;
    });
    return Object.values(bySetor);
  }, [shifts]);

  // ===== Analytics ricos para relatórios de Trocas =====
  const trocasAnalytics = useMemo(() => {
    const src = filteredSwaps as any[];
    const total = src.length;
    const aprovadas = src.filter(s => ['aprovada', 'concluida'].includes(s.status)).length;
    const rejeitadas = src.filter(s => ['rejeitada', 'recusada'].includes(s.status)).length;
    const canceladas = src.filter(s => s.status === 'cancelada').length;
    const pendentes = src.filter(s => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'].includes(s.status)).length;
    const administrativas = src.filter(s => s.tipo === 'administrativa').length;
    const grupo = src.filter(s => s.tipo === 'grupo').length;
    const diretas = src.filter(s => !s.tipo || s.tipo === 'direto' || s.tipo === 'direta').length;

    const status = [
      { name: 'Aprovadas', value: aprovadas },
      { name: 'Pendentes', value: pendentes },
      { name: 'Rejeitadas', value: rejeitadas },
      { name: 'Canceladas', value: canceladas },
    ].filter(d => d.value > 0);

    const tipos = [
      { name: 'Direta', value: diretas },
      { name: 'Grupo', value: grupo },
      { name: 'Administrativa', value: administrativas },
    ].filter(d => d.value > 0);

    // Evolução mensal
    const byMonth: Record<string, { mes: string; solicitadas: number; aprovadas: number; rejeitadas: number }> = {};
    src.forEach(s => {
      const m = (s.created_at || '').slice(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { mes: m, solicitadas: 0, aprovadas: 0, rejeitadas: 0 };
      byMonth[m].solicitadas++;
      if (['aprovada', 'concluida'].includes(s.status)) byMonth[m].aprovadas++;
      if (['rejeitada', 'recusada'].includes(s.status)) byMonth[m].rejeitadas++;
    });
    const evolucao = Object.values(byMonth).sort((a, b) => a.mes.localeCompare(b.mes));

    // Top solicitantes
    const bySol: Record<string, { nome: string; count: number }> = {};
    src.forEach(s => {
      const id = s.solicitante_id;
      const nome = (s.solicitante as any)?.nome || '—';
      if (!id) return;
      if (!bySol[id]) bySol[id] = { nome, count: 0 };
      bySol[id].count++;
    });
    const topSolicitantes = Object.values(bySol).sort((a, b) => b.count - a.count).slice(0, 8);

    // Top motivos (agrupa por primeiras palavras)
    const byMotivo: Record<string, number> = {};
    src.forEach(s => {
      const raw = (s.motivo || 'Não informado').trim().slice(0, 40);
      byMotivo[raw] = (byMotivo[raw] || 0) + 1;
    });
    const topMotivos = Object.entries(byMotivo)
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count).slice(0, 6);

    // Tempo médio de resolução (em horas), considerando só as resolvidas
    const resolvidas = src.filter(s => s.aprovado_em || s.rejeitado_em);
    const somaH = resolvidas.reduce((acc, s) => {
      const fim = new Date(s.aprovado_em || s.rejeitado_em).getTime();
      const ini = new Date(s.created_at).getTime();
      return acc + Math.max(0, (fim - ini) / 3600000);
    }, 0);
    const tempoMedioH = resolvidas.length ? somaH / resolvidas.length : 0;

    const taxaAprov = total ? (aprovadas / total) * 100 : 0;

    return { total, aprovadas, rejeitadas, canceladas, pendentes, administrativas, grupo, diretas, status, tipos, evolucao, topSolicitantes, topMotivos, tempoMedioH, taxaAprov };
  }, [filteredSwaps]);

  const trocasChartCard = trocasAnalytics.status;

  const renderChart = (reportId: string) => {
    if (reportId === 'horas_profissional' && horasChartCard.length > 0) {
      return (
        <div className="h-64 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Top 10 — Horas por Profissional</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={horasChartCard} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={75} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if ((reportId === 'setores' || reportId === 'cobertura_setor') && setorChartCard.length > 0) {
      return (
        <div className="h-64 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Plantões por Setor</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={setorChartCard}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="Plantões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (reportId === 'analise_trocas' && trocasChartCard.length > 0) {
      return (
        <div className="h-64 mt-4 flex justify-center">
          <ResponsiveContainer width={300} height="100%">
            <PieChart>
              <Pie data={trocasChartCard} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {trocasChartCard.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return null;
  };

  // Status options dependentes do tipo de relatório
  const statusOptions = useMemo(() => {
    if (!modalReport) return [] as string[];
    if (modalReport.kind === 'swaps') return STATUS_TROCA;
    if (modalReport.kind === 'professionals') return ['ativo', 'inativo', 'suspenso'];
    return STATUS_PLANTAO;
  }, [modalReport]);

  // ===== Presets de período =====
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const applyPreset = (preset: string) => {
    const hoje = new Date();
    let ini = new Date(hoje), fim = new Date(hoje);
    if (preset === 'hoje') { /* mesmo dia */ }
    else if (preset === 'ontem') { ini.setDate(hoje.getDate() - 1); fim = new Date(ini); }
    else if (preset === 'semana') { ini.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7)); fim = new Date(ini); fim.setDate(ini.getDate() + 6); }
    else if (preset === 'mes') { ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1); fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); }
    else if (preset === 'mes_anterior') { ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); }
    else if (preset === '30d') { ini.setDate(hoje.getDate() - 30); }
    else if (preset === '90d') { ini.setDate(hoje.getDate() - 90); }
    else if (preset === 'ytd') { ini = new Date(hoje.getFullYear(), 0, 1); }
    else if (preset === 'ano') { ini = new Date(hoje.getFullYear(), 0, 1); fim = new Date(hoje.getFullYear(), 11, 31); }
    setFiltros(f => ({ ...f, dataIni: iso(ini), dataFim: iso(fim) }));
  };

  const PRESETS = [
    { id: 'hoje', label: 'Hoje' },
    { id: 'ontem', label: 'Ontem' },
    { id: 'semana', label: 'Esta semana' },
    { id: 'mes', label: 'Este mês' },
    { id: 'mes_anterior', label: 'Mês anterior' },
    { id: '30d', label: 'Últimos 30 dias' },
    { id: '90d', label: 'Últimos 90 dias' },
    { id: 'ytd', label: 'Ano até hoje' },
    { id: 'ano', label: 'Este ano' },
  ];

  // ===== KPI dashboard (visão geral) =====
  const [dashPeriodo, setDashPeriodo] = useState<'mes' | 'mes_anterior' | '30d' | 'ano'>('mes');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('Todas');

  const kpiData = useMemo(() => {
    const hoje = new Date();
    let ini: Date, fim: Date;
    if (dashPeriodo === 'mes') { ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1); fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); }
    else if (dashPeriodo === 'mes_anterior') { ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); }
    else if (dashPeriodo === '30d') { ini = new Date(hoje); ini.setDate(hoje.getDate() - 30); fim = hoje; }
    else { ini = new Date(hoje.getFullYear(), 0, 1); fim = new Date(hoje.getFullYear(), 11, 31); }
    const iniS = iso(ini), fimS = iso(fim);
    // período anterior de mesma duração (para variação)
    const diffMs = fim.getTime() - ini.getTime();
    const prevFim = new Date(ini.getTime() - 86400000);
    const prevIni = new Date(prevFim.getTime() - diffMs);
    const prevIniS = iso(prevIni), prevFimS = iso(prevFim);

    const inRng = (d: string, a: string, b: string) => d >= a && d <= b;
    const cur = (shifts as any[]).filter(s => inRng(s.data, iniS, fimS));
    const prev = (shifts as any[]).filter(s => inRng(s.data, prevIniS, prevFimS));

    const horasCur = cur.filter(isPlantaoContabilizavel).reduce((a, s) => a + Number(s.carga_horaria || 0), 0);
    const horasPrev = prev.filter(isPlantaoContabilizavel).reduce((a, s) => a + Number(s.carga_horaria || 0), 0);
    const faltasCur = cur.filter(s => s.faltou).length;
    const faltasPrev = prev.filter(s => s.faltou).length;
    const totalCur = cur.length || 1;
    const totalPrev = prev.length || 1;
    const canceladosCur = cur.filter(s => s.status === 'cancelado').length;

    const swapsCur = (swaps as any[]).filter(s => inRng((s.created_at || '').slice(0, 10), iniS, fimS));
    const swapsPrev = (swaps as any[]).filter(s => inRng((s.created_at || '').slice(0, 10), prevIniS, prevFimS));
    const aprovCur = swapsCur.filter(s => ['aprovada', 'concluida'].includes(s.status)).length;
    const pendCur = swapsCur.filter(s => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'].includes(s.status)).length;

    const profAtivos = (professionals as any[]).filter(p => p.status === 'ativo').length;

    // evolução por mês (últimos 6)
    const evol: { mes: string; horas: number; plantoes: number; faltas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const list = (shifts as any[]).filter(s => (s.data || '').startsWith(key));
      evol.push({
        mes: label,
        horas: list.filter(isPlantaoContabilizavel).reduce((a, s) => a + Number(s.carga_horaria || 0), 0),
        plantoes: list.length,
        faltas: list.filter(s => s.faltou).length,
      });
    }

    // top setores no período
    const bySetor: Record<string, { nome: string; horas: number; plantoes: number }> = {};
    cur.forEach(s => {
      const nome = (s.sectors as any)?.nome || 'Sem setor';
      const k = s.setor_id || 'x';
      if (!bySetor[k]) bySetor[k] = { nome, horas: 0, plantoes: 0 };
      bySetor[k].plantoes++;
      if (isPlantaoContabilizavel(s)) bySetor[k].horas += Number(s.carga_horaria || 0);
    });
    const topSetores = Object.values(bySetor).sort((a, b) => b.horas - a.horas).slice(0, 6);

    const varPct = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100;

    return {
      horasCur, horasPrev, varHoras: varPct(horasCur, horasPrev),
      plantoes: cur.length, plantoesPrev: prev.length, varPlantoes: varPct(cur.length, prev.length),
      faltasCur, faltasPrev, taxaAbs: (faltasCur / totalCur) * 100, taxaAbsPrev: (faltasPrev / totalPrev) * 100,
      canceladosCur, taxaCanc: (canceladosCur / totalCur) * 100,
      swapsCur: swapsCur.length, swapsPrev: swapsPrev.length, varSwaps: varPct(swapsCur.length, swapsPrev.length),
      aprovCur, taxaAprov: swapsCur.length ? (aprovCur / swapsCur.length) * 100 : 0,
      pendCur,
      profAtivos,
      evol,
      topSetores,
      periodoLabel: `${iso(ini).split('-').reverse().join('/')} — ${iso(fim).split('-').reverse().join('/')}`,
    };
  }, [shifts, swaps, professionals, dashPeriodo]);

  const categorias = useMemo(() => ['Todas', ...Array.from(new Set(reports.map(r => (r as any).categoria || 'Geral')))], []);
  const reportsFiltrados = useMemo(
    () => categoriaFilter === 'Todas' ? reports : reports.filter(r => (r as any).categoria === categoriaFilter),
    [categoriaFilter]
  );

  const KPI = ({ label, value, sub, delta, icon: Icon, tone = 'primary', alert }: { label: string; value: React.ReactNode; sub?: string; delta?: number; icon: any; tone?: 'primary' | 'success' | 'warning' | 'danger'; alert?: boolean }) => {
    const toneBg = tone === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : tone === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : tone === 'danger' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
      : 'bg-primary/10 text-primary';
    const up = (delta ?? 0) >= 0;
    return (
      <div className={`bg-card border ${alert ? 'border-amber-400/60' : 'border-border'} rounded-xl p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
            <div className="font-display font-bold text-2xl text-foreground mt-1">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
          </div>
          <div className={`p-2 rounded-lg ${toneBg}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {typeof delta === 'number' && isFinite(delta) && (
          <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}{delta.toFixed(1)}% vs período anterior
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="module-title">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Painel analítico, indicadores e exportação institucional · <span className="text-foreground/70">{kpiData.periodoLabel}</span></p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-xs">
          {(['mes', 'mes_anterior', '30d', 'ano'] as const).map(p => (
            <button key={p} onClick={() => setDashPeriodo(p)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${dashPeriodo === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {p === 'mes' ? 'Este mês' : p === 'mes_anterior' ? 'Mês anterior' : p === '30d' ? '30 dias' : 'Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* ===== KPI Grid ===== */}
      {canRead && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Horas realizadas" value={`${kpiData.horasCur.toFixed(0)}h`} sub={`vs ${kpiData.horasPrev.toFixed(0)}h antes`} delta={kpiData.varHoras} icon={Clock} tone="primary" />
          <KPI label="Plantões no período" value={kpiData.plantoes} sub={`${kpiData.profAtivos} profissionais ativos`} delta={kpiData.varPlantoes} icon={Activity} tone="primary" />
          <KPI label="Taxa de absenteísmo" value={`${kpiData.taxaAbs.toFixed(1)}%`} sub={`${kpiData.faltasCur} faltas registradas`} delta={kpiData.taxaAbs - kpiData.taxaAbsPrev} icon={AlertTriangle} tone={kpiData.taxaAbs > 5 ? 'danger' : 'success'} alert={kpiData.taxaAbs > 5} />
          <KPI label="Cancelamentos" value={`${kpiData.taxaCanc.toFixed(1)}%`} sub={`${kpiData.canceladosCur} plantões cancelados`} icon={X} tone={kpiData.taxaCanc > 5 ? 'warning' : 'success'} />
          <KPI label="Trocas solicitadas" value={kpiData.swapsCur} sub={`${kpiData.pendCur} aguardando ação`} delta={kpiData.varSwaps} icon={RefreshCw} tone="primary" />
          <KPI label="Taxa de aprovação de trocas" value={`${kpiData.taxaAprov.toFixed(0)}%`} sub={`${kpiData.aprovCur} aprovadas`} icon={CheckCircle2} tone="success" />
          <KPI label="Profissionais ativos" value={kpiData.profAtivos} sub="cadastro atual" icon={Users} tone="primary" />
          <KPI label="Trocas pendentes" value={kpiData.pendCur} sub="requerem análise" icon={AlertTriangle} tone={kpiData.pendCur > 0 ? 'warning' : 'success'} alert={kpiData.pendCur > 0} />
        </div>
      )}

      {/* ===== Charts row ===== */}
      {canRead && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm">Evolução (últimos 6 meses)</h3>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Horas · Plantões · Faltas</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={kpiData.evol}>
                  <defs>
                    <linearGradient id="gradHoras" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="horas" name="Horas" stroke="hsl(var(--primary))" fill="url(#gradHoras)" strokeWidth={2} />
                  <Line type="monotone" dataKey="plantoes" name="Plantões" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="faltas" name="Faltas" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm">Top setores</h3>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiData.topSetores} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} width={90} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ===== Catálogo de relatórios ===== */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <h2 className="font-display font-semibold text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Catálogo de relatórios</h2>
        <div className="flex flex-wrap gap-1.5">
          {categorias.map(c => (
            <button key={c} onClick={() => setCategoriaFilter(c)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${categoriaFilter === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reportsFiltrados.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-xl border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 transition-all">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-semibold text-foreground text-sm">{r.nome}</h3>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{(r as any).categoria}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.descricao}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => openReportModal(r)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.98] transition">
                    <Filter className="h-3 w-3" /> Gerar
                  </button>
                  {r.hasChart && (
                    <button onClick={() => setChartReport(chartReport === r.id ? null : r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${chartReport === r.id ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-muted'}`}>
                      📊 Gráfico
                    </button>
                  )}
                </div>
                {chartReport === r.id && renderChart(r.id)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>


      {/* Modal: Filtros + Preview + Ações */}
      <Dialog open={!!modalReport} onOpenChange={o => !o && closeModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{modalReport?.icon}</span> {modalReport?.nome}
            </DialogTitle>
            <DialogDescription>Aplique filtros, visualize um resumo e escolha como gerar.</DialogDescription>
          </DialogHeader>

          {modalReport && (
            <div className="space-y-5">
              {/* Presets de período */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Período rápido:</span>
                {PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p.id)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                    {p.label}
                  </button>
                ))}
                {(filtros.dataIni || filtros.dataFim) && (
                  <button type="button" onClick={() => setFiltros(f => ({ ...f, dataIni: '', dataFim: '' }))}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-foreground hover:bg-muted/80">
                    <X className="h-3 w-3 inline mr-1" />Limpar período
                  </button>
                )}
              </div>
              {/* Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Período — Início</label>
                  <input type="date" value={filtros.dataIni} onChange={e => setFiltros(f => ({ ...f, dataIni: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Período — Fim</label>
                  <input type="date" value={filtros.dataFim} onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Unidade</label>
                  <select value={filtros.unidadeId} onChange={e => setFiltros(f => ({ ...f, unidadeId: e.target.value }))} className={inputClass}>
                    <option value="">Todas</option>
                    {(units as any[]).map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Setor</label>
                  <select value={filtros.setorId} onChange={e => setFiltros(f => ({ ...f, setorId: e.target.value }))} className={inputClass} disabled={!filtros.unidadeId && setoresFiltrados.length > 30}>
                    <option value="">Todos</option>
                    {setoresFiltrados.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Profissional</label>
                  <select value={filtros.profissionalId} onChange={e => setFiltros(f => ({ ...f, profissionalId: e.target.value }))} className={inputClass}>
                    <option value="">Todos</option>
                    {(professionals as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Profissão</label>
                  <select value={filtros.profissao} onChange={e => setFiltros(f => ({ ...f, profissao: e.target.value }))} className={inputClass}>
                    <option value="">Todas</option>
                    {Object.entries(PROFISSAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                    <option value="">Todos</option>
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {modalReport.kind === 'shifts' && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tipo de Plantão</label>
                    <select value={filtros.tipoPlantao} onChange={e => setFiltros(f => ({ ...f, tipoPlantao: e.target.value }))} className={inputClass}>
                      <option value="">Todos</option>
                      {(shiftTypes as any[]).map(t => <option key={t.sigla} value={t.sigla}>{t.sigla} — {t.nome}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Formato preferido</label>
                  <select value={filtros.formato} onChange={e => setFiltros(f => ({ ...f, formato: e.target.value as FormatoExport }))} className={inputClass}>
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={filtros.incluirAssinatura} onChange={e => setFiltros(f => ({ ...f, incluirAssinatura: e.target.checked }))} />
                    Incluir campo de assinatura na impressão
                  </label>
                </div>
              </div>

              {/* Pré-visualização (resumo) */}
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pré-visualização</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><div className="text-[11px] text-muted-foreground">Registros</div><div className="font-display font-semibold text-foreground">{preview?.rows.length ?? 0}</div></div>
                  <div><div className="text-[11px] text-muted-foreground">Período</div><div className="font-medium text-foreground text-xs">{periodoLabel}</div></div>
                  <div><div className="text-[11px] text-muted-foreground">Unidade/Setor</div><div className="font-medium text-foreground text-xs truncate">{filtrosAplicados.find(f => f.label === 'Unidade')?.value} {filtros.setorId ? `· ${filtrosAplicados.find(f => f.label === 'Setor')?.value}` : ''}</div></div>
                  {preview?.totalHoras != null && (
                    <div><div className="text-[11px] text-muted-foreground">Total de horas</div><div className="font-display font-semibold text-foreground">{preview.totalHoras.toFixed(1)}h</div></div>
                  )}
                  <div className="col-span-2 sm:col-span-4"><div className="text-[11px] text-muted-foreground">Geração</div><div className="text-xs text-foreground">{new Date().toLocaleString('pt-BR')} · {profileName || 'Gestor'}</div></div>
                </div>

                {/* Tabela amostra (até 10 linhas) */}
                {preview && preview.rows.length > 0 && (
                  <div className="mt-4 overflow-x-auto border border-border rounded-xl bg-background shadow-sm">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                          {preview.columns.map((c, i) => {
                            const isDay = !isNaN(Number(c));
                            return (
                              <th key={i} className={`px-2 py-2 text-left font-bold text-slate-700 dark:text-slate-300 border-b border-border ${isDay ? 'text-center min-w-[30px]' : ''}`}>
                                {c}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 10).map((r, idx) => (
                          <tr key={idx} className="border-t border-border hover:bg-muted/30 transition-colors">
                            {r.map((c, j) => {
                              const isDay = !isNaN(Number(preview.columns[j]));
                              return (
                                <td key={j} className={`px-2 py-1.5 text-foreground border-r border-border/40 last:border-r-0 ${isDay ? 'text-center font-bold text-primary' : 'truncate max-w-[150px]'}`}>
                                  {c}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.rows.length > 10 && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-2 text-center text-[10px] text-muted-foreground font-medium italic border-t border-border">
                        Mostrando amostra de 10 de {preview.rows.length} registros totais. Use a visualização completa para ver tudo.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:gap-2">
            <button onClick={closeModal} className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1.5">
              <X className="h-4 w-4" /> Fechar
            </button>
            {modalReport && preview && (isMaster || isCoordinator) && (
              <SignActionButton
                signLabel="Assinar relatório"
                competence={filtros.dataIni ? filtros.dataIni.slice(0, 7) : new Date().toISOString().slice(0, 7)}
                getDocument={() => ({
                  document_type: `relatorio_${modalReport.id}`,
                  document_id: `${modalReport.id}_${(filtros.dataIni || 'all')}_${(filtros.dataFim || 'all')}`,
                  document_title: `${modalReport.nome} — ${periodoLabel}`,
                  content: JSON.stringify({
                    nome: modalReport.nome,
                    periodo: periodoLabel,
                    filtros: filtrosAplicados,
                    columns: preview.columns,
                    rows: preview.rows,
                    totalHoras: preview.totalHoras,
                  }),
                  metadata: { reportId: modalReport.id, totalRegistros: preview.rows.length },
                })}
              />
            )}
            <div className="flex flex-wrap gap-2 ml-auto">
              <button onClick={acaoVisualizar} disabled={!preview} className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-50">
                <Eye className="h-4 w-4" /> Visualizar
              </button>
              <button onClick={acaoImprimir} disabled={!preview} className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-50">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
              <button onClick={() => acaoBaixar('pdf')} disabled={!!exporting || !preview} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-50">
                {exporting.endsWith('-pdf') ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Exportar PDF
              </button>
              <MoreActionsMenu
                triggerClassName="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1.5"
                items={[
                  { id: 'excel', label: exporting.endsWith('-excel') ? 'Exportando...' : 'Exportar Excel', icon: <FileSpreadsheet />, onClick: () => acaoBaixar('excel'), disabled: !preview, loading: exporting.endsWith('-excel'), group: 'Exportar' },
                  { id: 'csv', label: exporting.endsWith('-csv') ? 'Exportando...' : 'Exportar CSV', icon: <Download />, onClick: () => acaoBaixar('csv'), disabled: !preview, loading: exporting.endsWith('-csv'), group: 'Exportar' },
                  { id: 'email', label: 'Enviar por e-mail', icon: <Mail />, onClick: acaoEnviarEmail, disabled: !preview, hidden: !emailHabilitado, group: 'Distribuir' },
                ]}
              />
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
