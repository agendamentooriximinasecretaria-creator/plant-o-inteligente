import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Calendar, CheckCircle2, Clock, ArrowLeftRight, AlertTriangle, DollarSign, Users, Activity, ShieldAlert, BedDouble, Lightbulb, History } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PainelOcupacao } from "@/components/PainelOcupacao";
import { AcionamentosTracker } from "@/components/AcionamentosTracker";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

// Ratios by profession type
const RATIO_LIMITS: Record<string, number> = {
  enfermeiro: 8,
  tecnico_enfermagem: 10,
  fisioterapeuta: 10,
  medico: 12,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: shifts = [] } = useQuery({
    queryKey: ['dashboard-shifts'],
    queryFn: async () => {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      const { data } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao), sectors:setor_id(nome)').gte('data', firstDay).lte('data', lastStr);
      return data || [];
    },
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ['dashboard-swaps'],
    queryFn: async () => { const { data } = await supabase.from('shift_swaps').select('*'); return data || []; },
  });

  const { data: profCount = 0 } = useQuery({
    queryKey: ['dashboard-prof-count'],
    queryFn: async () => { const { count } = await supabase.from('professionals').select('*', { count: 'exact', head: true }).eq('status', 'ativo'); return count || 0; },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ['dashboard-recent-logs'],
    queryFn: async () => { const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10); return data || []; },
  });

  // Coverage alerts
  const { data: sectors = [] } = useQuery({
    queryKey: ['dashboard-sectors-coverage'],
    queryFn: async () => { const { data } = await supabase.from('sectors').select('id, nome, min_profissionais_diurno, min_profissionais_noturno'); return data || []; },
  });

  const { data: todayShifts = [] } = useQuery({
    queryKey: ['dashboard-today-shifts', todayStr],
    queryFn: async () => { const { data } = await supabase.from('shifts').select('setor_id, hora_inicio, profissional_id, professionals:profissional_id(id, nome, profissao, valor_hora, setor_principal_id)').eq('data', todayStr).neq('status', 'cancelado'); return data || []; },
  });

  // All active professionals for "Sugerir Cobertura"
  const { data: allProfessionals = [] } = useQuery({
    queryKey: ['dashboard-all-professionals'],
    queryFn: async () => { const { data } = await supabase.from('professionals').select('id, nome, profissao, valor_hora, setor_principal_id, telefone').eq('status', 'ativo').order('valor_hora', { ascending: true }); return data || []; },
  });

  // Document alerts
  const { data: docAlerts = [] } = useQuery({
    queryKey: ['dashboard-doc-alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('professionals').select('id, nome, documento_conselho, documento_numero, documento_validade').not('documento_validade', 'is', null).eq('status', 'ativo');
      return data || [];
    },
  });

  // Censo de pacientes (today)
  const { data: censoHoje = [] } = useQuery({
    queryKey: ['dashboard-censo-hoje', todayStr],
    queryFn: async () => {
      const { data } = await supabase.from('censo_pacientes').select('setor_id, leitos_ocupados, proporcao_minima').eq('data', todayStr);
      return data || [];
    },
  });

  // Historical swap/cancel data for prediction
  const { data: historicalShifts = [] } = useQuery({
    queryKey: ['dashboard-historical-shifts'],
    queryFn: async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const { data } = await supabase.from('shifts').select('data, status').gte('data', threeMonthsAgo.toISOString().split('T')[0]).in('status', ['cancelado']);
      return data || [];
    },
  });

  const { data: historicalSwaps = [] } = useQuery({
    queryKey: ['dashboard-historical-swaps'],
    queryFn: async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const { data } = await supabase.from('shift_swaps').select('created_at').gte('created_at', threeMonthsAgo.toISOString());
      return data || [];
    },
  });

  // Censo input state
  const [censoModalOpen, setCensoModalOpen] = useState(false);
  const [censoInputs, setCensoInputs] = useState<Record<string, number>>({});
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestSectorId, setSuggestSectorId] = useState<string | null>(null);

  const salvarCensoMutation = useMutation({
    mutationFn: async () => {
      for (const [setorId, leitos] of Object.entries(censoInputs)) {
        if (leitos > 0) {
          await supabase.from('censo_pacientes').upsert(
            { setor_id: setorId, data: todayStr, leitos_ocupados: leitos, proporcao_minima: 0.5 } as any,
            { onConflict: 'setor_id,data' }
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-censo-hoje'] });
      toast.success('Censo atualizado!');
      setCensoModalOpen(false);
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const coverageAlerts = useMemo(() => {
    const alerts: { tipo: string; setor: string; mensagem: string }[] = [];
    for (const setor of sectors as any[]) {
      const sectorShifts = todayShifts.filter((p: any) => p.setor_id === setor.id);
      const diurnos = sectorShifts.filter((p: any) => p.hora_inicio < '19:00').length;
      const noturnos = sectorShifts.filter((p: any) => p.hora_inicio >= '19:00').length;
      const minD = setor.min_profissionais_diurno || 1;
      const minN = setor.min_profissionais_noturno || 1;
      if (diurnos < minD) alerts.push({ tipo: 'critico', setor: setor.nome, mensagem: `⚠️ ${setor.nome}: ${diurnos}/${minD} profissionais no diurno` });
      if (noturnos < minN) alerts.push({ tipo: 'noturno', setor: setor.nome, mensagem: `🌙 ${setor.nome}: ${noturnos}/${minN} profissionais no noturno` });
    }
    return alerts;
  }, [sectors, todayShifts]);

  // Enhanced capacity analysis per sector
  const capacityAnalysis = useMemo(() => {
    return (sectors as any[]).map(setor => {
      const censo = (censoHoje as any[]).find(c => c.setor_id === setor.id);
      const pacientes = censo?.leitos_ocupados || 0;
      const sectorShifts = todayShifts.filter((p: any) => p.setor_id === setor.id);
      const total = sectorShifts.length;
      const minRequired = (setor.min_profissionais_diurno || 1) + (setor.min_profissionais_noturno || 1);

      // Per-profession breakdown
      const profByType: Record<string, number> = {};
      sectorShifts.forEach((s: any) => {
        const prof = s.professionals as any;
        if (prof?.profissao) {
          profByType[prof.profissao] = (profByType[prof.profissao] || 0) + 1;
        }
      });

      // Determine critical status based on profession-specific ratios
      let status: 'ok' | 'atencao' | 'critico' = 'ok';
      let criticalReason = '';

      if (pacientes > 0) {
        for (const [profissao, count] of Object.entries(profByType)) {
          const maxRatio = RATIO_LIMITS[profissao] || 12;
          const currentRatio = pacientes / count;
          if (currentRatio > maxRatio) {
            status = 'critico';
            const profLabel = profissao === 'enfermeiro' ? 'Enfermeiro' : profissao === 'fisioterapeuta' ? 'Fisioterapeuta' : profissao;
            criticalReason = `${currentRatio.toFixed(0)} pac/${profLabel} (máx: ${maxRatio})`;
            break;
          } else if (currentRatio > maxRatio * 0.75) {
            status = 'atencao';
            criticalReason = `Proporção próxima do limite`;
          }
        }
        // If no professionals at all and there are patients
        if (total === 0 && pacientes > 0) {
          status = 'critico';
          criticalReason = 'Sem profissionais escalados';
        }
      }

      if (total < (setor.min_profissionais_diurno || 1) && status === 'ok') {
        status = 'atencao';
        criticalReason = 'Abaixo do mínimo configurado';
      }

      return {
        id: setor.id,
        nome: setor.nome,
        escalados: total,
        minimo: minRequired,
        pacientes,
        status,
        criticalReason,
        profByType,
        coberto: total >= (setor.min_profissionais_diurno || 1),
      };
    });
  }, [sectors, todayShifts, censoHoje]);

  // "Sugerir Cobertura" logic
  const coverageSuggestions = useMemo(() => {
    if (!suggestSectorId) return [];
    const escaladosHoje = new Set(todayShifts.map((s: any) => s.profissional_id));
    // Find professionals NOT working today, ordered by lowest cost
    const available = (allProfessionals as any[])
      .filter(p => !escaladosHoje.has(p.id))
      .map(p => ({
        ...p,
        isFromCalmSector: false,
      }));

    // Also find professionals in "calm" sectors (low patient load)
    const calmSectors = capacityAnalysis.filter(s => s.status === 'ok' && s.escalados > 1 && s.id !== suggestSectorId);
    const remanejamento: any[] = [];
    for (const calm of calmSectors) {
      const profsInCalm = todayShifts
        .filter((s: any) => s.setor_id === calm.id)
        .map((s: any) => ({ ...(s.professionals as any), isFromCalmSector: true, sectorOrigem: calm.nome }));
      remanejamento.push(...profsInCalm);
    }

    return { available: available.slice(0, 5), remanejamento: remanejamento.slice(0, 5) };
  }, [suggestSectorId, todayShifts, allProfessionals, capacityAnalysis]);

  // Historical prediction: days with most cancellations/swaps
  const historicalPrediction = useMemo(() => {
    const dayCount: Record<number, { swaps: number; cancels: number }> = {};
    for (let i = 0; i < 7; i++) dayCount[i] = { swaps: 0, cancels: 0 };

    (historicalShifts as any[]).forEach(s => {
      const day = new Date(s.data + 'T12:00:00').getDay();
      dayCount[day].cancels++;
    });

    (historicalSwaps as any[]).forEach(s => {
      const day = new Date(s.created_at).getDay();
      dayCount[day].swaps++;
    });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const sorted = Object.entries(dayCount)
      .map(([day, counts]) => ({ day: Number(day), name: dayNames[Number(day)], total: counts.swaps + counts.cancels, ...counts }))
      .sort((a, b) => b.total - a.total);

    // Only show if there's meaningful data
    const topDays = sorted.filter(d => d.total >= 2).slice(0, 3);
    return topDays;
  }, [historicalShifts, historicalSwaps]);

  const docWarnings = useMemo(() => {
    const hoje = new Date();
    const em30 = new Date(hoje.getTime() + 30 * 86400000);
    return (docAlerts as any[]).filter(p => p.documento_validade && new Date(p.documento_validade) < em30).map(p => {
      const v = new Date(p.documento_validade);
      const vencido = v < hoje;
      const dias = Math.ceil((v.getTime() - hoje.getTime()) / 86400000);
      return { nome: p.nome, conselho: p.documento_conselho || 'Registro', vencido, dias, validade: v.toLocaleDateString('pt-BR') };
    });
  }, [docAlerts]);

  const totalShifts = shifts.length;
  const confirmed = shifts.filter((s: any) => s.status === 'confirmado').length;
  const pending = shifts.filter((s: any) => s.status === 'pendente').length;
  const swapsRequested = swaps.length;
  const swapsApproved = swaps.filter((s: any) => s.status === 'aprovada' || s.status === 'concluida').length;
  const swapsRejected = swaps.filter((s: any) => s.status === 'recusada' || s.status === 'rejeitada').length;
  const totalCost = shifts.filter((s: any) => s.status !== 'cancelado').reduce((acc: number, s: any) => acc + Number(s.valor_total), 0);

  const kpis = [
    { label: "Plantões do Mês", value: totalShifts, icon: Calendar, color: "text-primary", bg: "bg-primary/10" },
    { label: "Confirmados", value: confirmed, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Pendentes", value: pending, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Trocas Solicitadas", value: swapsRequested, icon: ArrowLeftRight, color: "text-info", bg: "bg-info/10" },
    { label: "Trocas Aprovadas", value: swapsApproved, icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: "Trocas Recusadas", value: swapsRejected, icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Custo Total", value: `R$ ${totalCost.toLocaleString('pt-BR')}`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10", wide: true },
    { label: "Profissionais Ativos", value: profCount, icon: Users, color: "text-accent", bg: "bg-accent/10" },
  ];

  const sectorMap: Record<string, { name: string; plantoes: number; custo: number }> = {};
  shifts.forEach((s: any) => {
    const nome = (s.sectors as any)?.nome || 'Sem setor';
    if (!sectorMap[s.setor_id]) sectorMap[s.setor_id] = { name: nome, plantoes: 0, custo: 0 };
    sectorMap[s.setor_id].plantoes++;
    if (s.status !== 'cancelado') sectorMap[s.setor_id].custo += Number(s.valor_total);
  });
  const sectorData = Object.values(sectorMap).sort((a, b) => b.custo - a.custo);

  const statusData = [
    { name: 'Confirmado', value: confirmed, color: 'hsl(152, 60%, 40%)' },
    { name: 'Agendado', value: shifts.filter((s: any) => s.status === 'agendado').length, color: 'hsl(199, 89%, 48%)' },
    { name: 'Pendente', value: pending, color: 'hsl(38, 92%, 50%)' },
    { name: 'Concluído', value: shifts.filter((s: any) => s.status === 'concluido').length, color: 'hsl(168, 72%, 36%)' },
    { name: 'Cancelado', value: shifts.filter((s: any) => s.status === 'cancelado').length, color: 'hsl(0, 72%, 51%)' },
  ];

  const feedIconMap: Record<string, string> = { escala: '📋', trocas: '🔄', profissionais: '👥', configuracoes: '⚙️', relatorios: '📊', sistema: '🔐' };
  const PROFISSAO_LABELS: Record<string, string> = { medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta', tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)', terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista', fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro' };

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  const statusColor = (s: string) => s === 'critico' ? 'text-destructive' : s === 'atencao' ? 'text-warning' : 'text-success';
  const statusBg = (s: string) => s === 'critico' ? 'bg-destructive/10' : s === 'atencao' ? 'bg-warning/10' : 'bg-success/10';
  const statusIcon = (s: string) => s === 'critico' ? '🔴' : s === 'atencao' ? '🟡' : '🟢';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="module-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral das operações de plantão</p>
        </div>
        <button onClick={() => {
          const inputs: Record<string, number> = {};
          (sectors as any[]).forEach(s => {
            const existing = (censoHoje as any[]).find(c => c.setor_id === s.id);
            inputs[s.id] = existing?.leitos_ocupados || 0;
          });
          setCensoInputs(inputs);
          setCensoModalOpen(true);
        }} className="flex items-center gap-2 bg-accent text-accent-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <BedDouble className="h-4 w-4" /> Censo de Pacientes
        </button>
      </div>

      {/* Critical capacity alerts with "Achar Solução" */}
      {capacityAnalysis.filter(s => s.status === 'critico').length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card border-l-4 border-l-destructive">
          <h3 className="font-display font-semibold text-destructive mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> 🚨 Risco de Sobrecarga Detectado
          </h3>
          <div className="space-y-3">
            {capacityAnalysis.filter(s => s.status === 'critico').map((a) => (
              <div key={a.id} className="p-3 bg-destructive/5 rounded-lg flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-foreground font-medium">{a.nome}: {a.escalados} profissional(is) para {a.pacientes} paciente(s)</p>
                  <p className="text-xs text-muted-foreground">{a.criticalReason}</p>
                </div>
                <button
                  onClick={() => { setSuggestSectorId(a.id); setSuggestModalOpen(true); }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                >
                  <Lightbulb className="h-3.5 w-3.5" /> Achar Solução
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Historical prediction alert */}
      {historicalPrediction.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card border-l-4 border-l-info">
          <h3 className="font-display font-semibold text-foreground mb-2 flex items-center gap-2">
            <History className="h-4 w-4 text-info" /> 📊 Previsão Histórica — Dias de Alta Demanda
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Baseado em trocas e cancelamentos dos últimos 3 meses:</p>
          <div className="flex flex-wrap gap-3">
            {historicalPrediction.map(d => (
              <div key={d.day} className="px-3 py-2 rounded-lg bg-info/10 border border-info/20">
                <p className="text-sm font-semibold text-info">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.cancels} cancelamento(s), {d.swaps} troca(s)</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-warning font-medium mt-3">⚡ Recomendação: Escale +1 profissional de reserva nestes dias ou bloqueie folgas.</p>
        </motion.div>
      )}

      {/* Coverage + Document Alerts */}
      {(coverageAlerts.length > 0 || docWarnings.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {coverageAlerts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card border-l-4 border-l-destructive">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" /> Alertas de Cobertura — Hoje
              </h3>
              <div className="space-y-2">
                {coverageAlerts.map((a, i) => (
                  <p key={i} className="text-sm text-foreground">{a.mensagem}</p>
                ))}
              </div>
              <button onClick={() => navigate('/escala')} className="mt-3 text-xs text-primary font-medium hover:underline">Escalar agora →</button>
            </motion.div>
          )}
          {docWarnings.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card border-l-4 border-l-warning">
              <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Documentos com Atenção
              </h3>
              <div className="space-y-2">
                {docWarnings.map((d, i) => (
                  <p key={i} className={`text-sm ${d.vencido ? 'text-destructive font-medium' : 'text-foreground'}`}>
                    {d.vencido ? '🔴' : '🟡'} {d.nome}: {d.conselho} {d.vencido ? `VENCIDO em ${d.validade}` : `vence em ${d.dias} dias`}
                  </p>
                ))}
              </div>
              <button onClick={() => navigate('/profissionais')} className="mt-3 text-xs text-primary font-medium hover:underline">Ver profissionais →</button>
            </motion.div>
          )}
        </div>
      )}

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={item} className={`kpi-card ${kpi.wide ? 'col-span-2 md:col-span-1' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="kpi-label">{kpi.label}</p>
                <p className="kpi-value mt-1">{kpi.value}</p>
              </div>
              <div className={`${kpi.bg} ${kpi.color} p-2 rounded-lg`}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Enhanced Coverage table with thermometer */}
      {capacityAnalysis.length > 0 && (
        <motion.div variants={item} initial="hidden" animate="show" className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" /> Gestão de Capacidade por Setor — Hoje
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="text-left p-2">Setor</th>
                <th className="text-center p-2">Status</th>
                <th className="text-center p-2">Escalados</th>
                <th className="text-center p-2">Pacientes</th>
                <th className="text-center p-2">Cobertura</th>
                <th className="text-center p-2">Ação</th>
              </tr></thead>
              <tbody>
                {capacityAnalysis.map((row) => (
                  <tr key={row.nome} className={`border-t border-border ${statusBg(row.status)}`}>
                    <td className="p-2 font-medium text-foreground">{row.nome}</td>
                    <td className="p-2 text-center" title={row.criticalReason || 'Equipe suficiente'}>
                      <span className={`text-lg cursor-help`}>{statusIcon(row.status)}</span>
                    </td>
                    <td className="p-2 text-center text-foreground">{row.escalados}</td>
                    <td className="p-2 text-center text-foreground">{row.pacientes || '—'}</td>
                    <td className="p-2 text-center">
                      <Progress value={Math.min(100, (row.escalados / Math.max(1, row.minimo)) * 100)} className="h-2 w-20 mx-auto" />
                    </td>
                    <td className="p-2 text-center">
                      {row.status === 'critico' && (
                        <button
                          onClick={() => { setSuggestSectorId(row.id); setSuggestModalOpen(true); }}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Sugerir →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} initial="hidden" animate="show" className="lg:col-span-2 kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Plantões por Setor</h3>
          {sectorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sectorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12 }} />
                <Bar dataKey="plantoes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-12">Nenhum plantão registrado neste mês.</p>}
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Status dos Plantões</h3>
          {totalShifts > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusData.filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statusData.filter(d => d.value > 0).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {statusData.filter(s => s.value > 0).map(s => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-muted-foreground">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} initial="hidden" animate="show" className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Atividades Recentes
          </h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {recentLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade registrada.</p>}
            {recentLogs.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-lg shrink-0">{feedIconMap[a.modulo] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.acao}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.usuario_nome || 'Sistema'} • {new Date(a.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Custo por Setor</h3>
          {sectorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sectorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Custo']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12 }} />
                <Bar dataKey="custo" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-12">Sem dados.</p>}
        </motion.div>
      </div>

      {/* Censo Modal */}
      {censoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-md w-full shadow-lg">
            <h3 className="font-display font-semibold text-foreground mb-1 flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-accent" /> Censo de Pacientes — Hoje
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Informe o número de leitos ocupados por setor.</p>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(sectors as any[]).map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{s.nome}</span>
                  <input
                    type="number"
                    min={0}
                    value={censoInputs[s.id] || 0}
                    onChange={e => setCensoInputs(prev => ({ ...prev, [s.id]: parseInt(e.target.value) || 0 }))}
                    className={`${inputClass} w-20 text-center`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setCensoModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => salvarCensoMutation.mutate()} disabled={salvarCensoMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {salvarCensoMutation.isPending ? 'Salvando...' : 'Salvar Censo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Coverage Modal */}
      <Dialog open={suggestModalOpen} onOpenChange={setSuggestModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" /> Sugestão de Cobertura
            </DialogTitle>
          </DialogHeader>
          {suggestSectorId && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Setor: <strong className="text-foreground">{capacityAnalysis.find(s => s.id === suggestSectorId)?.nome}</strong>
              </p>

              {/* Remanejamento suggestions */}
              {(coverageSuggestions as any)?.remanejamento?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    🔄 Remanejamento de setores com carga baixa
                  </h4>
                  <div className="space-y-2">
                    {(coverageSuggestions as any).remanejamento.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao] || p.profissao} • Vindo de: {p.sectorOrigem}</p>
                        </div>
                        <button
                          onClick={() => { navigate('/escala'); setSuggestModalOpen(false); }}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Escalar →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available (not working today) */}
              {(coverageSuggestions as any)?.available?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    ✅ Profissionais de folga hoje (menor custo primeiro)
                  </h4>
                  <div className="space-y-2">
                    {(coverageSuggestions as any).available.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao] || p.profissao} • R$ {Number(p.valor_hora).toLocaleString('pt-BR')}/h</p>
                        </div>
                        <button
                          onClick={() => { navigate('/escala'); setSuggestModalOpen(false); }}
                          className="text-xs text-primary font-medium hover:underline"
                        >
                          Escalar →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(coverageSuggestions as any)?.available?.length === 0 && (coverageSuggestions as any)?.remanejamento?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sugestão disponível no momento.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
