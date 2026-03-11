import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function MeuFinanceiroPage() {
  const { data: shifts = [] } = useQuery({
    queryKey: ["professional-finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, carga_horaria, valor_total, status")
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const summary = useMemo(() => {
    const completed = shifts.filter((s: any) => s.status === "concluido");
    const planned = shifts.filter((s: any) => s.status !== "cancelado");

    return {
      totalHours: completed.reduce((sum: number, s: any) => sum + Number(s.carga_horaria || 0), 0),
      paidValue: completed.reduce((sum: number, s: any) => sum + Number(s.valor_total || 0), 0),
      plannedValue: planned.reduce((sum: number, s: any) => sum + Number(s.valor_total || 0), 0),
    };
  }, [shifts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Resumo financeiro pessoal com base na sua escala real.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="kpi-card"><p className="kpi-label">Horas trabalhadas</p><p className="kpi-value mt-1">{summary.totalHours.toFixed(1)}h</p></div>
        <div className="kpi-card"><p className="kpi-label">Valor realizado</p><p className="kpi-value mt-1">R$ {summary.paidValue.toLocaleString("pt-BR")}</p></div>
        <div className="kpi-card"><p className="kpi-label">Valor previsto</p><p className="kpi-value mt-1">R$ {summary.plannedValue.toLocaleString("pt-BR")}</p></div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Horas</th>
              <th className="p-3 text-left">Valor</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem lançamentos financeiros.</td></tr>
            ) : (
              shifts.map((s: any) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 text-foreground">{new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-muted-foreground">{s.carga_horaria}h</td>
                  <td className="p-3 font-medium text-foreground">R$ {Number(s.valor_total).toLocaleString("pt-BR")}</td>
                  <td className="p-3"><span className="status-badge bg-primary/10 text-primary">{s.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
