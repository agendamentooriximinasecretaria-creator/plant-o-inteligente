import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ArrowLeftRight, Clock3, Bell, ChevronRight, CheckCircle2, AlertTriangle, FileText, Ban, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { AlertaReforco } from "@/components/AlertaReforco";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { calcularHorasRealizadas, calcularHorasPrevistas, calcularCargaPercentual, CLT_LIMITE_MENSAL, isPlantaoContabilizavel } from "@/lib/horas";

const CLT_LIMIT = CLT_LIMITE_MENSAL; // horas/mês

export default function ProfissionalDashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { professionalId } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const monthPrefix = today.substring(0, 7);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: shifts = [] } = useQuery({
    queryKey: ["professional-dashboard-shifts", professionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, hora_inicio, hora_fim, carga_horaria, status, tipo_plantao, confirmado_pelo_profissional, confirmado_em, checkin_em, checkout_em, sectors:setor_id(nome), units:unidade_id(nome)")
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["professional-dashboard-swaps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_swaps")
        .select("id, status, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["professional-dashboard-notifs"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("id, titulo, created_at, lida").eq("lida", false).order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ["professional-documents-summary", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data } = await supabase
        .from("professional_documents")
        .select("id, tipo, nome, validade, status")
        .eq("profissional_id", professionalId!);
      return data || [];
    },
  });

  const confirmShift = useMutation({
    mutationFn: async (shiftId: string) => {
      setConfirmingId(shiftId);
      const { error } = await supabase
        .from("shifts")
        .update({ confirmado_pelo_profissional: true, confirmado_em: new Date().toISOString(), status: "confirmado" })
        .eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Presença confirmada!");
      qc.invalidateQueries({ queryKey: ["professional-dashboard-shifts"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao confirmar"),
    onSettled: () => setConfirmingId(null),
  });

  const metrics = useMemo(() => {
    const upcoming = shifts.filter((s: any) => s.data >= today && isPlantaoContabilizavel(s));
    const pendingSwaps = swaps.filter((s: any) => ["solicitada", "aguardando_resposta", "aguardando_aprovacao"].includes(s.status));
    const monthShifts = shifts.filter((s: any) => s.data.startsWith(monthPrefix) && isPlantaoContabilizavel(s));

    // Fonte única: calcularHorasRealizadas / Previstas (totais do mês)
    const realizado = calcularHorasRealizadas(shifts as any[], undefined, monthPrefix);
    const previstoFuturo = calcularHorasPrevistas(shifts as any[], undefined, monthPrefix);
    const previsto = realizado + previstoFuturo; // total do mês (realizado + agendado futuro)
    const saldoBanco = realizado - CLT_LIMIT;
    const pctCLT = calcularCargaPercentual(previsto, CLT_LIMIT);

    const naoConfirmados = upcoming.filter((s: any) => !s.confirmado_pelo_profissional).length;

    return { upcoming, pendingSwaps, realizado, previsto, saldoBanco, pctCLT, monthShifts: monthShifts.length, naoConfirmados };
  }, [shifts, swaps, today, monthPrefix]);

  const docsPendentes = useMemo(() => {
    const hoje = new Date();
    const em30d = new Date();
    em30d.setDate(em30d.getDate() + 30);
    return documentos.filter((d: any) => {
      if (!d.validade) return false;
      const v = new Date(d.validade);
      return v <= em30d;
    });
  }, [documentos]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayShifts = shifts.filter((s: any) => s.data === dateStr && s.status !== "cancelado");
      days.push({ date: d, dateStr, shifts: dayShifts });
    }
    return days;
  }, [shifts]);

  const cards = [
    { label: "Próximos Plantões", value: metrics.upcoming.length, icon: CalendarDays, className: "bg-primary/10 text-primary" },
    { label: "A Confirmar", value: metrics.naoConfirmados, icon: CheckCircle2, className: "bg-warning/10 text-warning", action: metrics.naoConfirmados > 0 ? () => document.getElementById("confirmar-section")?.scrollIntoView({ behavior: "smooth" }) : undefined },
    { label: "Trocas Pendentes", value: metrics.pendingSwaps.length, icon: ArrowLeftRight, className: "bg-destructive/10 text-destructive", action: () => navigate("/minhas-trocas?tab=recebidas") },
  ];

  return (
    <div className="space-y-6">
      <AlertaReforco />

      <div>
        <h1 className="module-title">Meu Painel</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe seus plantões, presença e banco de horas.</p>
      </div>

      {docsPendentes.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Documento(s) próximos do vencimento</p>
            <p className="text-xs text-muted-foreground mt-0.5">{docsPendentes.length} documento(s) vencem em até 30 dias.</p>
          </div>
          <button onClick={() => navigate("/meus-documentos")} className="text-xs font-medium text-warning hover:underline">Revisar</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={`kpi-card ${card.action ? "cursor-pointer" : ""}`} onClick={card.action}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kpi-label">{card.label}</p>
                <p className="kpi-value mt-1">{card.value}</p>
              </div>
              <div className={`rounded-lg p-2 ${card.className}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            {card.action && Number(card.value) > 0 && (
              <p className="text-xs text-primary mt-2 font-medium flex items-center gap-1">Ver agora <ChevronRight className="h-3 w-3" /></p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Banco de horas CLT 220h */}
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Banco de Horas — CLT 220h/mês</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Realizado − 220h de referência mensal</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold font-mono ${metrics.saldoBanco >= 0 ? "text-success" : "text-warning"}`}>
              {metrics.saldoBanco >= 0 ? "+" : ""}{metrics.saldoBanco.toFixed(1)}h
            </p>
            <p className="text-[11px] text-muted-foreground">{metrics.saldoBanco >= 0 ? "saldo positivo" : "horas a cumprir"}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Previsto: <span className="font-mono font-medium text-foreground">{metrics.previsto.toFixed(1)}h</span></span>
            <span>Realizado: <span className="font-mono font-medium text-foreground">{metrics.realizado.toFixed(1)}h</span></span>
            <span>Limite CLT: <span className="font-mono font-medium text-foreground">{CLT_LIMIT}h</span></span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-all ${metrics.pctCLT >= 100 ? "bg-destructive" : metrics.pctCLT >= 85 ? "bg-warning" : "bg-primary"}`}
              style={{ width: `${metrics.pctCLT}%` }}
            />
          </div>
        </div>
      </div>

      {/* Weekly calendar */}
      <div className="kpi-card">
        <h2 className="text-base font-semibold text-foreground mb-3">Próximos 7 dias</h2>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const isToday = day.dateStr === today;
            return (
              <div key={day.dateStr} className={`rounded-lg border p-2 min-h-[80px] ${isToday ? "border-primary/50 bg-primary/5" : "border-border/50"}`}>
                <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {day.date.toLocaleDateString("pt-BR", { weekday: "short" })}
                </p>
                <p className={`text-sm font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{day.date.getDate()}</p>
                {day.shifts.map((s: any) => (
                  <div key={s.id} className={`mt-1 text-[10px] rounded px-1 py-0.5 truncate ${s.tipo_plantao === "folga" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                    {s.tipo_plantao === "folga" ? "Folga" : `${s.hora_inicio?.slice(0, 5)}`}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmar presença */}
      <div id="confirmar-section" className="kpi-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Próximos Plantões — Confirmar Presença</h2>
          <button onClick={() => navigate("/minha-escala")} className="text-xs text-primary hover:underline">Ver escala completa</button>
        </div>
        <div className="space-y-2">
          {metrics.upcoming.slice(0, 5).map((s: any) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
              <div className="flex-1 min-w-[200px]">
                <p className="text-foreground font-medium">
                  {new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  <span className="text-muted-foreground ml-2 font-normal">{s.hora_inicio?.slice(0, 5)} – {s.hora_fim?.slice(0, 5)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {(s.units as any)?.nome} • {(s.sectors as any)?.nome} • {Number(s.carga_horaria).toFixed(1)}h
                </p>
              </div>
              {s.confirmado_pelo_profissional ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-md">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
                </span>
              ) : (
                <button
                  disabled={confirmingId === s.id}
                  onClick={() => confirmShift.mutate(s.id)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {confirmingId === s.id ? "Confirmando..." : "Confirmar Presença"}
                </button>
              )}
            </div>
          ))}
          {metrics.upcoming.length === 0 && <p className="text-sm text-muted-foreground">Sem plantões futuros.</p>}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => navigate("/minha-indisponibilidade")} className="kpi-card text-left hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-warning/10 text-warning"><Ban className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Indisponibilidade</p>
              <p className="text-xs text-muted-foreground">Avise sobre dias indisponíveis</p>
            </div>
          </div>
        </button>
        <button onClick={() => navigate("/meus-documentos")} className="kpi-card text-left hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-info/10 text-info"><FileText className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Meus Documentos</p>
              <p className="text-xs text-muted-foreground">{documentos.length} cadastrado(s)</p>
            </div>
          </div>
        </button>
        <button onClick={() => navigate("/minhas-trocas")} className="kpi-card text-left hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-primary/10 text-primary"><ArrowLeftRight className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Solicitar Troca</p>
              <p className="text-xs text-muted-foreground">{metrics.pendingSwaps.length} pendente(s)</p>
            </div>
          </div>
        </button>
      </div>

      {/* Notifications */}
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notificações</h2>
          <button onClick={() => navigate("/notificacoes")} className="text-xs text-primary hover:underline">Ver todas</button>
        </div>
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <div key={n.id} className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-muted/50">
              <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div>
                <p className="text-foreground">{n.titulo}</p>
                <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
          {notifications.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma notificação pendente.</p>}
        </div>
      </div>
    </div>
  );
}
