import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { exportToPDF, exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const PROFISSAO_LABELS: Record<string, string> = { medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta', tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)', terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista', fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro' };

const CORES = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))'];

const reports = [
  { id: 'profissionais', nome: 'Relatório de Profissionais', descricao: 'Lista completa de profissionais cadastrados', icon: '👥' },
  { id: 'plantoes', nome: 'Relatório de Plantões', descricao: 'Todos os plantões organizados por período', icon: '📋' },
  { id: 'horas_profissional', nome: 'Horas por Profissional', descricao: 'Total de horas trabalhadas por profissional', icon: '⏱️', hasChart: true },
  { id: 'trocas', nome: 'Relatório de Trocas', descricao: 'Histórico completo de trocas de plantão', icon: '🔄' },
  { id: 'setores', nome: 'Relatório por Setor', descricao: 'Plantões agrupados por setor', icon: '🏥', hasChart: true },
  { id: 'cancelados', nome: 'Relatório de Plantões Cancelados', descricao: 'Plantões que foram cancelados', icon: '❌' },
  { id: 'escala_mensal', nome: 'Escala Mensal Consolidada', descricao: 'Grid profissional × dia do mês', icon: '📆' },
  { id: 'analise_trocas', nome: 'Análise de Trocas', descricao: 'Estatísticas e taxa de aprovação', icon: '📊', hasChart: true },
  { id: 'cobertura_setor', nome: 'Cobertura por Setor', descricao: 'Plantões por setor com visualização', icon: '📈', hasChart: true },
];

