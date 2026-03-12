import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { SWAP_STATUS_LABELS } from "@/types/hospital";
import type { SwapStatus } from "@/types/hospital";
import { ArrowLeftRight, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const statusStyles: Record<SwapStatus, { class: string; icon: typeof Clock }> = {
  solicitada: { class: 'bg-info/10 text-info', icon: Clock },
  aguardando_resposta: { class: 'bg-warning/10 text-warning', icon: Clock },
  aceita: { class: 'bg-success/10 text-success', icon: CheckCircle2 },
  recusada: { class: 'bg-destructive/10 text-destructive', icon: XCircle },
  aguardando_aprovacao: { class: 'bg-warning/10 text-warning', icon: AlertCircle },
  aprovada: { class: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejeitada: { class: 'bg-destructive/10 text-destructive', icon: XCircle },
  cancelada: { class: 'bg-muted text-muted-foreground', icon: XCircle },
  concluida: { class: 'bg-accent/10 text-accent', icon: CheckCircle2 },
};

export default function TrocasPage() {
  const qc = useQueryClient();

  const { data: swaps = [], isLoading } = useQuery({
    queryKey: ['swaps'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_swaps')
        .select('*, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome), shifts:shift_id(data, hora_inicio, hora_fim, sectors:setor_id(nome))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: swapHistories = [] } = useQuery({
    queryKey: ['swap-histories'],
    queryFn: async () => {
      const { data } = await supabase.from('swap_history').select('*').order('created_at', { ascending: true });
      return data || [];
    },
  });

  const updateSwap = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: string; motivo?: string }) => {
      const { error } = await supabase.from('shift_swaps').update({ status: status as any, observacao_gestor: motivo || null }).eq('id', id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('swap_history').insert({
        swap_id: id,
        acao: status === 'aprovada' ? 'Aprovada pelo gestor' : status === 'rejeitada' ? 'Rejeitada pelo gestor' : `Status alterado para ${status}`,
        usuario: user?.email || 'Gestor',
        user_id: user?.id,
      });
      await logAudit(`Troca ${status}`, 'trocas', { swap_id: id, novo_status: status });
      // Notify involved professionals
      const swap = swaps.find((s: any) => s.id === id);
      if (swap) {
        const statusLabel = status === 'aprovada' ? 'aprovada' : 'rejeitada';
        await dispatchNotification({
          professionalId: swap.solicitante_id,
          tipo: 'troca',
          titulo: `Troca ${statusLabel}`,
          mensagem: `Sua solicitação de troca foi ${statusLabel} pelo gestor.`,
        });
        if (swap.destinatario_id) {
          await dispatchNotification({
            professionalId: swap.destinatario_id,
            tipo: 'troca',
            titulo: `Troca ${statusLabel}`,
            mensagem: `A troca de plantão envolvendo você foi ${statusLabel}.`,
          });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }); qc.invalidateQueries({ queryKey: ['swap-histories'] }); toast.success('Troca atualizada!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const pendingStatuses = ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Trocas de Plantão</h1>
        <p className="text-muted-foreground text-sm mt-1">{swaps.length} trocas registradas</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: swaps.length, color: 'text-primary bg-primary/10' },
          { label: 'Aguardando', value: swaps.filter((s: any) => pendingStatuses.includes(s.status)).length, color: 'text-warning bg-warning/10' },
          { label: 'Aprovadas', value: swaps.filter((s: any) => s.status === 'aprovada' || s.status === 'concluida').length, color: 'text-success bg-success/10' },
          { label: 'Recusadas', value: swaps.filter((s: any) => s.status === 'recusada' || s.status === 'rejeitada').length, color: 'text-destructive bg-destructive/10' },
        ].map(k => (
          <div key={k.label} className="kpi-card"><p className="kpi-label">{k.label}</p><p className="kpi-value mt-1">{k.value}</p></div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : swaps.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhuma troca registrada.</p>
      ) : (
        <div className="space-y-4">
          {swaps.map((swap: any, i: number) => {
            const style = statusStyles[swap.status as SwapStatus] || statusStyles.solicitada;
            const Icon = style.icon;
            const history = swapHistories.filter((h: any) => h.swap_id === swap.id);
            return (
              <motion.div key={swap.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10"><ArrowLeftRight className="h-5 w-5 text-primary" /></div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{(swap.solicitante as any)?.nome || '—'}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">{(swap.destinatario as any)?.nome || 'Grupo'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{swap.motivo}</p>
                      {swap.shifts && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Plantão: {new Date((swap.shifts as any).data + 'T12:00:00').toLocaleDateString('pt-BR')} • {(swap.shifts as any).hora_inicio}-{(swap.shifts as any).hora_fim} • {((swap.shifts as any).sectors as any)?.nome || ''}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Criado em {new Date(swap.created_at).toLocaleString('pt-BR')}</p>
                      {swap.observacao_gestor && <p className="text-xs text-muted-foreground mt-1 italic">Obs. gestor: {swap.observacao_gestor}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`status-badge ${style.class}`}>
                      <Icon className="h-3.5 w-3.5 mr-1" />{SWAP_STATUS_LABELS[swap.status as SwapStatus] || swap.status}
                    </span>
                    {pendingStatuses.includes(swap.status) && (
                      <div className="flex gap-2">
                        <button onClick={() => updateSwap.mutate({ id: swap.id, status: 'aprovada' })} disabled={updateSwap.isPending}
                          className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50">Aprovar</button>
                        <button onClick={() => updateSwap.mutate({ id: swap.id, status: 'rejeitada' })} disabled={updateSwap.isPending}
                          className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50">Rejeitar</button>
                      </div>
                    )}
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico</p>
                    <div className="space-y-2">
                      {history.map((h: any) => (
                        <div key={h.id} className="flex items-start gap-2 text-xs">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div>
                            <span className="text-foreground font-medium">{h.acao}</span>
                            <span className="text-muted-foreground"> por {h.usuario}</span>
                            {h.detalhes && <span className="text-muted-foreground"> — {h.detalhes}</span>}
                            <span className="text-muted-foreground block">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
