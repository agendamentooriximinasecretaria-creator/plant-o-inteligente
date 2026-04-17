import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp, TrendingDown, Calendar, CheckCircle2, Clock,
  ArrowLeftRight, AlertTriangle, Users, Activity,
  ShieldAlert, BedDouble, Lightbulb, History, Bell, Zap,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PainelOcupacao } from "@/components/PainelOcupacao";
import { AcionamentosTracker } from "@/components/AcionamentosTracker";
import { Badge } from "@/components/ui/badge";
import { PROFISSAO_LABELS } from "@/types/hospital";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const RATIO_LIMITS: Record<string, number> = {
  enfermeiro: 8,
  tecnico_enfermagem: 10,
  fisioterapeuta: 10,
  medico: 12,
};

/* ── Realtime Clock ── */
function RealtimeClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm tracking-wider text-muted-foreground tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

/* ── KPI Card ── */
function KpiCard({ label, value, icon: Icon, barColor, iconBg, iconColor, trend }: {
  label: string; value: string | number; icon: React.ElementType;
  barColor: string; iconBg: string; iconColor: string; trend?: number;
}) {
  return (
    <motion.div variants={item} className="bg-card rounded-lg border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-[3px]" style={{ background: barColor }} />
      <div className="p-4 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-[28px] font-semibold text-foreground mt-1 leading-none" style={{ letterSpacing: "-0.02em", fontFamily: "'DM Sans', sans-serif" }}>
            {value}
          </p>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend >= 0 ? "text-success" : "text-destructive"}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="p-2 rounded-lg shrink-0" style={{ background: iconBg }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
      </div>
    </motion.div>
  );
}

