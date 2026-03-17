import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportToCSV } from "@/lib/exportUtils";
import { Download } from "lucide-react";
import { toast } from "sonner";

export default function MeuFinanceiroPage() {
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["professional-finance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, carga_horaria, valor_total, valor_hora, status")
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const today = new Date().toISOString().split('T')[0];

  const summary = useMemo(() => {
    const active = shifts.filter((s: any) => s.status !== "cancelado");
    const realized = active.filter((s: any) => s.data < today);
    const planned = active.filter((s: any) => s.data >= today);

    return {
      totalHours: active.reduce((sum: number, s: any) => sum + Number(s.carga_horaria || 0), 0),
      paidValue: realized.reduce((sum: number, s: any) => sum + Number(s.valor_total || 0), 0),
      plannedValue: planned.reduce((sum: number, s: any) => sum + Number(s.valor_total || 0), 0),
    };
  }, [shifts, today]);

  // Monthly chart data (last 6 months)
  const chartData = useMemo(() => {
    const months: Record<string, { month: string; total: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      months[key] = { month: label, total: 0 };
    }
    shifts.filter((s: any) => s.status !== 'cancelado').forEach((s: any) => {
      const key = s.data.substring(0, 7);
      if (months[key]) months[key].total += Number(s.valor_total || 0);
    });
    return Object.values(months);
  }, [shifts]);

  const handleExport = () => {
    const cols = ['Data', 'Horas', 'Valor/h', 'Total', 'Status'];
    const rows = shifts.map((s: any) => [
      new Date(`${s.data}T12:00:00`).toLocaleDateString('pt-BR'),
      `${s.carga_horaria}h`,
      `R$ ${s.valor_hora}`,
      `R$ ${Number(s.valor_total).toLocaleString('pt-BR')}`,
      s.status,
    ]);
    exportToCSV(cols, rows, 'meu-financeiro');
    toast.success('Extrato exportado!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="module-title">Meu Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumo financeiro pessoal com base na sua escala real.</p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="kpi-card"><p className="kpi-label">Horas trabalhadas</p><p className="kpi-value mt-1">{summary.totalHours.toFixed(1)}h</p></div>
        <div className="kpi-card"><p className="kpi-label">Valor realizado</p><p className="kpi-value mt-1 text-success">R$ {summary.paidValue.toLocaleString("pt-BR")}</p></div>
        <div className="kpi-card"><p className="kpi-label">Valor previsto</p><p className="kpi-value mt-1 text-warning">R$ {summary.plannedValue.toLocaleString("pt-BR")}</p></div>
      </div>

      {chartData.some(d => d.total > 0) && (
        <div className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Total']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12 }} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Horas</th>
              <th className="p-3 text-left">Valor/h</th>
              <th className="p-3 text-left">Valor</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem lançamentos financeiros.</td></tr>
            ) : (
              shifts.map((s: any) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 text-foreground">{new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-muted-foreground">{s.carga_horaria}h</td>
                  <td className="p-3 text-muted-foreground">R$ {s.valor_hora}</td>
                  <td className="p-3 font-medium text-foreground">R$ {Number(s.valor_total).toLocaleString("pt-BR")}</td>
                  <td className="p-3"><span className={`status-badge ${s.data < today ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{s.data < today ? 'Realizado' : 'Previsto'}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
