import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ArrowLeftRight, Clock3, Wallet } from "lucide-react";

export default function ProfissionalDashboardPage() {
  const { data: shifts = [] } = useQuery({
    queryKey: ["professional-dashboard-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, hora_inicio, hora_fim, carga_horaria, valor_total, status")
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
        .select("id, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const metrics = useMemo(() => {
    const now = new Date();
    const upcoming = shifts.filter((s: any) => new Date(`${s.data}T00:00:00`) >= now && s.status !== "cancelado");
    const completed = shifts.filter((s: any) => s.status === "concluido");
    const pendingSwaps = swaps.filter((s: any) => ["solicitada", "aguardando_resposta", "aguardando_aprovacao"].includes(s.status));
    const totalHours = completed.reduce((sum: number, s: any) => sum + Number(s.carga_horaria || 0), 0);
    const totalValue = completed.reduce((sum: number, s: any) => sum + Number(s.valor_total || 0), 0);

    return { upcoming, completed, pendingSwaps, totalHours, totalValue };
  }, [shifts, swaps]);

  const cards = [
    { label: "Próximos Plantões", value: metrics.upcoming.length, icon: CalendarDays, className: "bg-primary/10 text-primary" },
    { label: "Trocas Pendentes", value: metrics.pendingSwaps.length, icon: ArrowLeftRight, className: "bg-warning/10 text-warning" },
    { label: "Horas Trabalhadas", value: `${metrics.totalHours.toFixed(1)}h`, icon: Clock3, className: "bg-info/10 text-info" },
    { label: "Valor Acumulado", value: `R$ ${metrics.totalValue.toLocaleString("pt-BR")}`, icon: Wallet, className: "bg-success/10 text-success" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Meu Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo da sua operação individual.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="kpi-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kpi-label">{card.label}</p>
                <p className="kpi-value mt-1">{card.value}</p>
              </div>
              <div className={`rounded-lg p-2 ${card.className}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-semibold text-foreground">Próximos plantões</h2>
        <div className="mt-3 space-y-2">
          {metrics.upcoming.slice(0, 5).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="text-foreground">{new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")} • {s.hora_inicio} - {s.hora_fim}</span>
              <span className="text-muted-foreground">{s.status}</span>
            </div>
          ))}
          {metrics.upcoming.length === 0 && <p className="text-sm text-muted-foreground">Sem plantões futuros no momento.</p>}
        </div>
      </div>
    </div>
  );
}
