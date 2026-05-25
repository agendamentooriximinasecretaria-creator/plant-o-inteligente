import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { dispatchNotification } from "@/lib/notifyHelper";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calcularHorasMes } from "@/lib/horas";

export default function MinhaEscalaPage() {
  const qc = useQueryClient();
  const { professionalId } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [swapModal, setSwapModal] = useState<any>(null);
  const [swapForm, setSwapForm] = useState({ tipo: 'grupo', destinatario_id: '', motivo: '' });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["professional-my-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, hora_inicio, hora_fim, tipo_plantao, carga_horaria, status, sectors:setor_id(nome), units:unidade_id(nome)")
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: directory = [] } = useQuery({
    queryKey: ["swap-directory"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("list_professional_directory");
      return (data || []).filter((p: any) => p.id !== professionalId);
    },
    enabled: !!professionalId,
  });

  const monthHours = useMemo(() => {
    return calcularHorasMes(shifts as any[], undefined, today.substring(0, 7));
  }, [shifts, today]);

  // Calendar data
  const now = new Date();
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calYear, setCalYear] = useState(now.getFullYear());

  const calDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, i) => {
      const day = i - firstDay + 1;
      const isValid = day >= 1 && day <= daysInMonth;
      const dateStr = isValid ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
      const dayShifts = isValid ? shifts.filter((s: any) => s.data === dateStr && s.status !== 'cancelado') : [];
      return { day, isValid, dateStr, dayShifts, isToday: dateStr === today };
    });
  }, [shifts, calMonth, calYear, today]);

  const createSwapMutation = useMutation({
    mutationFn: async () => {
      if (!professionalId || !swapModal) throw new Error("Erro interno.");
      if (!swapForm.motivo) throw new Error("Informe o motivo.");
      if (swapForm.tipo === 'direto' && !swapForm.destinatario_id) throw new Error("Selecione o colega.");

      const { data: inserted, error } = await supabase.from("shift_swaps").insert({
        shift_id: swapModal.id,
        solicitante_id: professionalId,
        destinatario_id: swapForm.tipo === 'direto' ? swapForm.destinatario_id : null,
        tipo: swapForm.tipo === 'direto' ? 'direto' : 'grupo',
        motivo: swapForm.motivo,
        status: 'solicitada',
      }).select("id").single();
      if (error) throw error;

      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("swap_history").insert({ swap_id: inserted.id, acao: "Troca solicitada", usuario: "Profissional", user_id: user?.id });

      if (swapForm.tipo === 'direto' && swapForm.destinatario_id) {
        await dispatchNotification({ professionalId: swapForm.destinatario_id, tipo: 'troca', titulo: '🔄 Nova solicitação de troca', mensagem: 'Um colega solicitou uma troca de plantão com você.' });
      } else {
        const { data: profs } = await supabase.from("professionals_safe").select("id").eq("status", "ativo").neq("id", professionalId!);
        for (const p of profs || []) {
          await dispatchNotification({ professionalId: p.id, tipo: 'troca', titulo: '🔄 Plantão disponível para troca', mensagem: 'Um colega disponibilizou um plantão para troca.' });
        }
      }
    },
    onSuccess: () => {
      toast.success("Troca solicitada!");
      setSwapModal(null);
      setSwapForm({ tipo: 'grupo', destinatario_id: '', motivo: '' });
      qc.invalidateQueries({ queryKey: ["professional-swaps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inputClass = "w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="module-title">Minha Escala</h1>
          <p className="text-sm text-muted-foreground mt-1">Sua escala de plantões atualizada.</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="kpi-card">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
            className="p-1 rounded hover:bg-muted text-muted-foreground">◀</button>
          <h3 className="font-display font-semibold text-foreground">
            {new Date(calYear, calMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
            className="p-1 rounded hover:bg-muted text-muted-foreground">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-xs font-semibold text-muted-foreground py-2">{d}</div>
          ))}
          {calDays.map((d, i) => (
            <div key={i} className={`min-h-[72px] p-1 rounded-lg border transition-colors group relative ${d.isValid ? 'border-border/50 hover:border-primary/30' : 'border-transparent'} ${d.isToday ? 'bg-primary/5 border-primary/30' : ''}`}>
              {d.isValid && (
                <>
                  <span className={`text-xs font-medium ${d.isToday ? 'text-primary font-bold' : 'text-foreground'}`}>{d.day}</span>
                  <div className="space-y-0.5 mt-0.5">
                    {d.dayShifts.map((s: any) => (
                      <div key={s.id} className="relative group/shift">
                        <div className="text-[9px] bg-primary/10 text-primary rounded px-1 py-0.5 truncate font-medium">
                          {s.hora_inicio}-{s.hora_fim}
                        </div>
                        {d.dateStr > today && (
                          <button onClick={() => setSwapModal(s)}
                            className="absolute -top-1 -right-1 hidden group-hover/shift:flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[8px]"
                            title="Solicitar troca">
                            <ArrowLeftRight className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Unidade/Setor</th>
              <th className="p-3 text-left">Horário</th>
              <th className="p-3 text-left">Tipo</th>
              
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
            ) : shifts.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum plantão encontrado.</td></tr>
            ) : (
              shifts.map((s: any) => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 text-foreground">{new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-muted-foreground">{(s.units as any)?.nome || "—"} • {(s.sectors as any)?.nome || "—"}</td>
                  <td className="p-3 text-foreground">{s.hora_inicio} - {s.hora_fim}</td>
                  <td className="p-3 text-muted-foreground">{s.tipo_plantao}</td>
                  
                  <td className="p-3"><span className="status-badge bg-primary/10 text-primary">{s.status}</span></td>
                  <td className="p-3">
                    {s.data > today && s.status !== 'cancelado' && (
                      <button onClick={() => setSwapModal(s)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ArrowLeftRight className="h-3 w-3" /> Trocar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Swap Modal */}
      <Dialog open={!!swapModal} onOpenChange={(open) => { if (!open) setSwapModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Solicitar Troca de Plantão</DialogTitle></DialogHeader>
          {swapModal && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="font-medium text-foreground">{new Date(`${swapModal.data}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                <p className="text-muted-foreground">{swapModal.hora_inicio} - {swapModal.hora_fim} • {(swapModal.sectors as any)?.nome || ''}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Tipo de troca</label>
                <select value={swapForm.tipo} onChange={e => setSwapForm(f => ({ ...f, tipo: e.target.value, destinatario_id: '' }))} className={inputClass}>
                  <option value="grupo">Abrir para o grupo</option>
                  <option value="direto">Para colega específico</option>
                </select>
              </div>
              {swapForm.tipo === 'direto' && (
                <div>
                  <label className="text-sm font-medium text-foreground">Colega</label>
                  <select value={swapForm.destinatario_id} onChange={e => setSwapForm(f => ({ ...f, destinatario_id: e.target.value }))} className={inputClass}>
                    <option value="">Selecione...</option>
                    {directory.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground">Motivo *</label>
                <textarea value={swapForm.motivo} onChange={e => setSwapForm(f => ({ ...f, motivo: e.target.value }))} rows={3} className={inputClass} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSwapModal(null)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
                <button onClick={() => createSwapMutation.mutate()} disabled={createSwapMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                  {createSwapMutation.isPending ? 'Enviando...' : 'Solicitar troca'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
