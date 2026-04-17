import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ArrowLeftRight, Clock3, Bell, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { AlertaReforco } from "@/components/AlertaReforco";

export default function ProfissionalDashboardPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { data: shifts = [] } = useQuery({
    queryKey: ["professional-dashboard-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, hora_inicio, hora_fim, carga_horaria, status, sectors:setor_id(nome)")
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["professional-dashboard-swaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_swaps")
        .select("id, status, created_at, solicitante:solicitante_id(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  const metrics = useMemo(() => {
    const upcoming = shifts.filter((s: any) => s.data >= today && s.status !== "cancelado");
    const pendingSwaps = swaps.filter((s: any) => ["solicitada", "aguardando_resposta"].includes(s.status));
    const monthShifts = shifts.filter((s: any) => s.data.startsWith(today.substring(0, 7)) && s.status !== "cancelado");
    const monthHours = monthShifts.reduce((sum: number, s: any) => sum + Number(s.carga_horaria || 0), 0);
    return { upcoming, pendingSwaps, monthHours, monthShifts: monthShifts.length };
  }, [shifts, swaps, today]);

  // Weekly calendar (next 7 days)
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayShifts = shifts.filter((s: any) => s.data === dateStr && s.status !== 'cancelado');
      days.push({ date: d, dateStr, shifts: dayShifts });
    }
    return days;
  }, [shifts]);

  const cards = [
    { label: "Próximos Plantões", value: metrics.upcoming.length, icon: CalendarDays, className: "bg-primary/10 text-primary" },
    { label: "Trocas Pendentes", value: metrics.pendingSwaps.length, icon: ArrowLeftRight, className: "bg-destructive/10 text-destructive", action: () => navigate("/minhas-trocas?tab=recebidas") },
    { label: "Horas no Mês", value: `${metrics.monthHours.toFixed(1)}h`, icon: Clock3, className: "bg-info/10 text-info" },
    { label: "Plantões no Mês", value: metrics.monthShifts, icon: CalendarDays, className: "bg-success/10 text-success" },
  ];

  return (
    <div className="space-y-6">
      {/* Reinforcement alerts */}
      <AlertaReforco />

      <div>
        <h1 className="module-title">Meu Painel</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo da sua operação individual.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className={`kpi-card ${card.action ? 'cursor-pointer' : ''}`} onClick={card.action}>
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
              <p className="text-xs text-destructive mt-2 font-medium flex items-center gap-1">Ver agora <ChevronRight className="h-3 w-3" /></p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Weekly Calendar */}
      <div className="kpi-card">
        <h2 className="text-base font-semibold text-foreground mb-3">Próximos 7 dias</h2>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const isToday = day.dateStr === today;
            return (
              <div key={day.dateStr} className={`rounded-lg border p-2 min-h-[80px] ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border/50'}`}>
                <p className={`text-xs font-medium ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day.date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.date.getDate()}</p>
                {day.shifts.map((s: any) => (
                  <div key={s.id} className="mt-1 text-[10px] bg-primary/10 text-primary rounded px-1 py-0.5 truncate">
                    {s.hora_inicio}-{s.hora_fim}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming shifts */}
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Próximos Plantões</h2>
            <button onClick={() => navigate('/minha-escala')} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          <div className="space-y-2">
            {metrics.upcoming.slice(0, 3).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <span className="text-foreground font-medium">{new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                  <span className="text-muted-foreground ml-2">{s.hora_inicio} - {s.hora_fim}</span>
                  {(s.sectors as any)?.nome && <span className="text-muted-foreground ml-2">• {(s.sectors as any).nome}</span>}
                </div>
                <span className="text-foreground font-medium">{Number(s.carga_horaria).toFixed(1)}h</span>
              </div>
            ))}
            {metrics.upcoming.length === 0 && <p className="text-sm text-muted-foreground">Sem plantões futuros.</p>}
          </div>
        </div>

        {/* Notifications */}
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notificações</h2>
            <button onClick={() => navigate('/notificacoes')} className="text-xs text-primary hover:underline">Ver todas</button>
          </div>
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div key={n.id} className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-muted/50">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="text-foreground">{n.titulo}</p>
                  <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {notifications.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma notificação pendente.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
