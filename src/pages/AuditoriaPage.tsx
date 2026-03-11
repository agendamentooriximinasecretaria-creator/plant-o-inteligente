import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";

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

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', filterModulo],
    queryFn: async () => {
      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (filterModulo) q = q.eq('modulo', filterModulo);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Auditoria e Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">{logs.length} registros encontrados</p>
      </div>

      <div className="flex gap-3">
        <select value={filterModulo} onChange={e => setFilterModulo(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">Todos os módulos</option>
          {['escala', 'trocas', 'profissionais', 'configuracoes', 'relatorios', 'setores', 'sistema'].map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
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
                {logs.map((log: any, i: number) => (
                  <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-medium text-foreground">{log.usuario_nome || 'Sistema'}</td>
                    <td className="p-3 text-foreground">{log.acao}</td>
                    <td className="p-3"><span className={`status-badge text-[10px] ${moduleColors[log.modulo] || 'bg-muted text-muted-foreground'}`}>{log.modulo}</span></td>
                    <td className="p-3"><span className={`status-badge text-[10px] ${log.status === 'sucesso' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{log.status}</span></td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">{log.detalhes ? JSON.stringify(log.detalhes) : '—'}</td>
                  </motion.tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum log registrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
