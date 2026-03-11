import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Calendar, CheckCircle2, Clock, ArrowLeftRight, AlertTriangle, DollarSign, Users, Activity } from "lucide-react";
import { shifts, swaps, professionals, activityFeed } from "@/data/mockData";
import { SHIFT_STATUS_LABELS, SWAP_STATUS_LABELS } from "@/types/hospital";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Dashboard() {
  const totalShifts = shifts.length;
  const confirmed = shifts.filter(s => s.status === 'confirmado').length;
  const pending = shifts.filter(s => s.status === 'pendente').length;
  const swapsRequested = swaps.length;
  const swapsApproved = swaps.filter(s => s.status === 'aprovada' || s.status === 'concluida').length;
  const swapsRejected = swaps.filter(s => s.status === 'recusada' || s.status === 'rejeitada').length;
  const conflicts = 2;
  const totalCost = shifts.filter(s => s.status !== 'cancelado').reduce((acc, s) => acc + s.valorTotal, 0);
  const activePros = professionals.filter(p => p.status === 'ativo').length;

  const kpis = [
    { label: "Plantões do Mês", value: totalShifts, icon: Calendar, color: "text-primary", bg: "bg-primary/10" },
    { label: "Confirmados", value: confirmed, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
    { label: "Pendentes", value: pending, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "Trocas Solicitadas", value: swapsRequested, icon: ArrowLeftRight, color: "text-info", bg: "bg-info/10" },
    { label: "Trocas Aprovadas", value: swapsApproved, icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: "Trocas Recusadas", value: swapsRejected, icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Conflitos", value: conflicts, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
    { label: "Custo Total", value: `R$ ${totalCost.toLocaleString('pt-BR')}`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10", wide: true },
    { label: "Profissionais Ativos", value: activePros, icon: Users, color: "text-accent", bg: "bg-accent/10" },
  ];

  const sectorData = [
    { name: 'UTI Adulto', plantoes: 4, custo: 6360 },
    { name: 'Pediatria', plantoes: 3, custo: 4650 },
    { name: 'Centro Cirúrgico', plantoes: 2, custo: 4800 },
    { name: 'Emergência', plantoes: 2, custo: 1500 },
    { name: 'Sala de Parto', plantoes: 1, custo: 2280 },
  ];

  const statusData = [
    { name: 'Confirmado', value: confirmed, color: 'hsl(152, 60%, 40%)' },
    { name: 'Agendado', value: shifts.filter(s => s.status === 'agendado').length, color: 'hsl(199, 89%, 48%)' },
    { name: 'Pendente', value: pending, color: 'hsl(38, 92%, 50%)' },
    { name: 'Concluído', value: shifts.filter(s => s.status === 'concluido').length, color: 'hsl(168, 72%, 36%)' },
    { name: 'Cancelado', value: shifts.filter(s => s.status === 'cancelado').length, color: 'hsl(0, 72%, 51%)' },
  ];

  const feedIconMap: Record<string, string> = {
    plantao_criado: '📋', troca_solicitada: '🔄', troca_aceita: '✅', troca_recusada: '❌', troca_aprovada: '✔️', plantao_cancelado: '🚫',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das operações de plantão</p>
      </div>

      <motion.div
        variants={container} initial="hidden" animate="show"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
      >
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
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="plantoes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Status dos Plantões</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-muted-foreground">{s.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item} initial="hidden" animate="show" className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Atividades Recentes
          </h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {activityFeed.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-lg shrink-0">{feedIconMap[a.tipo]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.usuario} • {new Date(a.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="kpi-card">
          <h3 className="font-display font-semibold text-foreground mb-4">Custo por Setor</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sectorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Custo']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="custo" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