export default function RelatoriosPage() {
  const [exporting, setExporting] = useState('');
  const [chartReport, setChartReport] = useState<string | null>(null);

  const { data: professionals = [] } = useQuery({ queryKey: ['professionals'], queryFn: async () => { const { data } = await supabase.from('professionals').select('id, nome, profissao, especialidade, telefone, email, status, setor_principal_id, unidade_principal_id').order('nome'); return data || []; } });
  const { data: shifts = [] } = useQuery({ queryKey: ['shifts-report'], queryFn: async () => { const { data } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao), sectors:setor_id(nome), units:unidade_id(nome)').order('data', { ascending: false }); return data || []; } });
  const { data: swaps = [] } = useQuery({ queryKey: ['swaps-report'], queryFn: async () => { const { data } = await supabase.from('shift_swaps').select('*, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome)').order('created_at', { ascending: false }); return data || []; } });

  // Chart data
  const horasChartData = useMemo(() => {
    const byProf: Record<string, { nome: string; horas: number }> = {};
    shifts.forEach((s: any) => {
      if (s.status === 'cancelado') return;
      const nome = (s.professionals as any)?.nome || 'Desc.';
      if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, horas: 0 };
      byProf[s.profissional_id].horas += Number(s.carga_horaria || 0);
    });
    return Object.values(byProf).sort((a, b) => b.horas - a.horas).slice(0, 10);
  }, [shifts]);

  const setorChartData = useMemo(() => {
    const bySetor: Record<string, { nome: string; count: number }> = {};
    shifts.forEach((s: any) => {
      const nome = (s.sectors as any)?.nome || 'Desc.';
      if (!bySetor[s.setor_id]) bySetor[s.setor_id] = { nome, count: 0 };
      bySetor[s.setor_id].count++;
    });
    return Object.values(bySetor);
  }, [shifts]);

  const trocasChartData = useMemo(() => {
    const total = swaps.length;
    const aprovadas = swaps.filter((s: any) => s.status === 'aprovada' || s.status === 'concluida').length;
    const rejeitadas = swaps.filter((s: any) => s.status === 'rejeitada' || s.status === 'recusada').length;
    const pendentes = swaps.filter((s: any) => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'].includes(s.status)).length;
    return [
      { name: 'Aprovadas', value: aprovadas },
      { name: 'Rejeitadas', value: rejeitadas },
      { name: 'Pendentes', value: pendentes },
      { name: 'Canceladas', value: total - aprovadas - rejeitadas - pendentes },
    ].filter(d => d.value > 0);
  }, [swaps]);

  const getReportData = (id: string): { columns: string[]; rows: string[][] } => {
    switch (id) {
      case 'profissionais':
        return { columns: ['Nome', 'Profissão', 'Especialidade', 'E-mail', 'Telefone', 'Status'], rows: professionals.map((p: any) => [p.nome, PROFISSAO_LABELS[p.profissao] || p.profissao, p.especialidade || '', p.email, p.telefone || '', p.status]) };
      case 'plantoes':
        return { columns: ['Profissional', 'Setor', 'Unidade', 'Data', 'Horário', 'Carga', 'Status'], rows: shifts.map((s: any) => [(s.professionals as any)?.nome || '', (s.sectors as any)?.nome || '', (s.units as any)?.nome || '', new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), `${s.hora_inicio}-${s.hora_fim}`, `${s.carga_horaria}h`, s.status]) };
      case 'horas_profissional': {
        const byProf: Record<string, { nome: string; hours: number; count: number }> = {};
        shifts.forEach((s: any) => {
          if (s.status === 'cancelado') return;
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, hours: 0, count: 0 };
          byProf[s.profissional_id].hours += Number(s.carga_horaria || 0);
          byProf[s.profissional_id].count++;
        });
        return { columns: ['Profissional', 'Plantões', 'Horas Totais'], rows: Object.values(byProf).map(p => [p.nome, String(p.count), `${p.hours.toFixed(1)}h`]) };
      }
      case 'trocas':
        return { columns: ['Solicitante', 'Destinatário', 'Motivo', 'Status', 'Data'], rows: swaps.map((s: any) => [(s.solicitante as any)?.nome || '', (s.destinatario as any)?.nome || 'Grupo', s.motivo, s.status, new Date(s.created_at).toLocaleDateString('pt-BR')]) };
      case 'cancelados':
        return { columns: ['Profissional', 'Setor', 'Data', 'Horário', 'Carga'], rows: shifts.filter((s: any) => s.status === 'cancelado').map((s: any) => [(s.professionals as any)?.nome || '', (s.sectors as any)?.nome || '', new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), `${s.hora_inicio}-${s.hora_fim}`, `${s.carga_horaria}h`]) };
      case 'setores': {
        const bySetor: Record<string, { nome: string; count: number; horas: number }> = {};
        shifts.forEach((s: any) => {
          const nome = (s.sectors as any)?.nome || 'Desconhecido';
          if (!bySetor[s.setor_id]) bySetor[s.setor_id] = { nome, count: 0, horas: 0 };
          bySetor[s.setor_id].count++;
          if (s.status !== 'cancelado') bySetor[s.setor_id].horas += Number(s.carga_horaria || 0);
        });
        return { columns: ['Setor', 'Qtd. Plantões', 'Horas Totais'], rows: Object.values(bySetor).map(s => [s.nome, String(s.count), `${s.horas.toFixed(1)}h`]) };
      }
      case 'escala_mensal': {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cols = ['Profissional', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))];
        const profMap: Record<string, { nome: string; days: Record<number, string> }> = {};
        shifts.forEach((s: any) => {
          const d = new Date(s.data + 'T12:00:00');
          if (d.getMonth() === month && d.getFullYear() === year) {
            const nome = (s.professionals as any)?.nome || '?';
            if (!profMap[s.profissional_id]) profMap[s.profissional_id] = { nome, days: {} };
            profMap[s.profissional_id].days[d.getDate()] = (s.sectors as any)?.nome?.substring(0, 3) || '✓';
          }
        });
        const rows = Object.values(profMap).map(p => [p.nome, ...Array.from({ length: daysInMonth }, (_, i) => p.days[i + 1] || '')]);
        return { columns: cols, rows };
      }
      case 'analise_trocas': {
        const total = swaps.length;
        const aprovadas = swaps.filter((s: any) => ['aprovada', 'concluida'].includes(s.status)).length;
        const taxa = total > 0 ? ((aprovadas / total) * 100).toFixed(1) : '0';
        return { columns: ['Métrica', 'Valor'], rows: [['Total de Trocas', String(total)], ['Aprovadas/Concluídas', String(aprovadas)], ['Taxa de Aprovação', `${taxa}%`], ['Rejeitadas', String(swaps.filter((s: any) => ['rejeitada', 'recusada'].includes(s.status)).length)], ['Pendentes', String(swaps.filter((s: any) => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao'].includes(s.status)).length)]] };
      }
      case 'cobertura_setor':
        return getReportData('setores');
      default: return { columns: [], rows: [] };
    }
  };

  const handleExport = async (reportId: string, format: 'pdf' | 'excel' | 'csv') => {
    setExporting(`${reportId}-${format}`);
    try {
      const report = reports.find(r => r.id === reportId)!;
      const { columns, rows } = getReportData(reportId);
      if (rows.length === 0) { toast.warning('Nenhum dado encontrado para exportar.'); return; }
      const filename = `${reportId}_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'pdf') exportToPDF(report.nome, columns, rows, filename);
      else if (format === 'excel') exportToExcel(report.nome, columns, rows, filename);
      else exportToCSV(columns, rows, filename);
      toast.success(`${report.nome} exportado com sucesso!`);
      await logAudit(`Relatório exportado: ${report.nome} (${format.toUpperCase()})`, 'relatorios', { reportId, format });
    } catch (e: any) {
      toast.error('Erro na exportação: ' + e.message);
    } finally {
      setExporting('');
    }
  };

  const renderChart = (reportId: string) => {
    if (reportId === 'horas_profissional' && horasChartData.length > 0) {
      return (
        <div className="h-64 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Top 10 — Horas por Profissional</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={horasChartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={75} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}h`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if ((reportId === 'setores' || reportId === 'cobertura_setor') && setorChartData.length > 0) {
      return (
        <div className="h-64 mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Plantões por Setor</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={setorChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="Plantões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    if (reportId === 'analise_trocas' && trocasChartData.length > 0) {
      return (
        <div className="h-64 mt-4 flex justify-center">
          <ResponsiveContainer width={300} height="100%">
            <PieChart>
              <Pie data={trocasChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {trocasChartData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div><h1 className="module-title">Relatórios</h1><p className="text-muted-foreground text-sm mt-1">Gere e exporte relatórios operacionais com dados reais</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
            <div className="flex items-start gap-4">
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-foreground">{r.nome}</h3>
                <p className="text-sm text-muted-foreground mt-1">{r.descricao}</p>
                <div className="flex gap-2 mt-4">
                  {(['pdf', 'excel', 'csv'] as const).map(f => (
                    <button key={f} onClick={() => handleExport(r.id, f)} disabled={!!exporting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                      {exporting === `${r.id}-${f}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} {f.toUpperCase()}
                    </button>
                  ))}
                  {r.hasChart && (
                    <button onClick={() => setChartReport(chartReport === r.id ? null : r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${chartReport === r.id ? 'bg-primary text-primary-foreground' : 'border border-border text-foreground hover:bg-muted'}`}>
                      📊 Gráfico
                    </button>
                  )}
                </div>
                {chartReport === r.id && renderChart(r.id)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
