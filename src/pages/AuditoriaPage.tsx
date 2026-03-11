import { Shield, User, Clock, Filter } from "lucide-react";
import { motion } from "framer-motion";

const logs = [
  { id: 'l1', usuario: 'Gestor Master', acao: 'Criou plantão', modulo: 'Escala', detalhes: 'Plantão UTI Adulto - Dr. Carlos Mendes', dataHora: new Date(Date.now() - 1800000).toISOString() },
  { id: 'l2', usuario: 'Enf. Maria Santos', acao: 'Solicitou troca', modulo: 'Trocas', detalhes: 'Troca de plantão noturno com Enf. Lucas Rodrigues', dataHora: new Date(Date.now() - 3600000).toISOString() },
  { id: 'l3', usuario: 'Gestor Master', acao: 'Aprovou troca', modulo: 'Trocas', detalhes: 'Troca de Ft. Juliana Costa aprovada', dataHora: new Date(Date.now() - 86400000).toISOString() },
  { id: 'l4', usuario: 'Dr. Roberto Almeida', acao: 'Recusou troca', modulo: 'Trocas', detalhes: 'Recusou troca com Dr. Carlos Mendes', dataHora: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'l5', usuario: 'Gestor Master', acao: 'Cancelou plantão', modulo: 'Escala', detalhes: 'Plantão cancelado UTI Adulto - Enf. Maria Santos', dataHora: new Date(Date.now() - 86400000).toISOString() },
  { id: 'l6', usuario: 'Gestor Master', acao: 'Login', modulo: 'Sistema', detalhes: 'Acesso ao sistema', dataHora: new Date(Date.now() - 600000).toISOString() },
  { id: 'l7', usuario: 'Sistema', acao: 'Notificação enviada', modulo: 'Notificações', detalhes: 'E-mail enviado para Enf. Maria Santos', dataHora: new Date(Date.now() - 3600000).toISOString() },
  { id: 'l8', usuario: 'Gestor Master', acao: 'Exportou relatório', modulo: 'Relatórios', detalhes: 'Relatório financeiro exportado em PDF', dataHora: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const moduleColors: Record<string, string> = {
  'Escala': 'bg-primary/10 text-primary',
  'Trocas': 'bg-warning/10 text-warning',
  'Sistema': 'bg-muted text-muted-foreground',
  'Notificações': 'bg-info/10 text-info',
  'Relatórios': 'bg-accent/10 text-accent',
};

export default function AuditoriaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Auditoria e Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Registro completo de ações do sistema</p>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="table-header">
              <th className="text-left p-3">Data/Hora</th>
              <th className="text-left p-3">Usuário</th>
              <th className="text-left p-3">Ação</th>
              <th className="text-left p-3">Módulo</th>
              <th className="text-left p-3">Detalhes</th>
            </tr></thead>
            <tbody>
              {logs.map((log, i) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date(log.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 font-medium text-foreground">{log.usuario}</td>
                  <td className="p-3 text-foreground">{log.acao}</td>
                  <td className="p-3"><span className={`status-badge text-[10px] ${moduleColors[log.modulo] || 'bg-muted text-muted-foreground'}`}>{log.modulo}</span></td>
                  <td className="p-3 text-muted-foreground max-w-xs truncate">{log.detalhes}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
