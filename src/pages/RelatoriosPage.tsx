import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { exportToPDF, exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { abrirVisualizacaoRelatorio, type RelatorioFiltroAplicado, type RelatorioPrintCab } from "@/lib/printRelatorio";
import { fetchStampData, fetchRTForUnidade, fetchGestorMasterForUnidade, type StampData } from "@/lib/pdfStampUtils";
import { Download, Loader2, Eye, Printer, FileText, FileSpreadsheet, Mail, Filter, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
  { id: 'profissionais', nome: 'Relatório de Profissionais', descricao: 'Lista completa de profissionais cadastrados', icon: '👥', kind: 'professionals' as const },
  { id: 'plantoes', nome: 'Relatório de Plantões', descricao: 'Todos os plantões organizados por período', icon: '📋', kind: 'shifts' as const },
  { id: 'horas_profissional', nome: 'Horas por Profissional', descricao: 'Total de horas trabalhadas por profissional', icon: '⏱️', hasChart: true, kind: 'shifts' as const },
  { id: 'trocas', nome: 'Relatório de Trocas', descricao: 'Histórico completo de trocas de plantão', icon: '🔄', kind: 'swaps' as const },
  { id: 'setores', nome: 'Relatório por Setor', descricao: 'Plantões agrupados por setor', icon: '🏥', hasChart: true, kind: 'shifts' as const },
  { id: 'cancelados', nome: 'Relatório de Plantões Cancelados', descricao: 'Plantões que foram cancelados', icon: '❌', kind: 'shifts' as const },
  { id: 'escala_mensal', nome: 'Escala Mensal Consolidada', descricao: 'Grid profissional × dia do mês', icon: '📆', kind: 'shifts' as const },
  { id: 'analise_trocas', nome: 'Análise de Trocas', descricao: 'Estatísticas e taxa de aprovação', icon: '📊', hasChart: true, kind: 'swaps' as const },
  { id: 'cobertura_setor', nome: 'Cobertura por Setor', descricao: 'Plantões por setor com visualização', icon: '📈', hasChart: true, kind: 'shifts' as const },
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
    queryFn: async () => { const { data } = await supabase.from('professionals_safe').select('id, nome, profissao, especialidade, telefone, email, status, setor_principal_id, unidade_principal_id').order('nome'); return data || []; }
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts-report'],
    queryFn: async () => { const { data } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao), sectors:setor_id(nome), units:unidade_id(nome)').order('data', { ascending: false }); return data || []; }
  });
  const { data: swaps = [] } = useQuery({
    queryKey: ['swaps-report'],
    queryFn: async () => { const { data } = await supabase.from('shift_swaps').select('*, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome)').order('created_at', { ascending: false }); return data || []; }
  });
  const { data: units = [] } = useQuery({ queryKey: ['units-rep'], queryFn: async () => { const { data } = await supabase.from('units').select('id, nome').order('nome'); return data || []; } });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors-rep'], queryFn: async () => { const { data } = await supabase.from('sectors').select('id, nome, unidade_id').order('nome'); return data || []; } });
  const { data: shiftTypes = [] } = useQuery({ queryKey: ['shift-types-rep'], queryFn: async () => { const { data } = await supabase.from('shift_types').select('sigla, nome').eq('ativo', true).order('ordem'); return data || []; } });
  const { data: instituicao } = useQuery({
    queryKey: ['institucional'],
    queryFn: async () => { const { data } = await supabase.from('system_settings').select('value').eq('key', 'institucional').maybeSingle(); return (data?.value as any) || null; }
  });
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
          columns: ['Nome', 'Profissão', 'Especialidade', 'E-mail', 'Telefone', 'Status'],
          rows: filteredProfessionals.map((p: any) => [p.nome, PROFISSAO_LABELS[p.profissao] || p.profissao, p.especialidade || '', p.email, p.telefone || '', p.status]),
        };
      case 'plantoes':
        return {
          columns: ['Profissional', 'Setor', 'Unidade', 'Data', 'Horário', 'Carga', 'Status'],
          rows: filteredShifts.map((s: any) => [(s.professionals as any)?.nome || '', (s.sectors as any)?.nome || '', (s.units as any)?.nome || '', new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), `${s.hora_inicio}-${s.hora_fim}`, `${s.carga_horaria}h`, s.status]),
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
      case 'trocas':
        return {
          columns: ['Solicitante', 'Destinatário', 'Motivo', 'Status', 'Data'],
          rows: filteredSwaps.map((s: any) => [(s.solicitante as any)?.nome || '', (s.destinatario as any)?.nome || 'Grupo', s.motivo, s.status, new Date(s.created_at).toLocaleDateString('pt-BR')]),
        };
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
        // Usa o mês do filtro (dataIni) ou mês corrente
        const ref = filtros.dataIni ? new Date(filtros.dataIni + 'T12:00:00') : new Date();
        const year = ref.getFullYear();
        const month = ref.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cols = ['Profissional', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))];
        const profMap: Record<string, { nome: string; days: Record<number, string> }> = {};
        filteredShifts.forEach((s: any) => {
          const d = new Date(s.data + 'T12:00:00');
          if (d.getMonth() === month && d.getFullYear() === year) {
            const nome = (s.professionals as any)?.nome || '?';
            if (!profMap[s.profissional_id]) profMap[s.profissional_id] = { nome, days: {} };
            profMap[s.profissional_id].days[d.getDate()] = (s.sectors as any)?.nome?.substring(0, 3) || '✓';
          }
        });
        const rows = Object.values(profMap).map(p => [p.nome, ...Array.from({ length: daysInMonth }, (_, i) => p.days[i + 1] || '')]);
        return { columns: cols, rows };
      }
      case 'analise_trocas': {
        const total = filteredSwaps.length;
        const aprovadas = filteredSwaps.filter((s: any) => ['aprovada', 'concluida'].includes(s.status)).length;
        const taxa = total > 0 ? ((aprovadas / total) * 100).toFixed(1) : '0';
        return { columns: ['Métrica', 'Valor'], rows: [['Total de Trocas', String(total)], ['Aprovadas/Concluídas', String(aprovadas)], ['Taxa de Aprovação', `${taxa}%`], ['Rejeitadas', String(filteredSwaps.filter((s: any) => ['rejeitada', 'recusada'].includes(s.status)).length)], ['Pendentes', String(filteredSwaps.filter((s: any) => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao'].includes(s.status)).length)]] };
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
    const gestorStamp = currentProfId ? await fetchStampData(currentProfId) : null;
    const rtStamp = await fetchRTForUnidade(filtros.unidadeId);
    
    if (filtros.incluirAssinatura && !gestorStamp) {
      toast.info("Atenção: seu carimbo não está cadastrado. Cadastre em Configurações > Meu Carimbo.", { duration: 6000 });
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
      responsavel: gestorStamp || undefined,
      responsavelTecnico: rtStamp || undefined,
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

  const trocasChartCard = useMemo(() => {
    const total = (swaps as any[]).length;
    const aprovadas = (swaps as any[]).filter((s: any) => s.status === 'aprovada' || s.status === 'concluida').length;
    const rejeitadas = (swaps as any[]).filter((s: any) => s.status === 'rejeitada' || s.status === 'recusada').length;
    const pendentes = (swaps as any[]).filter((s: any) => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'].includes(s.status)).length;
    return [
      { name: 'Aprovadas', value: aprovadas },
      { name: 'Rejeitadas', value: rejeitadas },
      { name: 'Pendentes', value: pendentes },
      { name: 'Canceladas', value: total - aprovadas - rejeitadas - pendentes },
    ].filter(d => d.value > 0);
  }, [swaps]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">Filtre, visualize e exporte relatórios operacionais com dados reais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
            <div className="flex items-start gap-4">
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-foreground">{r.nome}</h3>
                <p className="text-sm text-muted-foreground mt-1">{r.descricao}</p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <button onClick={() => openReportModal(r)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">
                    <Filter className="h-3 w-3" /> Gerar relatório
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

                {/* Tabela amostra (até 5 linhas) */}
                {preview && preview.rows.length > 0 && (
                  <div className="mt-3 overflow-x-auto border border-border rounded-lg bg-background">
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/60">
                        <tr>{preview.columns.slice(0, 6).map(c => <th key={c} className="px-2 py-1.5 text-left font-semibold text-muted-foreground">{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 5).map((r, idx) => (
                          <tr key={idx} className="border-t border-border">
                            {r.slice(0, 6).map((c, j) => <td key={j} className="px-2 py-1 text-foreground truncate max-w-[160px]">{c}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.rows.length > 5 && <p className="text-[10px] text-muted-foreground p-1.5">Mostrando 5 de {preview.rows.length} registros…</p>}
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
