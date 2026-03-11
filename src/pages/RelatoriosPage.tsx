import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { exportToPDF, exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const PROFISSAO_LABELS: Record<string, string> = { medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta', tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)', terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista', fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro' };

const reports = [
  { id: 'profissionais', nome: 'Relatório de Profissionais', descricao: 'Lista completa de profissionais cadastrados', icon: '👥' },
  { id: 'plantoes', nome: 'Relatório de Plantões', descricao: 'Todos os plantões organizados por período', icon: '📋' },
  { id: 'financeiro', nome: 'Relatório Financeiro por Profissional', descricao: 'Detalhamento financeiro individual', icon: '💰' },
  { id: 'trocas', nome: 'Relatório de Trocas', descricao: 'Histórico completo de trocas de plantão', icon: '🔄' },
  { id: 'setores', nome: 'Relatório por Setor', descricao: 'Plantões e custos agrupados por setor', icon: '🏥' },
  { id: 'cancelados', nome: 'Relatório de Plantões Cancelados', descricao: 'Plantões que foram cancelados', icon: '❌' },
];

export default function RelatoriosPage() {
  const [exporting, setExporting] = useState('');

  const { data: professionals = [] } = useQuery({ queryKey: ['professionals'], queryFn: async () => { const { data } = await supabase.from('professionals').select('*').order('nome'); return data || []; } });
  const { data: shifts = [] } = useQuery({ queryKey: ['shifts-report'], queryFn: async () => { const { data } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao), sectors:setor_id(nome), units:unidade_id(nome)').order('data', { ascending: false }); return data || []; } });
  const { data: swaps = [] } = useQuery({ queryKey: ['swaps-report'], queryFn: async () => { const { data } = await supabase.from('shift_swaps').select('*, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome)').order('created_at', { ascending: false }); return data || []; } });

  const getReportData = (id: string): { columns: string[]; rows: string[][] } => {
    switch (id) {
      case 'profissionais':
        return { columns: ['Nome', 'Profissão', 'Especialidade', 'Registro', 'E-mail', 'Telefone', 'Valor/h', 'Status'], rows: professionals.map((p: any) => [p.nome, PROFISSAO_LABELS[p.profissao] || p.profissao, p.especialidade || '', p.registro || '', p.email, p.telefone || '', `R$ ${p.valor_hora}`, p.status]) };
      case 'plantoes':
        return { columns: ['Profissional', 'Setor', 'Unidade', 'Data', 'Horário', 'Carga', 'Valor', 'Status'], rows: shifts.map((s: any) => [(s.professionals as any)?.nome || '', (s.sectors as any)?.nome || '', (s.units as any)?.nome || '', new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), `${s.hora_inicio}-${s.hora_fim}`, `${s.carga_horaria}h`, `R$ ${Number(s.valor_total).toLocaleString('pt-BR')}`, s.status]) };
      case 'financeiro': {
        const byProf: Record<string, { nome: string; total: number; hours: number }> = {};
        shifts.forEach((s: any) => {
          const nome = (s.professionals as any)?.nome || 'Desconhecido';
          if (!byProf[s.profissional_id]) byProf[s.profissional_id] = { nome, total: 0, hours: 0 };
          byProf[s.profissional_id].total += Number(s.valor_total);
          byProf[s.profissional_id].hours += Number(s.carga_horaria);
        });
        return { columns: ['Profissional', 'Horas Trabalhadas', 'Total a Receber'], rows: Object.values(byProf).map(p => [p.nome, `${p.hours.toFixed(1)}h`, `R$ ${p.total.toLocaleString('pt-BR')}`]) };
      }
      case 'trocas':
        return { columns: ['Solicitante', 'Destinatário', 'Motivo', 'Status', 'Data'], rows: swaps.map((s: any) => [(s.solicitante as any)?.nome || '', (s.destinatario as any)?.nome || 'Grupo', s.motivo, s.status, new Date(s.created_at).toLocaleDateString('pt-BR')]) };
      case 'cancelados':
        return { columns: ['Profissional', 'Setor', 'Data', 'Horário', 'Valor'], rows: shifts.filter((s: any) => s.status === 'cancelado').map((s: any) => [(s.professionals as any)?.nome || '', (s.sectors as any)?.nome || '', new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), `${s.hora_inicio}-${s.hora_fim}`, `R$ ${Number(s.valor_total).toLocaleString('pt-BR')}`]) };
      case 'setores': {
        const bySetor: Record<string, { nome: string; count: number; cost: number }> = {};
        shifts.forEach((s: any) => {
          const nome = (s.sectors as any)?.nome || 'Desconhecido';
          if (!bySetor[s.setor_id]) bySetor[s.setor_id] = { nome, count: 0, cost: 0 };
          bySetor[s.setor_id].count++;
          bySetor[s.setor_id].cost += Number(s.valor_total);
        });
        return { columns: ['Setor', 'Qtd. Plantões', 'Custo Total'], rows: Object.values(bySetor).map(s => [s.nome, String(s.count), `R$ ${s.cost.toLocaleString('pt-BR')}`]) };
      }
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

  return (
    <div className="space-y-6">
      <div><h1 className="module-title">Relatórios</h1><p className="text-muted-foreground text-sm mt-1">Gere e exporte relatórios gerenciais com dados reais</p></div>
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
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
