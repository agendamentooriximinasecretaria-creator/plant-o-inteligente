import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Calendar, CheckCircle2, Clock, ArrowLeftRight, AlertTriangle, DollarSign, Users, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Dashboard() {
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

  // Build sector data from real shifts
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

  const feedIconMap: Record<string, string> = {
    escala: '📋', trocas: '🔄', profissionais: '👥', configuracoes: '⚙️', relatorios: '📊', sistema: '🔐',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das operações de plantão</p>
      </div>

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
    </div>
  );
}