/* ── Occupancy Sector Card ── */
function OccupancySectorCard({ nome, nivel, pacientes, capacidade, status }: {
  nome: string; nivel: string; pacientes: number; capacidade: number; status: string;
}) {
  const pct = capacidade > 0 ? Math.round((pacientes / capacidade) * 100) : 0;
  const cfg: Record<string, { border: string; badge: string; badgeBg: string; barColor: string; pulse?: boolean }> = {
    normal: { border: "border-l-success", badge: "Normal", badgeBg: "bg-success/10 text-success", barColor: "hsl(var(--success))" },
    atencao: { border: "border-l-warning", badge: "Atenção", badgeBg: "bg-warning/10 text-warning", barColor: "hsl(var(--warning))" },
    lotado: { border: "border-l-destructive", badge: "Lotado", badgeBg: "bg-destructive/10 text-destructive", barColor: "hsl(var(--destructive))" },
    superlotado: { border: "border-l-[#7C3AED]", badge: "Superlotado", badgeBg: "bg-[#7C3AED]/10 text-[#7C3AED]", barColor: "#7C3AED", pulse: true },
  };
  const c = cfg[nivel] || cfg.normal;
  return (
    <div className={`bg-card rounded-lg border border-border border-l-[3px] ${c.border} p-4 relative overflow-hidden ${c.pulse ? "animate-pulse-shadow" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-semibold text-foreground truncate">{nome}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badgeBg}`}>{c.badge}</span>
      </div>
      <p className="text-3xl font-bold text-foreground leading-none mb-2" style={{ fontFamily: "'DM Sans', sans-serif" }}>{pacientes}</p>
      <div className="w-full bg-muted rounded-full h-1.5 mb-1">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: c.barColor }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{pacientes}/{capacidade} pacientes · {pct}%</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const todayStr = new Date().toISOString().split("T")[0];

  // ── Data Queries (unchanged logic) ──
  const { data: shifts = [] } = useQuery({
    queryKey: ["dashboard-shifts"],
    queryFn: async () => {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
      const { data } = await supabase.from("shifts").select("*, professionals:profissional_id(nome, profissao), sectors:setor_id(nome)").gte("data", firstDay).lte("data", lastStr);
      return data || [];
    },
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["dashboard-swaps"],
    queryFn: async () => {
      const { data } = await supabase.from("shift_swaps").select("*, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome)").order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: profCount = 0 } = useQuery({
    queryKey: ["dashboard-prof-count"],
    queryFn: async () => { const { count } = await supabase.from("professionals").select("*", { count: "exact", head: true }).eq("status", "ativo"); return count || 0; },
  });

  const { data: recentLogs = [] } = useQuery({
    queryKey: ["dashboard-recent-logs"],
    queryFn: async () => { const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10); return data || []; },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["dashboard-sectors-coverage"],
    queryFn: async () => { const { data } = await supabase.from("sectors").select("id, nome, min_profissionais_diurno, min_profissionais_noturno"); return data || []; },
  });

  const { data: todayShifts = [] } = useQuery({
    queryKey: ["dashboard-today-shifts", todayStr],
    queryFn: async () => { const { data } = await supabase.from("shifts").select("*, professionals:profissional_id(id, nome, profissao, setor_principal_id), sectors:setor_id(nome)").eq("data", todayStr).neq("status", "cancelado"); return data || []; },
  });

  const { data: allProfessionals = [] } = useQuery({
    queryKey: ["dashboard-all-professionals"],
    queryFn: async () => { const { data } = await supabase.from("professionals").select("id, nome, profissao, setor_principal_id, telefone").eq("status", "ativo").order("nome"); return data || []; },
  });

  const { data: docAlerts = [] } = useQuery({
    queryKey: ["dashboard-doc-alerts"],
    queryFn: async () => { const { data } = await supabase.from("professionals").select("id, nome, documento_conselho, documento_numero, documento_validade").not("documento_validade", "is", null).eq("status", "ativo"); return data || []; },
  });

  const { data: censoHoje = [] } = useQuery({
    queryKey: ["dashboard-censo-hoje", todayStr],
    queryFn: async () => { const { data } = await supabase.from("censo_pacientes").select("setor_id, leitos_ocupados, proporcao_minima").eq("data", todayStr); return data || []; },
  });

  const { data: ocupacoes = [] } = useQuery({
    queryKey: ["dashboard-ocupacoes"],
    queryFn: async () => { const { data } = await supabase.from("setor_ocupacao").select("*, sectors(nome)"); return data || []; },
  });

  const { data: historicalShifts = [] } = useQuery({
    queryKey: ["dashboard-historical-shifts"],
    queryFn: async () => {
      const d = new Date(); d.setMonth(d.getMonth() - 3);
      const { data } = await supabase.from("shifts").select("data, status").gte("data", d.toISOString().split("T")[0]).in("status", ["cancelado"]);
      return data || [];
    },
  });

  const { data: historicalSwaps = [] } = useQuery({
    queryKey: ["dashboard-historical-swaps"],
    queryFn: async () => {
      const d = new Date(); d.setMonth(d.getMonth() - 3);
      const { data } = await supabase.from("shift_swaps").select("created_at").gte("created_at", d.toISOString());
      return data || [];
    },
  });

  // ── State ──
  const [censoModalOpen, setCensoModalOpen] = useState(false);
  const [censoInputs, setCensoInputs] = useState<Record<string, number>>({});
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestSectorId, setSuggestSectorId] = useState<string | null>(null);

  const salvarCensoMutation = useMutation({
    mutationFn: async () => {
      for (const [setorId, leitos] of Object.entries(censoInputs)) {
        if (leitos > 0) {
          await supabase.from("censo_pacientes").upsert(
            { setor_id: setorId, data: todayStr, leitos_ocupados: leitos, proporcao_minima: 0.5 } as any,
            { onConflict: "setor_id,data" }
          );
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dashboard-censo-hoje"] }); toast.success("Censo atualizado!"); setCensoModalOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // ── Memos (unchanged logic) ──
  const coverageAlerts = useMemo(() => {
    const alerts: { tipo: string; setor: string; mensagem: string }[] = [];
    for (const setor of sectors as any[]) {
      const ss = todayShifts.filter((p: any) => p.setor_id === setor.id);
      const diurnos = ss.filter((p: any) => p.hora_inicio < "19:00").length;
      const noturnos = ss.filter((p: any) => p.hora_inicio >= "19:00").length;
      if (diurnos < (setor.min_profissionais_diurno || 1)) alerts.push({ tipo: "critico", setor: setor.nome, mensagem: `⚠️ ${setor.nome}: ${diurnos}/${setor.min_profissionais_diurno || 1} profissionais no diurno` });
      if (noturnos < (setor.min_profissionais_noturno || 1)) alerts.push({ tipo: "noturno", setor: setor.nome, mensagem: `🌙 ${setor.nome}: ${noturnos}/${setor.min_profissionais_noturno || 1} profissionais no noturno` });
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
          if (currentRatio > maxRatio) { status = "critico"; criticalReason = `${currentRatio.toFixed(0)} pac/${profissao === "enfermeiro" ? "Enf" : profissao === "fisioterapeuta" ? "Fisio" : profissao} (máx: ${maxRatio})`; break; }
          else if (currentRatio > maxRatio * 0.75) { status = "atencao"; criticalReason = "Proporção próxima do limite"; }
        }
        if (total === 0 && pacientes > 0) { status = "critico"; criticalReason = "Sem profissionais escalados"; }
      }
      if (total < (setor.min_profissionais_diurno || 1) && status === "ok") { status = "atencao"; criticalReason = "Abaixo do mínimo configurado"; }
      return { id: setor.id, nome: setor.nome, escalados: total, minimo: minRequired, pacientes, status, criticalReason, profByType, coberto: total >= (setor.min_profissionais_diurno || 1) };
    });
  }, [sectors, todayShifts, censoHoje]);

  const coverageSuggestions = useMemo(() => {
    if (!suggestSectorId) return [];
    const escaladosHoje = new Set(todayShifts.map((s: any) => s.profissional_id));
    const available = (allProfessionals as any[]).filter(p => !escaladosHoje.has(p.id)).map(p => ({ ...p, isFromCalmSector: false }));
    const calmSectors = capacityAnalysis.filter(s => s.status === "ok" && s.escalados > 1 && s.id !== suggestSectorId);
    const remanejamento: any[] = [];
    for (const calm of calmSectors) {
      const profsInCalm = todayShifts.filter((s: any) => s.setor_id === calm.id).map((s: any) => ({ ...(s.professionals as any), isFromCalmSector: true, sectorOrigem: calm.nome }));
      remanejamento.push(...profsInCalm);
    }
    return { available: available.slice(0, 5), remanejamento: remanejamento.slice(0, 5) };
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

  // ── Derived Values ──
  const totalShifts = shifts.length;
  const confirmed = shifts.filter((s: any) => s.status === "confirmado").length;
  const pending = shifts.filter((s: any) => s.status === "pendente").length;
  const alertCount = coverageAlerts.length + docWarnings.length;
  const swapsRequested = swaps.length;
  const swapsApproved = swaps.filter((s: any) => s.status === "aprovada" || s.status === "concluida").length;

  // Profession distribution for bar chart
  const professionData = useMemo(() => {
    const map: Record<string, { count: number }> = {};
    shifts.forEach((s: any) => {
      const prof = (s.professionals as any)?.profissao || "outro";
      if (!map[prof]) map[prof] = { count: 0 };
      map[prof].count++;
    });
    const colors: Record<string, string> = { medico: "#1A56DB", enfermeiro: "#059669", fisioterapeuta: "#0D9E8A", tecnico_enfermagem: "#D97706", outro: "#7C3AED" };
    return Object.entries(map).map(([k, v]) => ({ name: PROFISSAO_LABELS[k as keyof typeof PROFISSAO_LABELS] || k, ...v, fill: colors[k] || "#6B7280" }));
  }, [shifts]);

  const coveragePct = capacityAnalysis.length > 0 ? Math.round((capacityAnalysis.filter(s => s.coberto).length / capacityAnalysis.length) * 100) : 100;

  const activeToday = todayShifts.filter((s: any) => {
    const now = new Date().toTimeString().slice(0, 5);
    return s.hora_inicio <= now && s.hora_fim >= now;
  });

  const sectorMap: Record<string, { name: string; plantoes: number }> = {};
  shifts.forEach((s: any) => {
    const nome = (s.sectors as any)?.nome || "Sem setor";
    if (!sectorMap[s.setor_id]) sectorMap[s.setor_id] = { name: nome, plantoes: 0 };
    sectorMap[s.setor_id].plantoes++;
  });
  const sectorData = Object.values(sectorMap).sort((a, b) => b.plantoes - a.plantoes);

  const statusColor = (s: string) => s === "critico" ? "text-destructive" : s === "atencao" ? "text-warning" : "text-success";
  const statusIcon = (s: string) => s === "critico" ? "🔴" : s === "atencao" ? "🟡" : "🟢";

  const feedIconMap: Record<string, string> = { escala: "📋", trocas: "🔄", profissionais: "👥", configuracoes: "⚙️", relatorios: "📊", sistema: "🔐" };

  // Swap status styling
  const swapStatusStyle = (s: string) => {
    if (["aprovada", "concluida", "aceita"].includes(s)) return "bg-success/10 text-success";
    if (["recusada", "rejeitada", "cancelada"].includes(s)) return "bg-destructive/10 text-destructive";
    return "bg-warning/10 text-warning";
  };
  const swapStatusLabel = (s: string) => {
    const m: Record<string, string> = { solicitada: "Pendente", aguardando_resposta: "Aguardando", aceita: "Aceita", recusada: "Recusada", aguardando_aprovacao: "Aguardando", aprovada: "Aprovada", rejeitada: "Rejeitada", cancelada: "Cancelada", concluida: "Concluída" };
    return m[s] || s;
  };

  const getInitials = (name: string) => name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
  const avatarColors = ["bg-primary", "bg-success", "bg-warning", "bg-accent", "bg-info", "bg-destructive"];
  const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  // Timeline data
  const timelineHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2];
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  // ── RENDER ──
  return (
    <div className="space-y-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── TOPBAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral das operações de plantão</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Realtime Badge */}
          <div className="flex items-center gap-2 bg-success/10 text-success px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Tempo Real
          </div>
          <RealtimeClock />
          <button
            onClick={() => {
              const inputs: Record<string, number> = {};
              (sectors as any[]).forEach(s => {
                const existing = (censoHoje as any[]).find(c => c.setor_id === s.id);
                inputs[s.id] = existing?.leitos_ocupados || 0;
              });
              setCensoInputs(inputs);
              setCensoModalOpen(true);
            }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <BedDouble className="h-4 w-4" /> Censo de Pacientes
          </button>
        </div>
      </div>

      {/* ── KPI CARDS 4×2 ── */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Plantões do Mês" value={totalShifts} icon={Calendar} barColor="#1A56DB" iconBg="rgba(26,86,219,0.1)" iconColor="#1A56DB" />
        <KpiCard label="Confirmados" value={confirmed} icon={CheckCircle2} barColor="#059669" iconBg="rgba(5,150,105,0.1)" iconColor="#059669" trend={totalShifts > 0 ? Math.round((confirmed / totalShifts) * 100) : 0} />
        <KpiCard label="Pendentes" value={pending} icon={Clock} barColor="#D97706" iconBg="rgba(217,119,6,0.1)" iconColor="#D97706" />
        <KpiCard label="Alertas" value={alertCount} icon={AlertTriangle} barColor="#DC2626" iconBg="rgba(220,38,38,0.1)" iconColor="#DC2626" />
        <KpiCard label="Trocas Solicitadas" value={swapsRequested} icon={ArrowLeftRight} barColor="#7C3AED" iconBg="rgba(124,58,237,0.1)" iconColor="#7C3AED" />
        <KpiCard label="Trocas Aprovadas" value={swapsApproved} icon={TrendingUp} barColor="#059669" iconBg="rgba(5,150,105,0.1)" iconColor="#059669" />
        <KpiCard label="Profissionais Ativos" value={profCount} icon={Users} barColor="#0D9E8A" iconBg="rgba(13,158,138,0.1)" iconColor="#0D9E8A" />
      </motion.div>

      {/* ── OCCUPANCY PANEL ── */}
      <PainelOcupacao />
      <AcionamentosTracker />

      {/* ── SECTOR OCCUPANCY GRID ── */}
      {ocupacoes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">Ocupação por Setor</h2>
            <div className="flex items-center gap-3 text-[10px] font-medium text-muted-foreground">
              {["normal", "atencao", "lotado", "superlotado"].map(n => {
                const count = ocupacoes.filter((o: any) => o.nivel === n).length;
                const labels: Record<string, string> = { normal: "🟢 Normal", atencao: "🟡 Atenção", lotado: "🔴 Lotado", superlotado: "🆘 Superlotado" };
                return <span key={n}>{labels[n]} ({count})</span>;
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(ocupacoes as any[]).map(o => (
              <OccupancySectorCard key={o.id} nome={(o.sectors as any)?.nome || "—"} nivel={o.nivel} pacientes={o.pacientes_atual} capacidade={o.capacidade_maxima} status={o.nivel} />
            ))}
          </div>
        </motion.div>
      )}

      {/* ── CRITICAL ALERTS ── */}
      {capacityAnalysis.filter(s => s.status === "critico").length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
          <h3 className="font-semibold text-destructive mb-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" /> Risco de Sobrecarga Detectado
          </h3>
          <div className="space-y-2">
            {capacityAnalysis.filter(s => s.status === "critico").map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 bg-card rounded-lg border border-destructive/10">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.nome}: {a.escalados} profissional(is) para {a.pacientes} paciente(s)</p>
                  <p className="text-xs text-muted-foreground">{a.criticalReason}</p>
                </div>
                <button onClick={() => { setSuggestSectorId(a.id); setSuggestModalOpen(true); }} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
                  <Lightbulb className="h-3.5 w-3.5" /> Achar Solução
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── HISTORICAL PREDICTION ── */}
      {historicalPrediction.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-info/5 border border-info/20 rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-info" /> Previsão Histórica — Dias de Alta Demanda
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Baseado nos últimos 3 meses:</p>
          <div className="flex flex-wrap gap-2">
            {historicalPrediction.map(d => (
              <div key={d.day} className="px-3 py-2 rounded-lg bg-info/10 border border-info/20">
                <p className="text-sm font-semibold text-info">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.cancels} cancel. · {d.swaps} trocas</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-warning font-medium mt-3">⚡ Recomendação: Escale +1 reserva nestes dias.</p>
        </motion.div>
      )}

      {/* ── ALERTS ROW ── */}
      {(coverageAlerts.length > 0 || docWarnings.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive" /> Alertas
          </h2>
          <div className="space-y-2">
            {coverageAlerts.map((a, i) => (
              <div key={`cov-${i}`} className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/10 rounded-lg">
                <p className="text-sm text-foreground">{a.mensagem}</p>
                <button onClick={() => navigate("/escala")} className="shrink-0 text-xs font-semibold text-primary hover:underline">Escalar →</button>
              </div>
            ))}
            {docWarnings.map((d, i) => (
              <div key={`doc-${i}`} className={`flex items-center justify-between p-3 rounded-lg border ${d.vencido ? "bg-destructive/5 border-destructive/10" : "bg-warning/5 border-warning/10"}`}>
                <p className={`text-sm ${d.vencido ? "text-destructive font-medium" : "text-foreground"}`}>
                  {d.vencido ? "🔴" : "🟡"} {d.nome}: {d.conselho} {d.vencido ? `VENCIDO em ${d.validade}` : `vence em ${d.dias} dias`}
                </p>
                <button onClick={() => navigate("/profissionais")} className="shrink-0 text-xs font-semibold text-primary hover:underline">Revisar →</button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── TIMELINE + TODAY'S SHIFTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <motion.div variants={item} initial="hidden" animate="show" className="lg:col-span-2 bg-card rounded-lg border border-border shadow-sm p-4">
          <h3 className="text-sm font-bold text-foreground mb-4">Escala do Dia — Timeline</h3>
          <div className="relative overflow-x-auto">
            <div className="flex items-end gap-0 min-w-[600px]" style={{ height: 200 }}>
              {/* Hour axis */}
              <div className="flex flex-col justify-between h-full pr-2 shrink-0" style={{ width: 100 }}>
                {todayShifts.slice(0, 8).map((s: any, i: number) => (
                  <div key={i} className="text-[10px] text-muted-foreground truncate" style={{ fontFamily: "'DM Mono', monospace" }}>
                    {(s.professionals as any)?.nome?.split(" ").slice(0, 2).join(" ") || "—"}
                  </div>
                ))}
              </div>
              <div className="flex-1 relative h-full">
                {/* Hour labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between">
                  {[6, 8, 10, 12, 14, 16, 18, 20, 22, 0, 2].map(h => (
                    <span key={h} className="text-[9px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{String(h).padStart(2, "0")}h</span>
                  ))}
                </div>
                {/* Shift bars */}
                <div className="absolute inset-0 bottom-4 flex flex-col justify-between">
                  {todayShifts.slice(0, 8).map((s: any, i: number) => {
                    const startH = parseInt((s.hora_inicio as string).split(":")[0]);
                    const endH = parseInt((s.hora_fim as string).split(":")[0]) || 24;
                    const isNight = startH >= 19 || endH <= 6;
                    const left = Math.max(0, ((startH < 6 ? startH + 24 : startH) - 6) / 20) * 100;
                    const width = Math.min(100 - left, ((endH < startH ? endH + 24 : endH) - (startH < 6 ? startH + 24 : startH)) / 20 * 100);
                    return (
                      <div key={i} className="relative h-4">
                        <div
                          className={`absolute h-full rounded ${isNight ? "bg-[#7C3AED]/70" : "bg-primary/70"}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* Now line */}
                {(() => {
                  const nowH = currentHour < 6 ? currentHour + 24 : currentHour;
                  const pos = ((nowH - 6 + currentMinute / 60) / 20) * 100;
                  if (pos >= 0 && pos <= 100) return (
                    <div className="absolute top-0 bottom-4" style={{ left: `${pos}%` }}>
                      <div className="w-[2px] h-full bg-destructive" />
                      <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-bold text-destructive" style={{ fontFamily: "'DM Mono', monospace" }}>AGORA</span>
                    </div>
                  );
                  return null;
                })()}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Today's Shifts List */}
        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-lg border border-border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Plantões Hoje</h3>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              {activeToday.length} ativos
            </div>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {todayShifts.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum plantão hoje.</p>}
            {todayShifts.slice(0, 10).map((s: any, i: number) => {
              const prof = s.professionals as any;
              const name = prof?.nome || "—";
              return (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <div className={`h-7 w-7 rounded-full ${getAvatarColor(name)} flex items-center justify-center shrink-0`}>
                    <span className="text-[10px] font-bold text-primary-foreground">{getInitials(name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {(s.sectors as any)?.nome} · <span className="text-primary">{PROFISSAO_LABELS[prof?.profissao as keyof typeof PROFISSAO_LABELS] || prof?.profissao}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0" style={{ fontFamily: "'DM Mono', monospace" }}>
                    {s.hora_inicio?.slice(0, 5)}–{s.hora_fim?.slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ── SWAPS + PROFESSION CHART ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Swaps */}
        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-lg border border-border shadow-sm p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Trocas Recentes</h3>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {swaps.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma troca registrada.</p>}
            {(swaps as any[]).slice(0, 8).map((sw: any) => {
              const solName = sw.solicitante?.nome || "—";
              const destName = sw.destinatario?.nome || "Grupo";
              return (
                <div key={sw.id} className="flex items-center gap-3 py-1.5">
                  <div className="flex items-center -space-x-2">
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(solName)} flex items-center justify-center border-2 border-card z-10`}>
                      <span className="text-[9px] font-bold text-primary-foreground">{getInitials(solName)}</span>
                    </div>
                    <div className={`h-7 w-7 rounded-full ${getAvatarColor(destName)} flex items-center justify-center border-2 border-card`}>
                      <span className="text-[9px] font-bold text-primary-foreground">{getInitials(destName)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {solName.split(" ")[0]} ↔ {destName.split(" ")[0]}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{new Date(sw.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${swapStatusStyle(sw.status)}`}>
                    {swapStatusLabel(sw.status)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Profession Bar Chart */}
        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-lg border border-border shadow-sm p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Plantões por Profissão</h3>
          {professionData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={professionData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 11 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {professionData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
                <span>Total Plantões: <strong className="text-foreground">{totalShifts}</strong></span>
                <span>Confirmados: <strong className="text-foreground">{confirmed}</strong></span>
                <span>Cobertura: <strong className="text-foreground">{coveragePct}%</strong></span>
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground text-center py-8">Sem dados.</p>}
        </motion.div>
      </div>

      {/* ── CAPACITY TABLE ── */}
      {capacityAnalysis.length > 0 && (
        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-lg border border-border shadow-sm p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" /> Gestão de Capacidade por Setor
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-semibold uppercase tracking-wider">Setor</th>
                  <th className="text-center p-2 text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                  <th className="text-center p-2 text-muted-foreground font-semibold uppercase tracking-wider">Escalados</th>
                  <th className="text-center p-2 text-muted-foreground font-semibold uppercase tracking-wider">Pacientes</th>
                  <th className="text-center p-2 text-muted-foreground font-semibold uppercase tracking-wider">Cobertura</th>
                  <th className="text-center p-2 text-muted-foreground font-semibold uppercase tracking-wider">Ação</th>
                </tr>
              </thead>
              <tbody>
                {capacityAnalysis.map(row => (
                  <tr key={row.nome} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-2 font-medium text-foreground">{row.nome}</td>
                    <td className="p-2 text-center" title={row.criticalReason || "Equipe suficiente"}>
                      <span className="cursor-help">{statusIcon(row.status)}</span>
                    </td>
                    <td className="p-2 text-center text-foreground">{row.escalados}</td>
                    <td className="p-2 text-center text-foreground">{row.pacientes || "—"}</td>
                    <td className="p-2 text-center"><Progress value={Math.min(100, (row.escalados / Math.max(1, row.minimo)) * 100)} className="h-1.5 w-16 mx-auto" /></td>
                    <td className="p-2 text-center">
                      {row.status === "critico" && (
                        <button onClick={() => { setSuggestSectorId(row.id); setSuggestModalOpen(true); }} className="text-xs text-primary font-semibold hover:underline">Sugerir →</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-lg border border-border shadow-sm p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Plantões por Setor</h3>
          {sectorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sectorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 11 }} />
                <Bar dataKey="plantoes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-muted-foreground text-center py-8">Sem dados.</p>}
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="bg-card rounded-lg border border-border shadow-sm p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Atividades Recentes
          </h3>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {recentLogs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade.</p>}
            {recentLogs.map((a: any) => (
              <div key={a.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <span className="text-sm shrink-0">{feedIconMap[a.modulo] || "📌"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">{a.acao}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {a.usuario_nome || "Sistema"} · {new Date(a.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── CENSO MODAL ── */}
      {censoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-md w-full shadow-lg">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2 text-base">
              <BedDouble className="h-5 w-5 text-primary" /> Censo de Pacientes — Hoje
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Informe o número de leitos ocupados por setor.</p>
            <div className="space-y-3 max-h-60 overflow-y-auto">
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
              <button onClick={() => setCensoModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => salvarCensoMutation.mutate()} disabled={salvarCensoMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {salvarCensoMutation.isPending ? "Salvando..." : "Salvar Censo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SUGGEST COVERAGE MODAL ── */}
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
              {(coverageSuggestions as any)?.remanejamento?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">🔄 Remanejamento de setores calmos</h4>
                  <div className="space-y-2">
                    {(coverageSuggestions as any).remanejamento.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao as keyof typeof PROFISSAO_LABELS] || p.profissao} · Vindo de: {p.sectorOrigem}</p>
                        </div>
                        <button onClick={() => { navigate("/escala"); setSuggestModalOpen(false); }} className="text-xs text-primary font-semibold hover:underline">Escalar →</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(coverageSuggestions as any)?.available?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">✅ Profissionais de folga (menor custo)</h4>
                  <div className="space-y-2">
                    {(coverageSuggestions as any).available.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao as keyof typeof PROFISSAO_LABELS] || p.profissao}</p>
                        </div>
                        <button onClick={() => { navigate("/escala"); setSuggestModalOpen(false); }} className="text-xs text-primary font-semibold hover:underline">Escalar →</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(coverageSuggestions as any)?.available?.length === 0 && (coverageSuggestions as any)?.remanejamento?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sugestão disponível.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
