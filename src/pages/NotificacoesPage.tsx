import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CheckCircle2, Clock, AlertTriangle, Info } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const iconMap: Record<string, { icon: typeof Info; class: string }> = {
  plantao: { icon: Info, class: 'bg-info/10 text-info' },
  troca: { icon: Clock, class: 'bg-warning/10 text-warning' },
  conflito: { icon: AlertTriangle, class: 'bg-destructive/10 text-destructive' },
  lembrete: { icon: Bell, class: 'bg-primary/10 text-primary' },
  sistema: { icon: CheckCircle2, class: 'bg-success/10 text-success' },
};

export default function NotificacoesPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notifications').update({ lida: true }).eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); toast.success('Todas marcadas como lidas'); },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n: any) => !n.lida).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="module-title">Notificações</h1>
          <p className="text-muted-foreground text-sm mt-1">{unreadCount} não lidas</p>
        </div>
        <button onClick={() => markAllRead.mutate()} disabled={unreadCount === 0} className="text-sm text-primary hover:underline font-medium disabled:opacity-50">Marcar todas como lidas</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : notifications.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhuma notificação.</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((n: any, i: number) => {
            const mapping = iconMap[n.tipo] || iconMap.sistema;
            const Icon = mapping.icon;
            return (
              <motion.div key={n.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => !n.lida && markRead.mutate(n.id)}
                className={`bg-card rounded-lg border p-4 shadow-[var(--shadow-card)] transition-all cursor-pointer hover:shadow-[var(--shadow-elevated)] ${n.lida ? 'border-border' : 'border-primary/30 bg-primary/[0.02]'}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${mapping.class}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-medium ${n.lida ? 'text-foreground' : 'text-foreground font-semibold'}`}>{n.titulo}</h3>
                      {!n.lida && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.mensagem}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {n.status_envio && <span className="ml-2">• {n.status_envio}</span>}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
