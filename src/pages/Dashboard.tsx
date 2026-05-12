import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import {
  TrendingUp, TrendingDown, Calendar, CheckCircle2, Clock,
  ArrowLeftRight, AlertTriangle, Users, Activity,
  ShieldAlert, BedDouble, Lightbulb, History, Bell, Zap,
  ChevronRight, Shield, UserX,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMemo, useState, useEffect, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PainelOcupacao } from "@/components/PainelOcupacao";
import { AcionamentosTracker } from "@/components/AcionamentosTracker";
import { PROFISSAO_LABELS } from "@/types/hospital";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

const fadeIn = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };

const RATIO_LIMITS: Record<string, number> = { enfermeiro: 8, tecnico_enfermagem: 10, fisioterapeuta: 10, medico: 12 };

const RealtimeClock = memo(function RealtimeClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);
  return (
    <span className="font-mono text-xs tracking-wider text-muted-foreground tabular-nums">
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
});

const KpiCard = memo(function KpiCard({ label, value, icon: Icon, color, trend, onClick }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; trend?: number; onClick?: () => void;
}) {
  const colorMap: Record<string, { bg: string; text: string; bar: string }> = {
    primary: { bg: "bg-primary/8", text: "text-primary", bar: "bg-primary" },
    success: { bg: "bg-success/8", text: "text-success", bar: "bg-success" },
    warning: { bg: "bg-warning/8", text: "text-warning", bar: "bg-warning" },
    destructive: { bg: "bg-destructive/8", text: "text-destructive", bar: "bg-destructive" },
    accent: { bg: "bg-accent/8", text: "text-accent", bar: "bg-accent" },
    info: { bg: "bg-info/8", text: "text-info", bar: "bg-info" },
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <motion.div
      variants={fadeIn}
      onClick={onClick}
      className={`kpi-card group ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-[11px] font-medium ${trend >= 0 ? "text-success" : "text-destructive"}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${c.bg} shrink-0`}>
          <Icon className={`h-5 w-5 ${c.text}`} strokeWidth={1.8} />
        </div>
      </div>
      <div className={`h-0.5 ${c.bar} rounded-full mt-3 opacity-40`} />
    </motion.div>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];

  // ── Realtime cross-invalidation ──
  useRealtimeInvalidation({
    tables: ["shifts", "shift_swaps", "notifications", "audit_logs", "censo_pacientes", "setor_ocupacao", "professionals"],
    invalidate: ["dashboard-*"],
    channelId: "dashboard-realtime",
  });

  // ── Data Queries ──
  const { data: shifts = [] } = useQuery({
    queryKey: ["dashboard-shifts"],
    queryFn: async () => {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
      const { data } = await supabase.from("shifts").select("id, data, status, hora_inicio, hora_fim, carga_horaria, tipo_plantao, profissional_id, setor_id, professionals:profissional_id(nome, profissao), sectors:setor_id(nome)").gte("data", firstDay).lte("data", lastStr);
      return data || [];
    },
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["dashboard-swaps"],
    queryFn: async () => {
      const { data } = await supabase.from("shift_swaps").select("id, status, tipo, created_at, solicitante_id, destinatario_id, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome)").order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: profCount = 0 } = useQuery({
    queryKey: ["dashboard-prof-count"],
    queryFn: async () => { const { count } = await supabase.from("professionals_safe").select("id", { count: "exact", head: true }).eq("status", "ativo"); return count || 0; },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["dashboard-recent-logs"],
    queryFn: async () => { const { data } = await supabase.from("audit_logs").select("id, modulo, acao, usuario_nome, status, created_at").order("created_at", { ascending: false }).limit(8); return data || []; },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["dashboard-sectors-coverage"],
    queryFn: async () => { const { data } = await supabase.from("sectors").select("id, nome, min_profissionais_diurno, min_profissionais_noturno"); return data || []; },
  });

  const { data: todayShifts = [] } = useQuery({
    queryKey: ["dashboard-today-shifts", todayStr],
    queryFn: async () => { const { data } = await supabase.from("shifts").select("id, data, status, hora_inicio, hora_fim, carga_horaria, tipo_plantao, profissional_id, setor_id, professionals:profissional_id(id, nome, profissao, setor_principal_id), sectors:setor_id(nome)").eq("data", todayStr).neq("status", "cancelado"); return data || []; },
  });

  const { data: allProfessionals = [] } = useQuery({
    queryKey: ["dashboard-all-professionals"],
    queryFn: async () => { const { data } = await supabase.from("professionals_safe").select("id, nome, profissao, setor_principal_id, telefone").eq("status", "ativo").order("nome"); return data || []; },
  });

  const { data: docAlerts = [] } = useQuery({
    queryKey: ["dashboard-doc-alerts"],
    queryFn: async () => { const { data } = await supabase.from("professionals_safe").select("id, nome, documento_conselho, documento_numero, documento_validade").not("documento_validade", "is", null).eq("status", "ativo"); return data || []; },
  });

  const { data: censoHoje = [] } = useQuery({
    queryKey: ["dashboard-censo-hoje", todayStr],
    queryFn: async () => { const { data } = await supabase.from("censo_pacientes").select("setor_id, leitos_ocupados, proporcao_minima").eq("data", todayStr); return data || []; },
  });

  const { data: ocupacoes = [] } = useQuery({
    queryKey: ["dashboard-ocupacoes"],
    queryFn: async () => { const { data } = await supabase.from("setor_ocupacao").select("id, setor_id, pacientes_atual, capacidade_maxima, nivel, updated_at, sectors(nome)"); return data || []; },
  });

  const { data: historicalShifts = [] } = useQuery({
    queryKey: ["dashboard-historical-shifts"],
    queryFn: async () => { const d = new Date(); d.setMonth(d.getMonth() - 3); const { data } = await supabase.from("shifts").select("data, status").gte("data", d.toISOString().split("T")[0]).in("status", ["cancelado"]); return data || []; },
  });

  const { data: historicalSwaps = [] } = useQuery({
    queryKey: ["dashboard-historical-swaps"],
    queryFn: async () => { const d = new Date(); d.setMonth(d.getMonth() - 3); const { data } = await supabase.from("shift_swaps").select("created_at").gte("created_at", d.toISOString()); return data || []; },
  });

  // ── State ──
  const [censoModalOpen, setCensoModalOpen] = useState(false);
  const [censoInputs, setCensoInputs] = useState<Record<string, number>>({});
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestSectorId, setSuggestSectorId] = useState<string | null>(null);

  const salvarCensoMutation = useMutation({
    mutationFn: async () => {
      const setoresAtualizados: { setor_id: string; setor_nome?: string; leitos: number }[] = [];
      for (const [setorId, leitos] of Object.entries(censoInputs)) {
        if (leitos > 0) {
          await supabase.from("censo_pacientes").upsert(
            { setor_id: setorId, data: todayStr, leitos_ocupados: leitos, proporcao_minima: 0.5 } as any,
            { onConflict: "setor_id,data" }
          );
          const setor = (sectors as any[]).find((s: any) => s.id === setorId);
          setoresAtualizados.push({ setor_id: setorId, setor_nome: setor?.nome, leitos });
        }
      }
      await logAudit('Censo de pacientes atualizado', 'dashboard', { data: todayStr, setores: setoresAtualizados });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dashboard-censo-hoje"] }); toast.success("Censo atualizado!"); setCensoModalOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // ── Derived data ──
  const coverageAlerts = useMemo(() => {
    const alerts: { tipo: string; setor: string; mensagem: string }[] = [];
    for (const setor of sectors as any[]) {
      const ss = todayShifts.filter((p: any) => p.setor_id === setor.id);
      const diurnos = ss.filter((p: any) => p.hora_inicio < "19:00").length;
      const noturnos = ss.filter((p: any) => p.hora_inicio >= "19:00").length;
      if (diurnos < (setor.min_profissionais_diurno || 1)) alerts.push({ tipo: "critico", setor: setor.nome, mensagem: `${setor.nome}: ${diurnos}/${setor.min_profissionais_diurno || 1} profissionais no diurno` });
      if (noturnos < (setor.min_profissionais_noturno || 1)) alerts.push({ tipo: "noturno", setor: setor.nome, mensagem: `${setor.nome}: ${noturnos}/${setor.min_profissionais_noturno || 1} profissionais no noturno` });
    }
    return alerts;
  }, [sectors, todayShifts]);

  const capacityAnalysis = useMemo(() => {
    return (sectors as any[]).map(setor => {
      const censo = (censoHoje as any[]).find(c => c.setor_id === setor.id);
      const pacientes = censo?.leitos_ocupados || 0;
      const sectorShifts = todayShifts.filter((p: any) => p.setor_id === setor.id);
      const total = sectorShifts.length;
      const minRequired = (setor.min_profissionais_diurno || 1) + (setor.min_profissionais_noturno || 1);
      const profByType: Record<string, number> = {};
      sectorShifts.forEach((s: any) => { const prof = s.professionals as any; if (prof?.profissao) profByType[prof.profissao] = (profByType[prof.profissao] || 0) + 1; });
      let status: "ok" | "atencao" | "critico" = "ok";
      let criticalReason = "";
      if (pacientes > 0) {
        for (const [profissao, count] of Object.entries(profByType)) {
          const maxRatio = RATIO_LIMITS[profissao] || 12;
          const currentRatio = pacientes / count;
          if (currentRatio > maxRatio) { status = "critico"; criticalReason = `${currentRatio.toFixed(0)} pac/${profissao === "enfermeiro" ? "Enf" : profissao}`; break; }
          else if (currentRatio > maxRatio * 0.75) { status = "atencao"; criticalReason = "Proporção próxima do limite"; }
        }
        if (total === 0 && pacientes > 0) { status = "critico"; criticalReason = "Sem profissionais escalados"; }
      }
      if (total < (setor.min_profissionais_diurno || 1) && status === "ok") { status = "atencao"; criticalReason = "Abaixo do mínimo configurado"; }
      return { id: setor.id, nome: setor.nome, escalados: total, minimo: minRequired, pacientes, status, criticalReason, profByType, coberto: total >= (setor.min_profissionais_diurno || 1) };
    });
  }, [sectors, todayShifts, censoHoje]);

  const coverageSuggestions = useMemo(() => {
    if (!suggestSectorId) return { available: [], remanejamento: [] };
    const escaladosHoje = new Set(todayShifts.map((s: any) => s.profissional_id));
    const available = (allProfessionals as any[]).filter(p => !escaladosHoje.has(p.id)).slice(0, 5);
    const calmSectors = capacityAnalysis.filter(s => s.status === "ok" && s.escalados > 1 && s.id !== suggestSectorId);
    const remanejamento: any[] = [];
    for (const calm of calmSectors) {
      const profsInCalm = todayShifts.filter((s: any) => s.setor_id === calm.id).map((s: any) => ({ ...(s.professionals as any), sectorOrigem: calm.nome }));
      remanejamento.push(...profsInCalm);
    }
    return { available, remanejamento: remanejamento.slice(0, 5) };
  }, [suggestSectorId, todayShifts, allProfessionals, capacityAnalysis]);

  const historicalPrediction = useMemo(() => {
    const dayCount: Record<number, { swaps: number; cancels: number }> = {};
    for (let i = 0; i < 7; i++) dayCount[i] = { swaps: 0, cancels: 0 };
    (historicalShifts as any[]).forEach(s => { const day = new Date(s.data + "T12:00:00").getDay(); dayCount[day].cancels++; });
    (historicalSwaps as any[]).forEach(s => { const day = new Date(s.created_at).getDay(); dayCount[day].swaps++; });
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return Object.entries(dayCount).map(([d, c]) => ({ day: Number(d), name: dayNames[Number(d)], total: c.swaps + c.cancels, ...c })).sort((a, b) => b.total - a.total).filter(d => d.total >= 2).slice(0, 3);
  }, [historicalShifts, historicalSwaps]);

  const docWarnings = useMemo(() => {
    const hoje = new Date(); const em30 = new Date(hoje.getTime() + 30 * 86400000);
    return (docAlerts as any[]).filter(p => p.documento_validade && new Date(p.documento_validade) < em30).map(p => {
      const v = new Date(p.documento_validade); const vencido = v < hoje; const dias = Math.ceil((v.getTime() - hoje.getTime()) / 86400000);
      return { nome: p.nome, conselho: p.documento_conselho || "Registro", vencido, dias, validade: v.toLocaleDateString("pt-BR") };
    });
  }, [docAlerts]);

  const totalShifts = shifts.length;
  const confirmed = shifts.filter((s: any) => s.status === "confirmado").length;
  const pending = shifts.filter((s: any) => s.status === "pendente").length;
  const alertCount = coverageAlerts.length + docWarnings.length;
  const swapsPending = swaps.filter((s: any) => ["solicitada", "aguardando_resposta", "aguardando_aprovacao"].includes(s.status)).length;
  const coveragePct = capacityAnalysis.length > 0 ? Math.round((capacityAnalysis.filter(s => s.coberto).length / capacityAnalysis.length) * 100) : 100;
  const uncoveredSectors = capacityAnalysis.filter(s => !s.coberto).length;
  const faltasHoje = todayShifts.filter((s: any) => s.status === "cancelado" || s.tipo_plantao === "folga").length;

  const escaladosHoje = new Set(todayShifts.map((s: any) => s.profissional_id));
  const availableCount = (allProfessionals as any[]).filter(p => !escaladosHoje.has(p.id)).length;

  const professionData = useMemo(() => {
    const map: Record<string, { count: number }> = {};
    shifts.forEach((s: any) => {
      const prof = (s.professionals as any)?.profissao || "outro";
      if (!map[prof]) map[prof] = { count: 0 }; map[prof].count++;
    });
    return Object.entries(map).map(([k, v]) => ({ name: PROFISSAO_LABELS[k as keyof typeof PROFISSAO_LABELS] || k, ...v, fill: "hsl(var(--primary))" }));
  }, [shifts]);

  const activeToday = useMemo(() => {
    const nowStr = new Date().toTimeString().slice(0, 5);
    return todayShifts.filter((s: any) => s.hora_inicio <= nowStr && s.hora_fim >= nowStr);
  }, [todayShifts]);

  const getInitials = (name: string) => name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  const avatarColors = ["bg-primary", "bg-success", "bg-warning", "bg-accent", "bg-info"];
  const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  const swapStatusStyle = (s: string) => {
    if (["aprovada", "concluida", "aceita"].includes(s)) return "bg-success/8 text-success";
    if (["recusada", "rejeitada", "cancelada"].includes(s)) return "bg-destructive/8 text-destructive";
    return "bg-warning/8 text-warning";
  };
  const swapStatusLabel = (s: string) => {
    const m: Record<string, string> = { solicitada: "Pendente", aguardando_resposta: "Aguardando", aceita: "Aceita", recusada: "Recusada", aguardando_aprovacao: "Aguardando", aprovada: "Aprovada", rejeitada: "Rejeitada", cancelada: "Cancelada", concluida: "Concluída" };
    return m[s] || s;
  };

  const feedIconMap: Record<string, React.ElementType> = { escala: Calendar, trocas: ArrowLeftRight, profissionais: Users, configuracoes: Shield, relatorios: Activity, sistema: ShieldAlert };

  const inputClass = "w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-colors";

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight font-display">Central de Comando</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão executiva das operações · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-success/8 text-success px-3 py-1.5 rounded-lg text-[11px] font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Tempo Real
          </div>
          <RealtimeClock />
          <button
            onClick={() => { const inputs: Record<string, number> = {}; (sectors as any[]).forEach(s => { const existing = (censoHoje as any[]).find(c => c.setor_id === s.id); inputs[s.id] = existing?.leitos_ocupados || 0; }); setCensoInputs(inputs); setCensoModalOpen(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <BedDouble className="h-3.5 w-3.5" /> Censo
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Plantões Hoje" value={todayShifts.length} icon={Calendar} color="primary" onClick={() => navigate("/escala")} />
        <KpiCard label="Trocas Pendentes" value={swapsPending} icon={ArrowLeftRight} color="warning" onClick={() => navigate("/trocas")} />
        <KpiCard label="Faltas / Folgas" value={faltasHoje} icon={UserX} color="destructive" />
        <KpiCard label="Setores Descobertos" value={uncoveredSectors} icon={AlertTriangle} color={uncoveredSectors > 0 ? "destructive" : "success"} />
        <KpiCard label="Profissionais Disponíveis" value={availableCount} icon={Users} color="accent" onClick={() => navigate("/profissionais")} />
        <KpiCard label="Cobertura Geral" value={`${coveragePct}%`} icon={Shield} color={coveragePct >= 80 ? "success" : coveragePct >= 50 ? "warning" : "destructive"} trend={totalShifts > 0 ? Math.round((confirmed / totalShifts) * 100) : 0} />
        <KpiCard label="Plantões do Mês" value={totalShifts} icon={CheckCircle2} color="info" />
        <KpiCard label="Alertas Urgentes" value={alertCount} icon={Bell} color={alertCount > 0 ? "destructive" : "success"} />
      </motion.div>

      {/* ── OCCUPANCY ── */}
      <PainelOcupacao />
      <AcionamentosTracker />

      {/* ── CRITICAL ALERTS ── */}
      {capacityAnalysis.filter(s => s.status === "critico").length > 0 && (
        <motion.div variants={fadeIn} initial="hidden" animate="show" className="rounded-xl border border-destructive/20 bg-destructive/4 p-4">
          <h3 className="font-semibold text-destructive mb-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" /> Risco de Sobrecarga
          </h3>
          <div className="space-y-2">
            {capacityAnalysis.filter(s => s.status === "critico").map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 bg-card rounded-lg border border-destructive/10">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.nome}: {a.escalados} prof. / {a.pacientes} pac.</p>
                  <p className="text-xs text-muted-foreground">{a.criticalReason}</p>
                </div>
                <button onClick={() => { setSuggestSectorId(a.id); setSuggestModalOpen(true); }} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Lightbulb className="h-3 w-3" /> Solução
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── ALERTS ROW ── */}
      {(coverageAlerts.length > 0 || docWarnings.length > 0) && (
        <motion.div variants={fadeIn} initial="hidden" animate="show" className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive" /> Alertas ({coverageAlerts.length + docWarnings.length})
          </h2>
          <div className="space-y-1.5">
            {coverageAlerts.map((a, i) => (
              <div key={`cov-${i}`} className="flex items-center justify-between p-3 bg-destructive/4 border border-destructive/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  <p className="text-sm text-foreground">{a.mensagem}</p>
                </div>
                <button onClick={() => navigate("/escala")} className="shrink-0 text-xs font-semibold text-primary hover:underline flex items-center gap-0.5">Escalar <ChevronRight className="h-3 w-3" /></button>
              </div>
            ))}
            {docWarnings.map((d, i) => (
              <div key={`doc-${i}`} className={`flex items-center justify-between p-3 rounded-lg border ${d.vencido ? "bg-destructive/4 border-destructive/10" : "bg-warning/4 border-warning/10"}`}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`h-3.5 w-3.5 shrink-0 ${d.vencido ? "text-destructive" : "text-warning"}`} />
                  <p className={`text-sm ${d.vencido ? "text-destructive font-medium" : "text-foreground"}`}>
                    {d.nome}: {d.conselho} {d.vencido ? `vencido em ${d.validade}` : `vence em ${d.dias} dias`}
                  </p>
                </div>
                <button onClick={() => navigate("/profissionais")} className="shrink-0 text-xs font-semibold text-primary hover:underline flex items-center gap-0.5">Revisar <ChevronRight className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── PREDICTION ── */}
      {historicalPrediction.length > 0 && (
        <motion.div variants={fadeIn} initial="hidden" animate="show" className="rounded-xl border border-info/15 bg-info/4 p-4">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-info" /> Previsão — Dias de Alta Demanda
          </h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {historicalPrediction.map(d => (
              <div key={d.day} className="px-3 py-2 rounded-lg bg-info/8 border border-info/15">
                <p className="text-sm font-semibold text-info">{d.name}</p>
                <p className="text-[10px] text-muted-foreground">{d.cancels} cancel. · {d.swaps} trocas</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-warning font-medium mt-3 flex items-center gap-1"><Zap className="h-3 w-3" /> Recomendação: Escale +1 reserva nestes dias.</p>
        </motion.div>
      )}

      {/* ── MAIN GRID: Today shifts + Swaps ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's Shifts */}
        <motion.div variants={fadeIn} initial="hidden" animate="show" className="lg:col-span-2 bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Plantões Hoje</h3>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </span>
              {activeToday.length} em atividade
            </div>
          </div>
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {todayShifts.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum plantão agendado para hoje.</p>}
            {todayShifts.map((s: any, i: number) => {
              const prof = s.professionals as any;
              const name = prof?.nome || "—";
              return (
                <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className={`h-8 w-8 rounded-lg ${getAvatarColor(name)} flex items-center justify-center shrink-0`}>
                    <span className="text-[10px] font-bold text-primary-foreground">{getInitials(name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {(s.sectors as any)?.nome} · {PROFISSAO_LABELS[prof?.profissao as keyof typeof PROFISSAO_LABELS] || prof?.profissao}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0 tabular-nums">
                    {s.hora_inicio?.slice(0, 5)}–{s.hora_fim?.slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Swaps */}
        <motion.div variants={fadeIn} initial="hidden" animate="show" className="bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Trocas Recentes</h3>
            <button onClick={() => navigate("/trocas")} className="text-[11px] font-medium text-primary hover:underline flex items-center gap-0.5">
              Ver todas <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {swaps.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhuma troca de plantão registrada.</p>}
            {(swaps as any[]).slice(0, 8).map((sw: any) => {
              const solName = sw.solicitante?.nome || "—";
              const destName = sw.destinatario?.nome || "Grupo";
              return (
                <div key={sw.id} className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center -space-x-1.5">
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(solName)} flex items-center justify-center border-2 border-card z-10`}>
                      <span className="text-[9px] font-bold text-primary-foreground">{getInitials(solName)}</span>
                    </div>
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(destName)} flex items-center justify-center border-2 border-card`}>
                      <span className="text-[9px] font-bold text-primary-foreground">{getInitials(destName)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{solName.split(" ")[0]} ↔ {destName.split(" ")[0]}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(sw.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${swapStatusStyle(sw.status)}`}>
                    {swapStatusLabel(sw.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── CAPACITY TABLE ── */}
      {capacityAnalysis.length > 0 && (
        <motion.div variants={fadeIn} initial="hidden" animate="show" className="bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" /> Capacidade por Setor
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Setor</th>
                  <th className="text-center p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-center p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Escalados</th>
                  <th className="text-center p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Pacientes</th>
                  <th className="text-center p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Cobertura</th>
                  <th className="text-center p-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Ação</th>
                </tr>
              </thead>
              <tbody>
                {capacityAnalysis.map(row => (
                  <tr key={row.nome} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="p-2.5 font-medium text-foreground text-sm">{row.nome}</td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        row.status === "critico" ? "bg-destructive/8 text-destructive" :
                        row.status === "atencao" ? "bg-warning/8 text-warning" :
                        "bg-success/8 text-success"
                      }`}>
                        {row.status === "critico" ? "Crítico" : row.status === "atencao" ? "Atenção" : "OK"}
                      </span>
                    </td>
                    <td className="p-2.5 text-center text-foreground">{row.escalados}</td>
                    <td className="p-2.5 text-center text-foreground">{row.pacientes || "—"}</td>
                    <td className="p-2.5 text-center"><Progress value={Math.min(100, (row.escalados / Math.max(1, row.minimo)) * 100)} className="h-1.5 w-16 mx-auto" /></td>
                    <td className="p-2.5 text-center">
                      {row.status === "critico" && (
                        <button onClick={() => { setSuggestSectorId(row.id); setSuggestModalOpen(true); }} className="text-xs text-primary font-semibold hover:underline">Sugerir</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── CHARTS + ACTIVITY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeIn} initial="hidden" animate="show" className="bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Plantões por Profissão</h3>
          {professionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={professionData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 11 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {professionData.map((_, i) => <Cell key={i} fill={`hsl(var(--primary) / ${0.5 + (i * 0.1)})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-8">Sem dados de profissões para exibir.</p>}
        </motion.div>

        <motion.div variants={fadeIn} initial="hidden" animate="show" className="bg-card rounded-xl border border-border/60 shadow-[var(--shadow-card)] p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Atividades Recentes
          </h3>
          <div className="space-y-1 max-h-[220px] overflow-y-auto">
            {recentLogs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade recente registrada.</p>}
            {recentLogs.map((a: any) => {
              const FeedIcon = feedIconMap[a.modulo] || Activity;
              return (
                <div key={a.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="p-1.5 rounded-md bg-muted shrink-0">
                    <FeedIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">{a.acao}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.usuario_nome || "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── CENSO MODAL ── */}
      <Dialog open={censoModalOpen} onOpenChange={setCensoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-primary" /> Censo de Pacientes
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Informe o número de leitos ocupados por setor.</p>
          <div className="space-y-3 max-h-60 overflow-y-auto mt-3">
            {(sectors as any[]).map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-foreground">{s.nome}</span>
                <input type="number" min={0} value={censoInputs[s.id] || 0}
                  onChange={e => setCensoInputs(prev => ({ ...prev, [s.id]: parseInt(e.target.value) || 0 }))}
                  className={`${inputClass} w-20 text-center`} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setCensoModalOpen(false)} className="px-4 py-2 rounded-lg border border-input text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={() => salvarCensoMutation.mutate()} disabled={salvarCensoMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {salvarCensoMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SUGGEST MODAL ── */}
      <Dialog open={suggestModalOpen} onOpenChange={setSuggestModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" /> Sugestão de Cobertura
            </DialogTitle>
          </DialogHeader>
          {suggestSectorId && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Setor: <strong className="text-foreground">{capacityAnalysis.find(s => s.id === suggestSectorId)?.nome}</strong></p>
              {coverageSuggestions.remanejamento.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Remanejamento de setores calmos</h4>
                  <div className="space-y-2">
                    {coverageSuggestions.remanejamento.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao as keyof typeof PROFISSAO_LABELS] || p.profissao} · de {p.sectorOrigem}</p>
                        </div>
                        <button onClick={() => { navigate("/escala"); setSuggestModalOpen(false); }} className="text-xs text-primary font-semibold hover:underline">Escalar</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {coverageSuggestions.available.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Profissionais disponíveis</h4>
                  <div className="space-y-2">
                    {coverageSuggestions.available.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao as keyof typeof PROFISSAO_LABELS] || p.profissao}</p>
                        </div>
                        <button onClick={() => { navigate("/escala"); setSuggestModalOpen(false); }} className="text-xs text-primary font-semibold hover:underline">Escalar</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {coverageSuggestions.available.length === 0 && coverageSuggestions.remanejamento.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sugestão disponível.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
