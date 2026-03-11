import { Bell, Mail, CheckCircle2, Clock, AlertTriangle, Info } from "lucide-react";
import { motion } from "framer-motion";

const notifications = [
  { id: 'n1', tipo: 'plantao', titulo: 'Novo plantão criado', descricao: 'Plantão na UTI Adulto atribuído a Dr. Carlos Mendes', lido: false, dataHora: new Date(Date.now() - 1800000).toISOString(), icon: 'info' as const },
  { id: 'n2', tipo: 'troca', titulo: 'Troca solicitada', descricao: 'Enf. Maria Santos solicitou troca de plantão noturno', lido: false, dataHora: new Date(Date.now() - 3600000).toISOString(), icon: 'warning' as const },
  { id: 'n3', tipo: 'troca', titulo: 'Troca aprovada', descricao: 'Troca de Ft. Juliana Costa foi aprovada com sucesso', lido: true, dataHora: new Date(Date.now() - 86400000).toISOString(), icon: 'success' as const },
  { id: 'n4', tipo: 'conflito', titulo: 'Conflito detectado', descricao: 'Sobreposição de horário detectada para Dr. Roberto Almeida', lido: false, dataHora: new Date(Date.now() - 7200000).toISOString(), icon: 'danger' as const },
  { id: 'n5', tipo: 'lembrete', titulo: 'Lembrete de plantão', descricao: 'Plantão amanhã às 07:00 - Pediatria', lido: true, dataHora: new Date(Date.now() - 43200000).toISOString(), icon: 'info' as const },
];

const iconMap = {
  info: { icon: Info, class: 'bg-info/10 text-info' },
  success: { icon: CheckCircle2, class: 'bg-success/10 text-success' },
  warning: { icon: Clock, class: 'bg-warning/10 text-warning' },
  danger: { icon: AlertTriangle, class: 'bg-destructive/10 text-destructive' },
};

export default function NotificacoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="module-title">Notificações</h1>
          <p className="text-muted-foreground text-sm mt-1">{notifications.filter(n => !n.lido).length} não lidas</p>
        </div>
        <button className="text-sm text-primary hover:underline font-medium">Marcar todas como lidas</button>
      </div>

      <div className="space-y-3">
        {notifications.map((n, i) => {
          const { icon: Icon, class: cls } = iconMap[n.icon];
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className={`bg-card rounded-lg border p-4 shadow-[var(--shadow-card)] transition-all cursor-pointer hover:shadow-[var(--shadow-elevated)] ${n.lido ? 'border-border' : 'border-primary/30 bg-primary/[0.02]'}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${cls}`}><Icon className="h-4 w-4" /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium ${n.lido ? 'text-foreground' : 'text-foreground font-semibold'}`}>{n.titulo}</h3>
                    {!n.lido && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.descricao}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.dataHora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
