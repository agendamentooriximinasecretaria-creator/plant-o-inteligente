import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { dispatchNotification } from "@/lib/notifyHelper";
import { Calendar, List, Clock, Plus, Trash2, Edit, ArrowLeftRight, Info, Users as UsersIcon } from "lucide-react";
import { ContactActionButton } from "@/components/ContactActionButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const STATUS_LABELS: Record<string, string> = { agendado: 'Agendado', confirmado: 'Confirmado', pendente: 'Pendente', em_aberto: 'Em Aberto', trocando: 'Em Troca', concluido: 'Concluído', cancelado: 'Cancelado' };
const STATUS_CLASSES: Record<string, string> = { agendado: 'bg-info/10 text-info', confirmado: 'bg-success/10 text-success', pendente: 'bg-warning/10 text-warning', em_aberto: 'bg-muted text-muted-foreground', trocando: 'bg-primary/10 text-primary', concluido: 'bg-accent/10 text-accent', cancelado: 'bg-destructive/10 text-destructive' };
const PROFISSAO_LABELS: Record<string, string> = { medico: 'Médico(a)', enfermeiro: 'Enfermeiro(a)', fisioterapeuta: 'Fisioterapeuta', tecnico_enfermagem: 'Téc. Enfermagem', biomedico: 'Biomédico(a)', psicologo: 'Psicólogo(a)', terapeuta_ocupacional: 'Terapeuta Ocupacional', nutricionista: 'Nutricionista', fonoaudiologo: 'Fonoaudiólogo(a)', farmaceutico: 'Farmacêutico(a)', outro: 'Outro' };

const emptyForm = { unidade_id: '', setor_id: '', profissao: 'medico', profissional_ids: [] as string[], data: '', hora_inicio: '07:00', hora_fim: '19:00', tipo_plantao: 'Diurno 12h', observacoes: '', status: 'confirmado' };

