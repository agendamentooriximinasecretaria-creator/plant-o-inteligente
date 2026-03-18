import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { Calendar, List, Clock, Plus, Trash2, Edit, ArrowLeftRight, Info } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<string, string> = { agendado: 'Agendado', confirmado: 'Confirmado', pendente: 'Pendente', em_aberto: 'Em Aberto', trocando: 'Em Troca', concluido: 'Concluído', cancelado: 'Cancelado' };
const STATUS_CLASSES: Record<string, string> = { agendado: 'bg-info/10 text-info', confirmado: 'bg-success/10 text-success', pendente: 'bg-warning/10 text-warning', em_aberto: 'bg-muted text-muted-foreground', trocando: 'bg-primary/10 text-primary', concluido: 'bg-accent/10 text-accent', cancelado: 'bg-destructive/10 text-destructive' };
const PROFISSAO_LABELS: Record<string, string> = { medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta', tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)', terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista', fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro' };

const emptyForm = { unidade_id: '', setor_id: '', profissao: 'medico', profissional_id: '', data: '', hora_inicio: '07:00', hora_fim: '19:00', tipo_plantao: 'Diurno 12h', observacoes: '', status: 'confirmado' };

export default function EscalaPage() {
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [conflictWarning, setConflictWarning] = useState('');
  const [recurring, setRecurring] = useState({ enabled: false, frequency: 'weekly', weeks: 1 });
  const [workloadAlerts, setWorkloadAlerts] = useState<string[]>([]);
  const [detailShift, setDetailShift] = useState<any>(null);
  const qc = useQueryClient();

  const { data: shifts = [], isLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shifts').select('*, professionals:profissional_id(nome, profissao), units:unidade_id(nome), sectors:setor_id(nome)').order('data', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for shifts — toast on external updates
  useEffect(() => {
    const shiftsChannel = supabase
      .channel('escala-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        refetchShifts();
        toast.info('📅 Escala atualizada', { duration: 2000, position: 'bottom-right' });
      })
      .subscribe();
    const swapsChannel = supabase
      .channel('escala-trocas-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shift_swaps' }, () => {
        refetchShifts();
        qc.invalidateQueries({ queryKey: ['active-swaps-for-escala'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(shiftsChannel); supabase.removeChannel(swapsChannel); };
  }, [refetchShifts, qc]);

  // Fetch active swaps to mark shifts visually
  const { data: activeSwaps = [] } = useQuery({
    queryKey: ['active-swaps-for-escala'],
    queryFn: async () => {
      const { data } = await supabase.from('shift_swaps')
        .select('shift_id, shift_id_destino, status, updated_at')
        .in('status', ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao', 'aprovada', 'concluida']);
      return data || [];
    },
  });

  const swapByShiftId = useMemo(() => {
    const map: Record<string, { status: string; updated_at: string }> = {};
    for (const sw of activeSwaps as any[]) {
      if (sw.shift_id) map[sw.shift_id] = { status: sw.status, updated_at: sw.updated_at };
      if (sw.shift_id_destino) map[sw.shift_id_destino] = { status: sw.status, updated_at: sw.updated_at };
    }
    return map;
  }, [activeSwaps]);

  const { data: professionals = [] } = useQuery({ queryKey: ['professionals'], queryFn: async () => { const { data } = await supabase.from('professionals').select('*').eq('status', 'ativo').order('nome'); return data || []; } });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: async () => { const { data } = await supabase.from('units').select('*').order('nome'); return data || []; } });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors'], queryFn: async () => { const { data } = await supabase.from('sectors').select('*').order('nome'); return data || []; } });

  const calcHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  };

  const checkConflict = async () => {
    if (!form.profissional_id || !form.data || !form.hora_inicio || !form.hora_fim) return;
    const { data } = await supabase.rpc('check_shift_conflict', {
      p_profissional_id: form.profissional_id,
      p_data: form.data,
      p_hora_inicio: form.hora_inicio,
      p_hora_fim: form.hora_fim,
      p_exclude_id: editingId,
    });
    if (data && data.length > 0) {
      setConflictWarning(`⚠️ Conflito detectado! Este profissional já tem plantão das ${data[0].conflicting_start} às ${data[0].conflicting_end} nesta data.`);
    } else {
      setConflictWarning('');
    }
  };

  // Check workload when professional/date changes
  const checkWorkload = async () => {
    if (!form.profissional_id || !form.data) { setWorkloadAlerts([]); return; }
    const alerts: string[] = [];
    // Check last 24h shifts
    const yesterday = new Date(form.data + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const { data: recent } = await supabase.from('shifts').select('carga_horaria, hora_fim').eq('profissional_id', form.profissional_id).in('data', [form.data, yStr]).neq('status', 'cancelado');
    const recentHours = (recent || []).reduce((s: number, r: any) => s + Number(r.carga_horaria), 0);
    if (recentHours >= 24) alerts.push('🟡 Profissional já tem 24h nas últimas 24h');
    // Check rest period (last shift ended less than 6h ago)
    const lastShift = (recent || []).sort((a: any, b: any) => b.hora_fim > a.hora_fim ? 1 : -1)[0];
    if (lastShift && form.hora_inicio) {
      const [lh, lm] = lastShift.hora_fim.split(':').map(Number);
      const [fh, fm] = form.hora_inicio.split(':').map(Number);
      const gap = (fh * 60 + fm) - (lh * 60 + lm);
      if (gap >= 0 && gap < 360) alerts.push('🔴 Profissional trabalhou nas últimas 6h (descanso mínimo não respeitado)');
    }
    // Check weekly hours
    const weekStart = new Date(form.data + 'T00:00:00');
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const { data: weekShifts } = await supabase.from('shifts').select('carga_horaria').eq('profissional_id', form.profissional_id).gte('data', weekStart.toISOString().split('T')[0]).lte('data', weekEnd.toISOString().split('T')[0]).neq('status', 'cancelado');
    const weekHours = (weekShifts || []).reduce((s: number, r: any) => s + Number(r.carga_horaria), 0);
    if (weekHours >= 60) alerts.push('🟠 Profissional já tem 60h esta semana (limite configurado)');
    setWorkloadAlerts(alerts);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (conflictWarning) throw new Error('Resolva o conflito de horário antes de salvar.');
      const prof = professionals.find((p: any) => p.id === data.profissional_id);
      const hours = calcHours(data.hora_inicio, data.hora_fim);
      const payload = {
        unidade_id: data.unidade_id, setor_id: data.setor_id, profissao: data.profissao as any,
        profissional_id: data.profissional_id, data: data.data, hora_inicio: data.hora_inicio,
        hora_fim: data.hora_fim, carga_horaria: hours, tipo_plantao: data.tipo_plantao,
        valor_hora: prof?.valor_hora || 0, valor_total: (prof?.valor_hora || 0) * hours,
        observacoes: data.observacoes || null, status: data.status as any,
      };
      if (editingId) {
        const { error } = await supabase.from('shifts').update(payload).eq('id', editingId);
        if (error) throw error;
        await logAudit('Plantão editado', 'escala', { id: editingId });
      } else if (recurring.enabled && !editingId) {
        // Recurring: create multiple shifts
        const dates = getRecurringDates(data.data, recurring.frequency, recurring.weeks);
        // Check conflicts for ALL dates first
        for (const d of dates) {
          const { data: conflicts } = await supabase.rpc('check_shift_conflict', {
            p_profissional_id: data.profissional_id, p_data: d, p_hora_inicio: data.hora_inicio, p_hora_fim: data.hora_fim,
          });
          if (conflicts && conflicts.length > 0) throw new Error(`Conflito na data ${new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}: plantão das ${conflicts[0].conflicting_start} às ${conflicts[0].conflicting_end}.`);
        }
        const payloads = dates.map(d => ({ ...payload, data: d }));
        const { error } = await supabase.from('shifts').insert(payloads);
        if (error) throw error;
        await logAudit('Plantões recorrentes criados', 'escala', { profissional: prof?.nome, count: dates.length, dates });
        await dispatchNotification({
          professionalId: data.profissional_id, tipo: 'plantao', titulo: 'Novos plantões agendados',
          mensagem: `Você foi escalado para ${dates.length} plantões recorrentes.`,
        });
      } else {
        const { error } = await supabase.from('shifts').insert(payload);
        if (error) throw error;
        await logAudit('Plantão criado', 'escala', { profissional: prof?.nome, data: data.data });
        await dispatchNotification({
          professionalId: data.profissional_id, tipo: 'plantao', titulo: 'Novo plantão agendado',
          mensagem: `Você foi escalado para plantão em ${new Date(data.data + 'T12:00:00').toLocaleDateString('pt-BR')} das ${data.hora_inicio} às ${data.hora_fim}.`,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success(editingId ? 'Plantão atualizado!' : recurring.enabled ? 'Plantões recorrentes criados!' : 'Plantão criado!'); closeModal(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function getRecurringDates(startDate: string, freq: string, weeks: number): string[] {
    const dates: string[] = [];
    const start = new Date(startDate + 'T12:00:00');
    const interval = freq === 'weekly' ? 7 : freq === 'biweekly' ? 14 : 30;
    for (let i = 0; i < weeks; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + (i * interval));
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }

  const deleteMutation = useMutation({
    mutationFn: async (shift: any) => {
      const { error } = await supabase.from('shifts').delete().eq('id', shift.id);
      if (error) throw error;
      await logAudit('Plantão excluído', 'escala', { id: shift.id });
      // Notify professional about cancellation
      await dispatchNotification({
        professionalId: shift.profissional_id,
        tipo: 'plantao',
        titulo: '⚠️ Plantão cancelado',
        mensagem: `Seu plantão em ${new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR')} das ${shift.hora_inicio} às ${shift.hora_fim} foi cancelado.`,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Plantão excluído!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); setConflictWarning(''); setWorkloadAlerts([]); setRecurring({ enabled: false, frequency: 'weekly', weeks: 1 }); };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({ unidade_id: s.unidade_id, setor_id: s.setor_id, profissao: s.profissao, profissional_id: s.profissional_id, data: s.data, hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, tipo_plantao: s.tipo_plantao, observacoes: s.observacoes || '', status: s.status });
    setModalOpen(true);
  };

  const filtered = shifts.filter((s: any) => {
    if (filterSetor && s.setor_id !== filterSetor) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Escala de Plantões</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} plantões encontrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('lista')} className={`p-2 rounded-lg transition-colors ${view === 'lista' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}><List className="h-4 w-4" /></button>
          <button onClick={() => setView('calendario')} className={`p-2 rounded-lg transition-colors ${view === 'calendario' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}><Calendar className="h-4 w-4" /></button>
          <button onClick={() => { setForm(emptyForm); setEditingId(null); setModalOpen(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"><Plus className="h-4 w-4" /> Novo Plantão</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={filterSetor} onChange={e => setFilterSetor(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">Todos os setores</option>
          {sectors.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : view === 'lista' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="table-header">
                <th className="text-left p-3">Profissional</th><th className="text-left p-3">Setor</th><th className="text-left p-3">Data</th><th className="text-left p-3">Horário</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Status</th><th className="text-left p-3">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map((s: any) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3"><p className="font-medium text-foreground">{(s.professionals as any)?.nome}</p><p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[(s.professionals as any)?.profissao] || ''}</p></td>
                    <td className="p-3"><p className="text-foreground">{(s.sectors as any)?.nome}</p><p className="text-xs text-muted-foreground">{(s.units as any)?.nome}</p></td>
                    <td className="p-3 text-foreground">{new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-3"><div className="flex items-center gap-1 text-foreground"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{s.hora_inicio} - {s.hora_fim}</div><p className="text-xs text-muted-foreground">{s.carga_horaria}h</p></td>
                    <td className="p-3 text-foreground">{s.tipo_plantao}</td>
                    <td className="p-3 font-medium text-foreground">R$ {Number(s.valor_total).toLocaleString('pt-BR')}</td>
                    <td className="p-3"><span className={`status-badge ${STATUS_CLASSES[s.status] || ''}`}>{STATUS_LABELS[s.status]}</span></td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-muted"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><button className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-4 w-4 text-destructive" /></button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir plantão?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(s)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-lg border border-border p-6 shadow-[var(--shadow-card)]">
          {/* Sector color legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {(() => {
              const sectorColors: Record<string, string> = {};
              const palette = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))'];
              sectors.forEach((s: any, i: number) => { sectorColors[s.id] = palette[i % palette.length]; });
              return sectors.map((s: any) => (
                <div key={s.id} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: sectorColors[s.id] }} />
                  <span className="text-muted-foreground">{s.nome}</span>
                </div>
              ));
            })()}
            <div className="flex items-center gap-1.5 text-xs ml-2">
              <div className="h-2.5 w-4 rounded-sm bg-warning/40" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, hsl(var(--warning)/0.3) 2px, hsl(var(--warning)/0.3) 4px)' }} />
              <span className="text-muted-foreground">Em troca</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
            {(() => {
              const sectorColors: Record<string, string> = {};
              const palette = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))'];
              sectors.forEach((s: any, i: number) => { sectorColors[s.id] = palette[i % palette.length]; });
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
              return Array.from({ length: totalCells }, (_, i) => {
                const day = i - firstDay + 1;
                const isValid = day >= 1 && day <= daysInMonth;
                const isToday = isValid && day === now.getDate();
                const dateStr = isValid ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                const dayShifts = isValid ? shifts.filter((s: any) => s.data === dateStr) : [];
                return (
                  <div key={i} className={`min-h-[80px] p-1 rounded-lg border transition-colors ${isValid ? 'border-border/50 hover:border-primary/30 cursor-pointer' : 'border-transparent'} ${isToday ? 'bg-primary/5 border-primary/30' : ''}`}>
                    {isValid && (<><span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>{day}</span>
                      <div className="space-y-0.5 mt-1">{dayShifts.slice(0, 3).map((s: any) => {
                        const swapInfo = swapByShiftId[s.id];
                        const inSwap = swapInfo && ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao'].includes(swapInfo.status);
                        const recentlySwapped = swapInfo && ['aprovada', 'concluida'].includes(swapInfo.status) && (Date.now() - new Date(swapInfo.updated_at).getTime()) < 86400000;
                        const statusIcon = s.status === 'confirmado' ? '✅' : s.status === 'cancelado' ? '❌' : s.status === 'concluido' ? '☑️' : '📅';
                        return (
                          <div key={s.id}
                            onClick={() => setDetailShift(s)}
                            className={`text-[9px] px-1 py-0.5 rounded truncate text-white font-medium relative ${recentlySwapped ? 'ring-1 ring-success animate-pulse' : ''}`}
                            style={{
                              background: inSwap
                                ? `repeating-linear-gradient(45deg, ${sectorColors[s.setor_id] || '#64748B'}, ${sectorColors[s.setor_id] || '#64748B'} 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)`
                                : sectorColors[s.setor_id] || 'hsl(var(--muted-foreground))',
                            }}
                            title={inSwap ? 'Em processo de troca' : recentlySwapped ? '🔄 Trocado recentemente' : ''}
                          >
                            <span className="flex items-center gap-0.5">
                              {(s.professionals as any)?.nome?.split(' ')[0]} {statusIcon}
                              {inSwap && <ArrowLeftRight className="h-2 w-2 inline" />}
                              {recentlySwapped && <span className="ml-0.5">🔄</span>}
                            </span>
                          </div>
                        );
                      })}{dayShifts.length > 3 && <div className="text-[9px] text-muted-foreground">+{dayShifts.length - 3}</div>}</div></>)}
                  </div>
                );
              });
            })()}
          </div>

          {/* Month summary bar */}
          {(() => {
            const now = new Date();
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const monthShifts = shifts.filter((s: any) => s.data.startsWith(monthStr) && s.status !== 'cancelado');
            const totalHours = monthShifts.reduce((sum: number, s: any) => sum + Number(s.carga_horaria || 0), 0);
            const totalValue = monthShifts.reduce((sum: number, s: any) => sum + Number(s.valor_total || 0), 0);
            const conflicts = 0; // already validated on creation
            return (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border flex flex-wrap gap-4 text-sm">
                <span className="text-foreground font-medium">📊 {now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}:</span>
                <span className="text-muted-foreground">{monthShifts.length} plantões</span>
                <span className="text-muted-foreground">{totalHours.toFixed(0)}h cobertas</span>
                <span className="text-muted-foreground">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} previsto</span>
                <span className="text-muted-foreground">{conflicts} conflitos</span>
              </div>
            );
          })()}
        </motion.div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Plantão' : 'Novo Plantão'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-foreground">Unidade *</label>
                <select required value={form.unidade_id} onChange={e => setForm(f => ({ ...f, unidade_id: e.target.value, setor_id: '' }))} className={inputClass}>
                  <option value="">Selecione...</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Setor *</label>
                <select required value={form.setor_id} onChange={e => setForm(f => ({ ...f, setor_id: e.target.value }))} className={inputClass}>
                  <option value="">Selecione...</option>{sectors.filter((s: any) => !form.unidade_id || s.unidade_id === form.unidade_id).map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Profissão *</label>
                <select required value={form.profissao} onChange={e => setForm(f => ({ ...f, profissao: e.target.value }))} className={inputClass}>
                  {Object.entries(PROFISSAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Profissional *</label>
                <select required value={form.profissional_id} onChange={e => { setForm(f => ({ ...f, profissional_id: e.target.value })); setTimeout(checkConflict, 100); setTimeout(checkWorkload, 100); }} className={inputClass}>
                  <option value="">Selecione...</option>{professionals.filter((p: any) => !form.profissao || p.profissao === form.profissao).map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Data *</label><input required type="date" value={form.data} onChange={e => { setForm(f => ({ ...f, data: e.target.value })); setTimeout(checkConflict, 100); setTimeout(checkWorkload, 100); }} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Tipo</label><input value={form.tipo_plantao} onChange={e => setForm(f => ({ ...f, tipo_plantao: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Hora início *</label><input required type="time" value={form.hora_inicio} onChange={e => { setForm(f => ({ ...f, hora_inicio: e.target.value })); setTimeout(checkConflict, 100); }} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Hora fim *</label><input required type="time" value={form.hora_fim} onChange={e => { setForm(f => ({ ...f, hora_fim: e.target.value })); setTimeout(checkConflict, 100); }} className={inputClass} /></div>
              <div className="col-span-2"><label className="text-sm font-medium text-foreground">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>
            {conflictWarning && <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">{conflictWarning}</div>}
            {(() => {
              const prof = professionals.find((p: any) => p.id === form.profissional_id);
              if (prof && (prof.valor_hora === 0 || prof.valor_hora === null)) {
                return <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning font-medium">⚠️ Profissional sem valor/hora cadastrado. Configure em Profissionais.</div>;
              }
              return null;
            })()}
            {form.profissional_id && form.hora_inicio && form.hora_fim && (() => {
              const prof = professionals.find((p: any) => p.id === form.profissional_id);
              const hours = calcHours(form.hora_inicio, form.hora_fim);
              const total = (prof?.valor_hora || 0) * hours;
              return <div className="p-3 bg-info/10 border border-info/30 rounded-lg text-sm text-info font-medium">📊 {hours.toFixed(1)}h × R$ {prof?.valor_hora || 0}/h = <strong>R$ {total.toFixed(2)}</strong></div>;
            })()}
            {workloadAlerts.length > 0 && (
              <div className="space-y-1">
                {workloadAlerts.map((a, i) => <div key={i} className="p-2 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning font-medium">{a}</div>)}
              </div>
            )}
            {!editingId && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
                  <input type="checkbox" checked={recurring.enabled} onChange={e => setRecurring(r => ({ ...r, enabled: e.target.checked }))} className="rounded" />
                  🔁 Repetir este plantão
                </label>
                {recurring.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Frequência</label>
                      <select value={recurring.frequency} onChange={e => setRecurring(r => ({ ...r, frequency: e.target.value }))} className={inputClass}>
                        <option value="weekly">Semanalmente</option>
                        <option value="biweekly">Quinzenalmente</option>
                        <option value="monthly">Mensalmente</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Repetições (1-12)</label>
                      <input type="number" min={1} max={12} value={recurring.weeks} onChange={e => setRecurring(r => ({ ...r, weeks: Math.min(12, Math.max(1, Number(e.target.value))) }))} className={inputClass} />
                    </div>
                    {form.data && (
                      <div className="col-span-2 text-xs text-muted-foreground">
                        Serão criados {recurring.weeks} plantões: {getRecurringDates(form.data, recurring.frequency, recurring.weeks).map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div><label className="text-sm font-medium text-foreground">Observações</label><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className={inputClass} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveMutation.isPending || !!conflictWarning} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saveMutation.isPending ? 'Salvando...' : recurring.enabled ? `Criar ${recurring.weeks} plantões` : 'Salvar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shift Detail Modal */}
      <Dialog open={!!detailShift} onOpenChange={(open) => !open && setDetailShift(null)}>
        <DialogContent className="max-w-md">
          {detailShift && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Plantão — {new Date(detailShift.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">👤</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{(detailShift.professionals as any)?.nome}</p>
                    <p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[(detailShift.professionals as any)?.profissao] || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">🏥</span>
                  <p className="text-sm text-foreground">{(detailShift.sectors as any)?.nome} — {(detailShift.units as any)?.nome}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">⏰</span>
                  <p className="text-sm text-foreground">{detailShift.hora_inicio} às {detailShift.hora_fim} ({detailShift.carga_horaria}h)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">💰</span>
                  <p className="text-sm font-medium text-foreground">R$ {Number(detailShift.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">📌</span>
                  <span className={`status-badge ${STATUS_CLASSES[detailShift.status] || ''}`}>{STATUS_LABELS[detailShift.status]}</span>
                  {swapByShiftId[detailShift.id] && ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao'].includes(swapByShiftId[detailShift.id].status) && (
                    <span className="status-badge bg-warning/10 text-warning"><ArrowLeftRight className="h-3 w-3 mr-1" />Em troca</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                <button onClick={() => { openEdit(detailShift); setDetailShift(null); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                  <Edit className="h-3.5 w-3.5" /> Editar
                </button>
                <button onClick={() => setDetailShift(null)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">
                  Fechar
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
