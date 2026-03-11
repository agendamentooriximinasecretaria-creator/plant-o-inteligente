import { shifts, professionals } from "@/data/mockData";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

export default function FinanceiroPage() {
  const activeShifts = shifts.filter(s => s.status !== 'cancelado');
  const totalCost = activeShifts.reduce((a, s) => a + s.valorTotal, 0);
  const completedCost = shifts.filter(s => s.status === 'concluido').reduce((a, s) => a + s.valorTotal, 0);
  const pendingCost = totalCost - completedCost;

  const byProfessional = professionals.filter(p => p.status === 'ativo').map(p => {
    const pShifts = activeShifts.filter(s => s.profissionalId === p.id);
    return {
      nome: p.nome.split(' ').slice(0, 2).join(' '),
      total: pShifts.reduce((a, s) => a + s.valorTotal, 0),
      horas: pShifts.reduce((a, s) => a + s.cargaHoraria, 0),
    };
  }).filter(p => p.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Controle financeiro dos plantões</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Custo Total', value: `R$ ${totalCost.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-primary bg-primary/10' },
          { label: 'Realizado', value: `R$ ${completedCost.toLocaleString('pt-BR')}`, icon: TrendingUp, color: 'text-success bg-success/10' },
          { label: 'Previsto', value: `R$ ${pendingCost.toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-warning bg-warning/10' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div className="flex items-start justify-between">
              <div><p className="kpi-label">{k.label}</p><p className="kpi-value mt-1">{k.value}</p></div>
              <div className={`p-2 rounded-lg ${k.color}`}><k.icon className="h-5 w-5" /></div>
            </div>
          </div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="kpi-card">
        <h3 className="font-display font-semibold text-foreground mb-4">Custo por Profissional</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byProfessional}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Total']}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: 12 }} />
            <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead><tr className="table-header">
            <th className="text-left p-3">Profissional</th>
            <th className="text-left p-3">Horas</th>
            <th className="text-left p-3">Valor/h</th>
            <th className="text-left p-3">Total</th>
          </tr></thead>
          <tbody>
            {byProfessional.map(p => {
              const pro = professionals.find(pr => pr.nome.includes(p.nome.split(' ')[1]));
              return (
                <tr key={p.nome} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">{p.nome}</td>
                  <td className="p-3 text-muted-foreground">{p.horas}h</td>
                  <td className="p-3 text-muted-foreground">R$ {pro?.valorHora || '-'}</td>
                  <td className="p-3 font-semibold text-foreground">R$ {p.total.toLocaleString('pt-BR')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
