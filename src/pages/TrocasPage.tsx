import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { useAuth } from "@/hooks/useAuth";
import { SWAP_STATUS_LABELS } from "@/types/hospital";
import type { SwapStatus } from "@/types/hospital";
import { ArrowLeftRight, Clock, CheckCircle2, XCircle, AlertCircle, Plus, Zap, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ComprovanteTroca from "@/components/ComprovanteTroca";

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
  const { isMaster } = useAuth();
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({
    profA: '', shiftA: '', profB: '', shiftB: '', motivo: '',
  });

  const { data: swaps = [], isLoading, refetch: refetchSwaps } = useQuery({
    queryKey: ['swaps'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_swaps')
        .select('*, solicitante:solicitante_id(nome), destinatario:destinatario_id(nome), shifts:shift_id(data, hora_inicio, hora_fim, sectors:setor_id(nome))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for shift_swaps
  useEffect(() => {
    const channel = supabase
      .channel('swaps-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swaps' }, () => {
        refetchSwaps();
        qc.invalidateQueries({ queryKey: ['swap-histories'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchSwaps, qc]);

  const { data: swapHistories = [] } = useQuery({
    queryKey: ['swap-histories'],
    queryFn: async () => {
      const { data } = await supabase.from('swap_history').select('*').order('created_at', { ascending: true });
      return data || [];
    },
  });

  // Data for admin modal
  const { data: professionals = [] } = useQuery({
    queryKey: ['swap-professionals'],
    enabled: isMaster,
    queryFn: async () => {
      const { data } = await supabase.from('professionals').select('id, nome').eq('status', 'ativo').order('nome');
      return data || [];
    },
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['swap-all-shifts'],
    enabled: isMaster,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('shifts')
        .select('id, data, hora_inicio, hora_fim, profissional_id, status, sectors:setor_id(nome)')
        .gte('data', today)
        .neq('status', 'cancelado')
        .order('data');
      return data || [];
    },
  });

  const shiftsForA = useMemo(() => adminForm.profA ? allShifts.filter((s: any) => s.profissional_id === adminForm.profA) : [], [allShifts, adminForm.profA]);
  const shiftsForB = useMemo(() => adminForm.profB ? allShifts.filter((s: any) => s.profissional_id === adminForm.profB) : [], [allShifts, adminForm.profB]);

  const updateSwap = useMutation({
    mutationFn: async ({ id, status, motivo }: { id: string; status: string; motivo?: string }) => {
      const updatePayload: Record<string, any> = { status: status as any, observacao_gestor: motivo || null };
      if (status === 'aprovada') updatePayload.aprovado_em = new Date().toISOString();
      if (status === 'rejeitada') {
        updatePayload.rejeitado_em = new Date().toISOString();
        updatePayload.observacao_rejeicao = motivo || null;
      }
      const { error } = await supabase.from('shift_swaps').update(updatePayload as any).eq('id', id);
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('swap_history').insert({
        swap_id: id,
        acao: status === 'aprovada' ? 'Aprovada pelo gestor' : status === 'rejeitada' ? 'Rejeitada pelo gestor' : `Status alterado para ${status}`,
        usuario: user?.email || 'Gestor',
        user_id: user?.id,
      });
      await logAudit(`Troca ${status}`, 'trocas', { swap_id: id, novo_status: status });
      const swap = swaps.find((s: any) => s.id === id);
      if (swap) {
        const statusLabel = status === 'aprovada' ? 'aprovada' : 'rejeitada';
        await dispatchNotification({ professionalId: swap.solicitante_id, tipo: 'troca', titulo: `Troca ${statusLabel}`, mensagem: `Sua solicitação de troca foi ${statusLabel} pelo gestor.` });
        if (swap.destinatario_id) {
          await dispatchNotification({ professionalId: swap.destinatario_id, tipo: 'troca', titulo: `Troca ${statusLabel}`, mensagem: `A troca de plantão envolvendo você foi ${statusLabel}.` });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swaps'] }); qc.invalidateQueries({ queryKey: ['swap-histories'] }); toast.success('Troca atualizada!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const adminSwapMutation = useMutation({
    mutationFn: async () => {
      const { profA, shiftA, profB, shiftB, motivo } = adminForm;
      if (!profA || !shiftA || !profB || !shiftB) throw new Error('Selecione profissionais e plantões.');
      if (profA === profB) throw new Error('Os profissionais devem ser diferentes.');
      if (motivo.trim().length < 10) throw new Error('Motivo deve ter no mínimo 10 caracteres.');

      // Check conflicts: profB taking shiftA
      const shiftAData = allShifts.find((s: any) => s.id === shiftA);
      const shiftBData = allShifts.find((s: any) => s.id === shiftB);
      if (!shiftAData || !shiftBData) throw new Error('Plantões não encontrados.');

      const { data: conflictA } = await supabase.rpc('check_shift_conflict', {
        p_profissional_id: profB, p_data: shiftAData.data,
        p_hora_inicio: shiftAData.hora_inicio, p_hora_fim: shiftAData.hora_fim, p_exclude_id: shiftB,
      });
      if (conflictA && conflictA.length > 0) throw new Error(`Conflito: Prof. B já tem plantão das ${conflictA[0].conflicting_start} às ${conflictA[0].conflicting_end} nesta data.`);

      const { data: conflictB } = await supabase.rpc('check_shift_conflict', {
        p_profissional_id: profA, p_data: shiftBData.data,
        p_hora_inicio: shiftBData.hora_inicio, p_hora_fim: shiftBData.hora_fim, p_exclude_id: shiftA,
      });
      if (conflictB && conflictB.length > 0) throw new Error(`Conflito: Prof. A já tem plantão das ${conflictB[0].conflicting_start} às ${conflictB[0].conflicting_end} nesta data.`);

      // Create swap record with both shift IDs
      const { data: swap, error: swapErr } = await supabase.from('shift_swaps').insert({
        shift_id: shiftA,
        shift_id_destino: shiftB,
        solicitante_id: profA,
        destinatario_id: profB,
        motivo: `[ADMINISTRATIVA] ${motivo.trim()}`,
        tipo: 'administrativa',
        status: 'concluida' as any,
        observacao_gestor: `Troca administrativa direta. Plantões: ${shiftA} ↔ ${shiftB}`,
        motivo_administrativo: motivo.trim(),
        bypass_aprovacao: true,
      } as any).select('id').single();
      if (swapErr) throw swapErr;

      // Swap professionals on both shifts
      const { error: e1 } = await supabase.from('shifts').update({ profissional_id: profB }).eq('id', shiftA);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('shifts').update({ profissional_id: profA }).eq('id', shiftB);
      if (e2) throw e2;

      // Record history
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('swap_history').insert([
        { swap_id: swap.id, acao: 'Troca administrativa criada', usuario: user?.email || 'Gestor Master', user_id: user?.id, detalhes: `Motivo: ${motivo.trim()}` },
        { swap_id: swap.id, acao: 'Aprovação automática — Gestor Master', usuario: user?.email || 'Gestor Master', user_id: user?.id },
      ]);

      await logAudit('Troca administrativa', 'trocas', { swap_id: swap.id, profA, profB, shiftA, shiftB });

      // Notify both professionals
      const profAName = professionals.find((p: any) => p.id === profA)?.nome || '';
      const profBName = professionals.find((p: any) => p.id === profB)?.nome || '';
      await dispatchNotification({ professionalId: profA, tipo: 'troca', titulo: '⚠️ Troca administrativa realizada', mensagem: `O Gestor Master trocou seu plantão com ${profBName}. Motivo: ${motivo.trim()}` });
      await dispatchNotification({ professionalId: profB, tipo: 'troca', titulo: '⚠️ Troca administrativa realizada', mensagem: `O Gestor Master trocou seu plantão com ${profAName}. Motivo: ${motivo.trim()}` });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['swaps'] });
      qc.invalidateQueries({ queryKey: ['swap-histories'] });
      qc.invalidateQueries({ queryKey: ['swap-all-shifts'] });
      toast.success('Troca administrativa confirmada!');
      setAdminModalOpen(false);
      setAdminForm({ profA: '', shiftA: '', profB: '', shiftB: '', motivo: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingStatuses = ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao', 'aceita'];
  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  const formatShiftLabel = (s: any) =>
    `${new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')} • ${s.hora_inicio}-${s.hora_fim} • ${(s.sectors as any)?.nome || ''}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Trocas de Plantão</h1>
          <p className="text-muted-foreground text-sm mt-1">{swaps.length} trocas registradas</p>
        </div>
        {isMaster && (
          <button onClick={() => setAdminModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Nova Troca Administrativa
          </button>
        )}
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
            const isAdmin = swap.tipo === 'administrativa';
            const style = statusStyles[swap.status as SwapStatus] || statusStyles.solicitada;
            const Icon = style.icon;
            const history = swapHistories.filter((h: any) => h.swap_id === swap.id);
            return (
              <motion.div key={swap.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg ${isAdmin ? 'bg-[hsl(var(--chart-4))]/10' : 'bg-primary/10'}`}>
                      {isAdmin ? <Zap className="h-5 w-5 text-[hsl(var(--chart-4))]" /> : <ArrowLeftRight className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && (
                          <span className="status-badge bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]">
                            <Zap className="h-3 w-3 mr-1" />Administrativa
                          </span>
                        )}
                        <span className="font-medium text-foreground">{isAdmin ? 'Gestor Master' : (swap.solicitante as any)?.nome || '—'}</span>
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

      {/* Admin Swap Modal */}
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-[hsl(var(--chart-4))]" /> Troca Administrativa
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Gestor Master · Sem necessidade de aprovação</p>
          </DialogHeader>

          <form onSubmit={e => { e.preventDefault(); adminSwapMutation.mutate(); }} className="space-y-5">
            {/* Professional A */}
            <fieldset className="space-y-2 rounded-lg border border-border p-4">
              <legend className="text-xs font-semibold text-foreground px-2">PROFISSIONAL A</legend>
              <select required value={adminForm.profA} onChange={e => setAdminForm(f => ({ ...f, profA: e.target.value, shiftA: '' }))} className={inputClass}>
                <option value="">Selecione profissional...</option>
                {professionals.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <select required value={adminForm.shiftA} onChange={e => setAdminForm(f => ({ ...f, shiftA: e.target.value }))} className={inputClass} disabled={!adminForm.profA}>
                <option value="">Selecione plantão...</option>
                {shiftsForA.map((s: any) => <option key={s.id} value={s.id}>{formatShiftLabel(s)}</option>)}
              </select>
              {adminForm.profA && shiftsForA.length === 0 && <p className="text-xs text-muted-foreground">Nenhum plantão futuro encontrado.</p>}
            </fieldset>

            <div className="flex justify-center"><ArrowLeftRight className="h-5 w-5 text-muted-foreground" /></div>

            {/* Professional B */}
            <fieldset className="space-y-2 rounded-lg border border-border p-4">
              <legend className="text-xs font-semibold text-foreground px-2">PROFISSIONAL B</legend>
              <select required value={adminForm.profB} onChange={e => setAdminForm(f => ({ ...f, profB: e.target.value, shiftB: '' }))} className={inputClass}>
                <option value="">Selecione profissional...</option>
                {professionals.filter((p: any) => p.id !== adminForm.profA).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <select required value={adminForm.shiftB} onChange={e => setAdminForm(f => ({ ...f, shiftB: e.target.value }))} className={inputClass} disabled={!adminForm.profB}>
                <option value="">Selecione plantão...</option>
                {shiftsForB.map((s: any) => <option key={s.id} value={s.id}>{formatShiftLabel(s)}</option>)}
              </select>
              {adminForm.profB && shiftsForB.length === 0 && <p className="text-xs text-muted-foreground">Nenhum plantão futuro encontrado.</p>}
            </fieldset>

            <div>
              <label className="text-sm font-medium text-foreground">Motivo administrativo *</label>
              <textarea required minLength={10} value={adminForm.motivo} onChange={e => setAdminForm(f => ({ ...f, motivo: e.target.value }))} rows={3} placeholder="Descreva o motivo da troca (mín. 10 caracteres)" className={inputClass} />
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="text-xs text-warning font-medium">⚠️ Esta troca será confirmada imediatamente sem aprovação adicional. Os profissionais dos plantões serão trocados no ato.</p>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setAdminModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={adminSwapMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {adminSwapMutation.isPending ? 'Processando...' : '✅ Confirmar Troca'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
