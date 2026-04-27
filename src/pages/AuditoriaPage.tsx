import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { exportToCSV } from "@/lib/exportUtils";
import { toast } from "sonner";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

const actionColors: Record<string, string> = {
  criado: 'bg-success/10 text-success',
  criada: 'bg-success/10 text-success',
  editado: 'bg-warning/10 text-warning',
  editada: 'bg-warning/10 text-warning',
  atualizado: 'bg-warning/10 text-warning',
  excluído: 'bg-destructive/10 text-destructive',
  cancelado: 'bg-destructive/10 text-destructive',
  aprovada: 'bg-info/10 text-info',
  aprovado: 'bg-info/10 text-info',
  rejeitada: 'bg-destructive/10 text-destructive',
  administrativa: 'bg-accent/10 text-accent',
  exportado: 'bg-primary/10 text-primary',
};

function getActionBadgeClass(acao: string): string {
  const lower = acao.toLowerCase();
  for (const [key, cls] of Object.entries(actionColors)) {
    if (lower.includes(key)) return cls;
  }
  return 'bg-muted text-muted-foreground';
}

const moduleColors: Record<string, string> = {
  escala: 'bg-primary/10 text-primary',
  trocas: 'bg-warning/10 text-warning',
  sistema: 'bg-muted text-muted-foreground',
  profissionais: 'bg-info/10 text-info',
  configuracoes: 'bg-accent/10 text-accent',
  relatorios: 'bg-success/10 text-success',
  setores: 'bg-primary/10 text-primary',
  notificacoes: 'bg-warning/10 text-warning',
};

export default function AuditoriaPage() {
  const [filterModulo, setFilterModulo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useRealtimeInvalidation({
    tables: ["audit_logs"],
    invalidate: ["audit-logs*"],
    debounceMs: 600,
    channelId: "auditoria-realtime",
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', filterModulo],
    queryFn: async () => {
      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      if (filterModulo) q = q.eq('modulo', filterModulo);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return logs.filter((log: any) => {
      if (searchText) {
        const s = searchText.toLowerCase();
        const match = (log.acao || '').toLowerCase().includes(s) ||
          (log.usuario_nome || '').toLowerCase().includes(s) ||
          JSON.stringify(log.detalhes || '').toLowerCase().includes(s);
        if (!match) return false;
      }
      if (dateFrom) {
        if (new Date(log.created_at) < new Date(dateFrom + 'T00:00:00')) return false;
      }
      if (dateTo) {
        if (new Date(log.created_at) > new Date(dateTo + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [logs, searchText, dateFrom, dateTo]);

  const handleExportCSV = () => {
    if (filtered.length === 0) { toast.warning('Nenhum dado para exportar.'); return; }
    const columns = ['Data/Hora', 'Usuário', 'Ação', 'Módulo', 'Status', 'Detalhes'];
    const rows = filtered.map((log: any) => [
      new Date(log.created_at).toLocaleString('pt-BR'),
      log.usuario_nome || 'Sistema',
      log.acao,
      log.modulo,
      log.status,
      log.detalhes ? JSON.stringify(log.detalhes) : '',
    ]);
    exportToCSV(columns, rows, `auditoria_${new Date().toISOString().slice(0, 10)}`);
    toast.success('Log exportado em CSV!');
  };

  const inputClass = "bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Auditoria e Logs</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} registros encontrados</p>
        </div>
        <button onClick={handleExportCSV} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filterModulo} onChange={e => setFilterModulo(e.target.value)} className={inputClass}>
          <option value="">Todos os módulos</option>
          {['escala', 'trocas', 'profissionais', 'configuracoes', 'relatorios', 'setores', 'sistema', 'notificacoes'].map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar ação, usuário..." value={searchText} onChange={e => setSearchText(e.target.value)} className={`${inputClass} pl-9 w-56`} />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} title="Data inicial" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} title="Data final" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="text-left p-3">Data/Hora</th>
                <th className="text-left p-3">Usuário</th>
                <th className="text-left p-3">Ação</th>
                <th className="text-left p-3">Módulo</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Detalhes</th>
              </tr></thead>
              <tbody>
                {filtered.map((log: any, i: number) => (
                  <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                    className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-medium text-foreground">{log.usuario_nome || 'Sistema'}</td>
                    <td className="p-3">
                      <span className={`status-badge text-[10px] ${getActionBadgeClass(log.acao)}`}>{log.acao}</span>
                    </td>
                    <td className="p-3"><span className={`status-badge text-[10px] ${moduleColors[log.modulo] || 'bg-muted text-muted-foreground'}`}>{log.modulo}</span></td>
                    <td className="p-3"><span className={`status-badge text-[10px] ${log.status === 'sucesso' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{log.status}</span></td>
                    <td className="p-3">
                      {log.detalhes ? (
                        <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                          {expandedId === log.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {expandedId === log.id ? 'Recolher' : 'Ver detalhes'}
                        </button>
                      ) : <span className="text-muted-foreground">—</span>}
                      {expandedId === log.id && log.detalhes && (
                        <pre className="mt-2 p-2 bg-muted rounded text-[11px] text-foreground overflow-x-auto max-w-xs whitespace-pre-wrap">
                          {JSON.stringify(log.detalhes, null, 2)}
                        </pre>
                      )}
                    </td>
                  </motion.tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum log encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
