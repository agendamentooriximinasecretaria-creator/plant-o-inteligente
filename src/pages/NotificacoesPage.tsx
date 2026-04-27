import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Bell, CheckCircle2, Clock, AlertTriangle, Info, Calendar as CalIcon, ArrowLeftRight, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { CardListSkeleton } from "@/components/PageSkeleton";

const iconMap: Record<string, { icon: typeof Info; class: string; label: string }> = {
  plantao:    { icon: CalIcon, class: 'bg-info/10 text-info', label: 'Plantão' },
  troca:      { icon: ArrowLeftRight, class: 'bg-warning/10 text-warning', label: 'Troca' },
  conflito:   { icon: AlertTriangle, class: 'bg-destructive/10 text-destructive', label: 'Crítico' },
  lembrete:   { icon: Bell, class: 'bg-primary/10 text-primary', label: 'Lembrete' },
  escala:     { icon: Activity, class: 'bg-accent/10 text-accent', label: 'Escala' },
  cobertura:  { icon: AlertTriangle, class: 'bg-destructive/10 text-destructive', label: 'Cobertura' },
  sistema:    { icon: CheckCircle2, class: 'bg-success/10 text-success', label: 'Sistema' },
};

type FilterTipo = 'todas' | 'plantao' | 'troca' | 'conflito' | 'lembrete' | 'escala' | 'cobertura' | 'sistema' | 'nao_lidas';

export default function NotificacoesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterTipo>('todas');

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase.channel('notificacoes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      const naoLidas = (notifications as any[]).filter((n: any) => !n.lida).length;
      const { error } = await supabase.from('notifications').update({ lida: true }).eq('lida', false);
      if (error) throw error;
      await logAudit('Marcou todas notificações como lidas', 'notificacoes', { quantidade: naoLidas });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread-notifications-count'] }); toast.success('Todas marcadas como lidas'); },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const notif = (notifications as any[]).find((n: any) => n.id === id);
      const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', id);
      if (error) throw error;
      await logAudit('Notificação marcada como lida', 'notificacoes', { notificacao_id: id, tipo: notif?.tipo, titulo: notif?.titulo });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['unread-notifications-count'] }); },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: notifications.length, nao_lidas: 0 };
    for (const n of notifications as any[]) {
      if (!n.lida) c.nao_lidas++;
      c[n.tipo] = (c[n.tipo] || 0) + 1;
    }
    return c;
  }, [notifications]);

  const filtered = useMemo(() => {
    if (filter === 'todas') return notifications;
    if (filter === 'nao_lidas') return (notifications as any[]).filter(n => !n.lida);
    return (notifications as any[]).filter(n => n.tipo === filter);
  }, [notifications, filter]);

  const unreadCount = counts.nao_lidas || 0;

  const filterChips: { key: FilterTipo; label: string; color?: string }[] = [
    { key: 'todas', label: 'Todas' },
    { key: 'nao_lidas', label: 'Não lidas', color: 'text-primary' },
    { key: 'plantao', label: 'Plantão' },
    { key: 'troca', label: 'Trocas' },
    { key: 'escala', label: 'Escala' },
    { key: 'cobertura', label: 'Cobertura' },
    { key: 'conflito', label: 'Críticas', color: 'text-destructive' },
    { key: 'lembrete', label: 'Lembretes' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="module-title">Notificações</h1>
          <p className="text-muted-foreground text-sm mt-1">{unreadCount} não lidas · {notifications.length} total</p>
        </div>
        <button onClick={() => { if (!markAllRead.isPending && unreadCount > 0) markAllRead.mutate(); }} disabled={unreadCount === 0 || markAllRead.isPending} className="text-sm text-primary hover:underline font-medium disabled:opacity-50">
          {markAllRead.isPending ? 'Marcando...' : 'Marcar todas como lidas'}
        </button>
      </div>

      {/* Chips de filtro */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map(chip => {
          const count = counts[chip.key] ?? 0;
          const active = filter === chip.key;
          return (
            <button key={chip.key} onClick={() => setFilter(chip.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
              }`}>
              <span className={!active && chip.color ? chip.color : ''}>{chip.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhuma notificação {filter !== 'todas' ? 'neste filtro' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(filtered as any[]).map((n: any, i: number) => {
            const mapping = iconMap[n.tipo] || iconMap.sistema;
            const Icon = mapping.icon;
            return (
              <motion.div key={n.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.02 }}
                onClick={() => !n.lida && markRead.mutate(n.id)}
                className={`bg-card rounded-xl border p-4 shadow-[var(--shadow-card)] transition-all cursor-pointer hover:shadow-[var(--shadow-elevated)] ${n.lida ? 'border-border' : 'border-primary/30 bg-primary/[0.02]'}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${mapping.class}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-sm truncate ${n.lida ? 'text-foreground font-medium' : 'text-foreground font-semibold'}`}>{n.titulo}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${mapping.class}`}>{mapping.label}</span>
                        {!n.lida && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.mensagem}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