export default function EscalaPage() {
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const [filterSetor, setFilterSetor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
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

  useEffect(() => {
    const shiftsChannel = supabase
      .channel('escala-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        refetchShifts();
        toast.info('📅 Escala atualizada', { duration: 2000, position: 'bottom-right' });
      })
      .subscribe();
    return () => { supabase.removeChannel(shiftsChannel); };
  }, [refetchShifts]);

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

  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: async () => {
      const { data } = await supabase.from('professionals')
        .select('id, nome, profissao, especialidade, telefone, email, status, setor_principal_id, unidade_principal_id, user_id, competencias, registro, conselho, documento_validade, vinculo')
        .eq('status', 'ativo').order('nome');
      return data || [];
    },
  });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: async () => { const { data } = await supabase.from('units').select('*').order('nome'); return data || []; } });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors'], queryFn: async () => { const { data } = await supabase.from('sectors').select('*').order('nome'); return data || []; } });

  const todayStr = new Date().toISOString().split('T')[0];

  const { data: censoHoje = [] } = useQuery({
    queryKey: ['escala-censo-hoje', todayStr],
    queryFn: async () => { const { data } = await supabase.from('censo_pacientes').select('setor_id, leitos_ocupados, proporcao_minima').eq('data', todayStr); return data || []; },
  });

  const { data: todayAllShifts = [] } = useQuery({
    queryKey: ['escala-today-shifts', todayStr],
    queryFn: async () => { const { data } = await supabase.from('shifts').select('setor_id, profissional_id').eq('data', todayStr).neq('status', 'cancelado'); return data || []; },
  });

  const sectorCapacity = useMemo(() => {
    const map: Record<string, { status: 'ok' | 'atencao' | 'critico'; reason: string }> = {};
    for (const s of sectors as any[]) {
      const censo = (censoHoje as any[]).find(c => c.setor_id === s.id);
      const pacientes = censo?.leitos_ocupados || 0;
      const escalados = todayAllShifts.filter((sh: any) => sh.setor_id === s.id).length;
      const minD = s.min_profissionais_diurno || 1;

      if (pacientes > 0 && escalados > 0) {
        const ratio = pacientes / escalados;
        if (ratio > 10) map[s.id] = { status: 'critico', reason: `${escalados} prof. para ${pacientes} pac. (${ratio.toFixed(0)}:1)` };
        else if (ratio > 6) map[s.id] = { status: 'atencao', reason: `${escalados} prof. para ${pacientes} pac. (${ratio.toFixed(0)}:1)` };
        else map[s.id] = { status: 'ok', reason: `Equipe adequada (${ratio.toFixed(0)}:1)` };
      } else if (escalados < minD) {
        map[s.id] = { status: 'atencao', reason: `${escalados}/${minD} profissionais (mínimo)` };
      } else {
        map[s.id] = { status: 'ok', reason: 'Equipe adequada' };
      }
    }
    return map;
  }, [sectors, censoHoje, todayAllShifts]);

  // Group shifts by date+sector+horario for "multiple professionals per turn" UI
  const groupedShifts = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of shifts as any[]) {
      const key = `${s.data}|${s.setor_id}|${s.hora_inicio}|${s.hora_fim}`;
      (map[key] ||= []).push(s);
    }
    return map;
  }, [shifts]);

  const calcHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  };

  const checkConflicts = async () => {
    if (!form.profissional_ids.length || !form.data || !form.hora_inicio || !form.hora_fim) {
      setConflictWarnings([]);
      return;
    }
    const warnings: string[] = [];
    for (const pid of form.profissional_ids) {
      const { data } = await supabase.rpc('check_shift_conflict', {
        p_profissional_id: pid,
        p_data: form.data,
        p_hora_inicio: form.hora_inicio,
        p_hora_fim: form.hora_fim,
        p_exclude_id: editingId,
      });
      if (data && data.length > 0) {
        const prof = (professionals as any[]).find(p => p.id === pid);
        warnings.push(`⚠️ ${prof?.nome}: já tem plantão ${data[0].conflicting_start}-${data[0].conflicting_end}`);
      }
    }
    setConflictWarnings(warnings);
  };

  const checkWorkload = async () => {
    if (form.profissional_ids.length !== 1 || !form.data) { setWorkloadAlerts([]); return; }
    const pid = form.profissional_ids[0];
    const alerts: string[] = [];
    const yesterday = new Date(form.data + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const { data: recent } = await supabase.from('shifts').select('carga_horaria, hora_fim').eq('profissional_id', pid).in('data', [form.data, yStr]).neq('status', 'cancelado');
    const recentHours = (recent || []).reduce((s: number, r: any) => s + Number(r.carga_horaria), 0);
    if (recentHours >= 24) alerts.push('🟡 Profissional já tem 24h nas últimas 24h');
    setWorkloadAlerts(alerts);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (!data.profissional_ids.length) throw new Error('Selecione ao menos um profissional.');
      if (conflictWarnings.length) throw new Error('Resolva os conflitos antes de salvar.');
      const hours = calcHours(data.hora_inicio, data.hora_fim);
      const basePayload = {
        unidade_id: data.unidade_id, setor_id: data.setor_id, profissao: data.profissao as any,
        data: data.data, hora_inicio: data.hora_inicio, hora_fim: data.hora_fim,
        carga_horaria: hours, tipo_plantao: data.tipo_plantao,
        observacoes: data.observacoes || null, status: data.status as any,
      };

      if (editingId) {
        const pid = data.profissional_ids[0];
        const { error } = await supabase.from('shifts').update({ ...basePayload, profissional_id: pid }).eq('id', editingId);
        if (error) throw error;
        await logAudit('Plantão editado', 'escala', { id: editingId });
      } else {
        const payloads = data.profissional_ids.map(pid => ({ ...basePayload, profissional_id: pid }));
        const { error } = await supabase.from('shifts').insert(payloads);
        if (error) throw error;
        await logAudit('Plantões criados (múltiplos profissionais)', 'escala', { count: payloads.length, data: data.data });
        for (const pid of data.profissional_ids) {
          await dispatchNotification({
            professionalId: pid, tipo: 'plantao', titulo: 'Novo plantão agendado',
            mensagem: `Você foi escalado para plantão em ${new Date(data.data + 'T12:00:00').toLocaleDateString('pt-BR')} das ${data.hora_inicio} às ${data.hora_fim}.`,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      toast.success(editingId ? 'Plantão atualizado!' : `${form.profissional_ids.length} plantão(ões) criado(s)!`);
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (shift: any) => {
      if (shift.status === 'trocando') {
        await supabase.from('shift_swaps')
          .update({ status: 'cancelada' as any, observacao_gestor: 'Troca cancelada — plantão excluído' })
          .eq('shift_id', shift.id)
          .in('status', ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao']);
      }
      const { error } = await supabase.from('shifts').delete().eq('id', shift.id);
      if (error) {
        await supabase.from('shifts').update({ status: 'cancelado' as any }).eq('id', shift.id);
        toast.success('Plantão cancelado');
      } else {
        toast.success('Plantão excluído');
      }
      await logAudit('Plantão excluído', 'escala', { id: shift.id });
      await dispatchNotification({
        professionalId: shift.profissional_id, tipo: 'plantao',
        titulo: '⚠️ Plantão cancelado',
        mensagem: `Seu plantão em ${new Date(shift.data + 'T12:00:00').toLocaleDateString('pt-BR')} foi cancelado.`,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
    onError: (e: Error) => toast.error(`Não foi possível excluir: ${e.message}`),
  });

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(emptyForm); setConflictWarnings([]); setWorkloadAlerts([]); };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    setForm({
      unidade_id: s.unidade_id, setor_id: s.setor_id, profissao: s.profissao,
      profissional_ids: [s.profissional_id], data: s.data,
      hora_inicio: s.hora_inicio, hora_fim: s.hora_fim, tipo_plantao: s.tipo_plantao,
      observacoes: s.observacoes || '', status: s.status,
    });
    setModalOpen(true);
  };

  const openCreateForCell = (date: string, sectorId?: string, unidadeId?: string) => {
    setEditingId(null);
    setForm({
      ...emptyForm, data: date,
      setor_id: sectorId || '', unidade_id: unidadeId || '',
    });
    setModalOpen(true);
  };

  const filtered = (shifts as any[]).filter((s: any) => {
    if (filterSetor && s.setor_id !== filterSetor) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  const toggleProfissional = (pid: string) => {
    setForm(f => {
      const has = f.profissional_ids.includes(pid);
      return { ...f, profissional_ids: has ? f.profissional_ids.filter(x => x !== pid) : [...f.profissional_ids, pid] };
    });
    setTimeout(() => { checkConflicts(); checkWorkload(); }, 100);
  };

  const initials = (nome?: string) => (nome || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
                <th className="text-left p-3">Profissional</th><th className="text-left p-3">Setor</th><th className="text-left p-3">Data</th><th className="text-left p-3">Horário</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Status</th><th className="text-left p-3">Ações</th>
              </tr></thead>
              <tbody>
                {filtered.map((s: any) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3"><p className="font-medium text-foreground">{(s.professionals as any)?.nome}</p><p className="text-xs text-muted-foreground">{PROFISSAO_LABELS[(s.professionals as any)?.profissao] || ''}</p></td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                {sectorCapacity[s.setor_id]?.status === 'critico' ? '🔴' : sectorCapacity[s.setor_id]?.status === 'atencao' ? '🟡' : '🟢'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">{sectorCapacity[s.setor_id]?.reason || 'Sem dados'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <div>
                          <p className="text-foreground">{(s.sectors as any)?.nome}</p>
                          <p className="text-xs text-muted-foreground">{(s.units as any)?.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-foreground">{new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="p-3"><div className="flex items-center gap-1 text-foreground"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{s.hora_inicio} - {s.hora_fim}</div><p className="text-xs text-muted-foreground">{s.carga_horaria}h</p></td>
                    <td className="p-3 text-foreground">{s.tipo_plantao}</td>
                    <td className="p-3"><span className={`status-badge ${STATUS_CLASSES[s.status] || ''}`}>{STATUS_LABELS[s.status]}</span></td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <ContactActionButton
                          profissional={{ nome: (s.professionals as any)?.nome || '', telefone: (professionals as any[]).find((p: any) => p.id === s.profissional_id)?.telefone }}
                          contexto={{ tipo: 'plantao', data: new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR'), horario: `${s.hora_inicio} às ${s.hora_fim}`, setor: (s.sectors as any)?.nome, unidade: (s.units as any)?.nome }}
                        />
                        <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-muted"><Edit className="h-4 w-4 text-muted-foreground" /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><button className="p-1 rounded hover:bg-destructive/10" disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir plantão?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {(s.professionals as any)?.nome} — {new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR')} {s.hora_inicio}-{s.hora_fim}. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(s)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
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
          <div className="grid grid-cols-7 gap-1 text-center">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
            {(() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
              const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
              return Array.from({ length: totalCells }, (_, i) => {
                const day = i - firstDay + 1;
                const isValid = day >= 1 && day <= daysInMonth;
                const isToday = isValid && day === now.getDate();
                const dateStr = isValid ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                const dayShifts = isValid ? (shifts as any[]).filter((s: any) => s.data === dateStr) : [];
                return (
                  <div key={i}
                    onClick={() => isValid && dayShifts.length === 0 && openCreateForCell(dateStr)}
                    className={`min-h-[88px] p-1 rounded-lg border transition-colors ${isValid ? 'border-border/50 hover:border-primary/30 cursor-pointer' : 'border-transparent'} ${isToday ? 'bg-primary/5 border-primary/30' : ''}`}>
                    {isValid && (<>
                      <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>{day}</span>
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {dayShifts.slice(0, 5).map((s: any) => (
                          <button
                            key={s.id}
                            onClick={(e) => { e.stopPropagation(); setDetailShift(s); }}
                            className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center hover:bg-primary/30"
                            title={(s.professionals as any)?.nome}
                          >
                            {initials((s.professionals as any)?.nome)}
                          </button>
                        ))}
                        {dayShifts.length > 5 && <span className="text-[9px] text-muted-foreground self-center">+{dayShifts.length - 5}</span>}
                      </div>
                    </>)}
                  </div>
                );
              });
            })()}
          </div>
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
                <select required value={form.profissao} onChange={e => setForm(f => ({ ...f, profissao: e.target.value, profissional_ids: [] }))} className={inputClass}>
                  {Object.entries(PROFISSAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
              <div><label className="text-sm font-medium text-foreground">Data *</label><input required type="date" value={form.data} onChange={e => { setForm(f => ({ ...f, data: e.target.value })); setTimeout(() => { checkConflicts(); checkWorkload(); }, 100); }} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Hora início *</label><input required type="time" value={form.hora_inicio} onChange={e => { setForm(f => ({ ...f, hora_inicio: e.target.value })); setTimeout(checkConflicts, 100); }} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Hora fim *</label><input required type="time" value={form.hora_fim} onChange={e => { setForm(f => ({ ...f, hora_fim: e.target.value })); setTimeout(checkConflicts, 100); }} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Tipo</label><input value={form.tipo_plantao} onChange={e => setForm(f => ({ ...f, tipo_plantao: e.target.value }))} className={inputClass} /></div>
              <div><label className="text-sm font-medium text-foreground">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select></div>
            </div>

            {/* Multi-select de profissionais */}
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <UsersIcon className="h-4 w-4" /> Profissionais escalados *
                {form.profissional_ids.length > 0 && (
                  <span className="text-xs text-muted-foreground">({form.profissional_ids.length} selecionado{form.profissional_ids.length > 1 ? 's' : ''})</span>
                )}
              </label>
              <p className="text-xs text-muted-foreground mb-2">Selecione um ou mais profissionais para este turno.</p>
              <div className="border border-border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
                {(professionals as any[]).filter((p: any) => !form.profissao || p.profissao === form.profissao).map((p: any) => {
                  const checked = form.profissional_ids.includes(p.id);
                  return (
                    <label key={p.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${checked ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProfissional(p.id)}
                        disabled={!!editingId && !checked && form.profissional_ids.length >= 1}
                        className="rounded"
                      />
                      <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{initials(p.nome)}</span>
                      <span className="text-foreground flex-1">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">{PROFISSAO_LABELS[p.profissao]}</span>
                    </label>
                  );
                })}
                {(professionals as any[]).filter((p: any) => !form.profissao || p.profissao === form.profissao).length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Nenhum profissional ativo desta categoria.</p>
                )}
              </div>
              {editingId && <p className="text-xs text-muted-foreground mt-1">Edição permite apenas 1 profissional. Para adicionar outros, crie um novo plantão.</p>}
            </div>

            {conflictWarnings.length > 0 && (
              <div className="space-y-1">
                {conflictWarnings.map((w, i) => <div key={i} className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive font-medium">{w}</div>)}
              </div>
            )}
            {workloadAlerts.length > 0 && (
              <div className="space-y-1">
                {workloadAlerts.map((a, i) => <div key={i} className="p-2 bg-warning/10 border border-warning/30 rounded-lg text-xs text-warning font-medium">{a}</div>)}
              </div>
            )}
            <div><label className="text-sm font-medium text-foreground">Observações</label><textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} className={inputClass} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveMutation.isPending || conflictWarnings.length > 0 || form.profissional_ids.length === 0} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar' : `Escalar ${form.profissional_ids.length || ''}`}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                <p className="text-sm font-semibold text-foreground">{(detailShift.professionals as any)?.nome}</p>
                <p className="text-sm text-muted-foreground">{PROFISSAO_LABELS[(detailShift.professionals as any)?.profissao] || ''}</p>
                <p className="text-sm text-foreground">🏥 {(detailShift.sectors as any)?.nome} — {(detailShift.units as any)?.nome}</p>
                <p className="text-sm text-foreground">⏰ {detailShift.hora_inicio} às {detailShift.hora_fim} ({detailShift.carga_horaria}h)</p>
                <span className={`status-badge ${STATUS_CLASSES[detailShift.status] || ''}`}>{STATUS_LABELS[detailShift.status]}</span>
                {swapByShiftId[detailShift.id] && ['solicitada', 'aguardando_resposta', 'aceita', 'aguardando_aprovacao'].includes(swapByShiftId[detailShift.id].status) && (
                  <span className="status-badge bg-warning/10 text-warning ml-2"><ArrowLeftRight className="h-3 w-3 mr-1 inline" />Em troca</span>
                )}
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
