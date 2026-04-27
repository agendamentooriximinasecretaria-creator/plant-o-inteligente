import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Building2, MapPin, Layers, Plus, Edit, Trash2, ChevronDown, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type SectorRow = { id: string; nome: string; unidade_id: string; min_profissionais_diurno: number | null; min_profissionais_noturno: number | null; min_profissionais_fds: number | null; units?: { nome?: string } };
type ShiftToday = { setor_id: string; status: string; tipo_plantao: string };

export default function SetoresPage() {
  const qc = useQueryClient();
  const [unitModal, setUnitModal] = useState(false);
  const [sectorModal, setSectorModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({ nome: '', tipo: 'hospital', endereco: '', telefone: '' });
  const [sectorForm, setSectorForm] = useState({ nome: '', unidade_id: '', min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 });
  const [expandedUnit, setExpandedUnit] = useState<Record<string, boolean>>({});

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => { const { data, error } = await supabase.from('units').select('*').order('nome'); if (error) throw error; return data; },
  });

  const { data: sectors = [], isLoading: loadingSectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: async () => { const { data, error } = await supabase.from('sectors').select('*, units:unidade_id(nome)').order('nome'); if (error) throw error; return data as SectorRow[]; },
  });

  // Cobertura HOJE — plantões de hoje agrupados por setor
  const { data: shiftsToday = [], refetch: refetchToday } = useQuery({
    queryKey: ['sectors-today-coverage'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('shifts').select('setor_id, status, tipo_plantao').eq('data', today);
      return (data || []) as ShiftToday[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel('sectors-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => refetchToday()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetchToday]);

  const coverageBySector = useMemo(() => {
    const map: Record<string, { confirmados: number; pendentes: number; total: number }> = {};
    for (const s of shiftsToday) {
      if (s.tipo_plantao === 'folga' || s.tipo_plantao === 'indisponibilidade') continue;
      if (!map[s.setor_id]) map[s.setor_id] = { confirmados: 0, pendentes: 0, total: 0 };
      map[s.setor_id].total++;
      if (s.status === 'confirmado' || s.status === 'concluido') map[s.setor_id].confirmados++;
      else if (s.status !== 'cancelado') map[s.setor_id].pendentes++;
    }
    return map;
  }, [shiftsToday]);

  const isWeekend = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 || d === 6;
  }, []);

  const getMinForSector = (s: SectorRow) => {
    if (isWeekend) return s.min_profissionais_fds || 1;
    return s.min_profissionais_diurno || 1;
  };

  const saveUnit = useMutation({
    mutationFn: async (form: typeof unitForm) => {
      const payload = { nome: form.nome, tipo: form.tipo, endereco: form.endereco || null, telefone: form.telefone || null };
      if (editingUnitId) {
        const { error } = await supabase.from('units').update(payload).eq('id', editingUnitId);
        if (error) throw error;
        await logAudit('Unidade editada', 'setores', { id: editingUnitId, nome: form.nome });
      } else {
        const { error } = await supabase.from('units').insert(payload);
        if (error) throw error;
        await logAudit('Unidade criada', 'setores', { nome: form.nome });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); toast.success(editingUnitId ? 'Unidade atualizada!' : 'Unidade criada!'); setUnitModal(false); setEditingUnitId(null); setUnitForm({ nome: '', tipo: 'hospital', endereco: '', telefone: '' }); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('units').delete().eq('id', id); if (error) throw error; await logAudit('Unidade excluída', 'setores', { id }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units'] }); toast.success('Unidade excluída!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const saveSector = useMutation({
    mutationFn: async (form: typeof sectorForm) => {
      const payload = { nome: form.nome, unidade_id: form.unidade_id, min_profissionais_diurno: form.min_profissionais_diurno, min_profissionais_noturno: form.min_profissionais_noturno, min_profissionais_fds: form.min_profissionais_fds };
      if (editingSectorId) {
        const { error } = await supabase.from('sectors').update(payload).eq('id', editingSectorId);
        if (error) throw error;
        await logAudit('Setor editado', 'setores', { id: editingSectorId });
      } else {
        const { error } = await supabase.from('sectors').insert(payload);
        if (error) throw error;
        await logAudit('Setor criado', 'setores', { nome: form.nome });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success(editingSectorId ? 'Setor atualizado!' : 'Setor criado!'); setSectorModal(false); setEditingSectorId(null); setSectorForm({ nome: '', unidade_id: '', min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 }); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const deleteSector = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('sectors').delete().eq('id', id); if (error) throw error; await logAudit('Setor excluído', 'setores', { id }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor excluído!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  const getCoverageBadge = (sector: SectorRow) => {
    const cov = coverageBySector[sector.id] || { confirmados: 0, pendentes: 0, total: 0 };
    const min = getMinForSector(sector);
    const ativo = cov.confirmados + cov.pendentes;
    const faltando = Math.max(0, min - ativo);
    if (ativo === 0) return { color: 'bg-destructive/10 text-destructive border-destructive/20', label: `Descoberto (0/${min})`, icon: AlertTriangle };
    if (faltando > 0) return { color: 'bg-warning/10 text-warning border-warning/20', label: `Falta ${faltando} (${ativo}/${min})`, icon: AlertTriangle };
    return { color: 'bg-success/10 text-success border-success/20', label: `Coberto (${ativo}/${min})`, icon: CheckCircle2 };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Setores e Unidades</h1>
        <p className="text-muted-foreground text-sm mt-1">Cobertura em tempo real · {Object.values(coverageBySector).reduce((a, b) => a + b.total, 0)} plantões hoje</p>
      </div>

      {/* Units */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Unidades de Saúde</h2>
          <button onClick={() => { setUnitForm({ nome: '', tipo: 'hospital', endereco: '', telefone: '' }); setEditingUnitId(null); setUnitModal(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" /> Nova Unidade</button>
        </div>
        {loadingUnits || loadingSectors ? <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {units.map((u: any, i: number) => {
              const unitSectors = sectors.filter((s: SectorRow) => s.unidade_id === u.id);
              const isExpanded = expandedUnit[u.id];
              const totalCoverage = unitSectors.reduce((acc, s) => {
                const cov = coverageBySector[s.id] || { confirmados: 0, pendentes: 0, total: 0 };
                return { conf: acc.conf + cov.confirmados, pend: acc.pend + cov.pendentes, min: acc.min + getMinForSector(s) };
              }, { conf: 0, pend: 0, min: 0 });
              const totalAtivo = totalCoverage.conf + totalCoverage.pend;
              const unitOk = totalAtivo >= totalCoverage.min;

              return (
                <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-xl border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0"><Building2 className="h-5 w-5 text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display font-semibold text-foreground truncate">{u.nome}</h3>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="status-badge bg-info/10 text-info text-[10px]">{u.tipo}</span>
                            <span className={`status-badge text-[10px] border ${unitOk ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                              {totalAtivo}/{totalCoverage.min} hoje
                            </span>
                          </div>
                          {u.endereco && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{u.endereco}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{unitSectors.length} setores</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingUnitId(u.id); setUnitForm({ nome: u.nome, tipo: u.tipo, endereco: u.endereco || '', telefone: u.telefone || '' }); setUnitModal(true); }} className="p-1.5 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><button className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir unidade?</AlertDialogTitle><AlertDialogDescription>Todos os setores vinculados serão afetados.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={deleteUnit.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteUnit.isPending} onClick={(e) => { e.preventDefault(); if (!deleteUnit.isPending) deleteUnit.mutate(u.id); }}>{deleteUnit.isPending ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {unitSectors.length > 0 && (
                      <button onClick={() => setExpandedUnit(p => ({ ...p, [u.id]: !p[u.id] }))}
                        className="mt-3 w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1.5 border-t border-border pt-3">
                        <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Setores ({unitSectors.length})</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {isExpanded && unitSectors.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-muted/30 border-t border-border">
                        <div className="p-4 space-y-2">
                          {unitSectors.map((s: SectorRow) => {
                            const cov = coverageBySector[s.id] || { confirmados: 0, pendentes: 0, total: 0 };
                            const badge = getCoverageBadge(s);
                            const BadgeIcon = badge.icon;
                            return (
                              <div key={s.id} className="bg-background rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-foreground">{s.nome}</span>
                                    <span className={`status-badge text-[10px] border ${badge.color}`}>
                                      <BadgeIcon className="h-3 w-3 mr-1" />{badge.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-success" /> {cov.confirmados} confirmados</span>
                                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {cov.pendentes} pendentes</span>
                                    <span className="font-mono">D:{s.min_profissionais_diurno || 1} N:{s.min_profissionais_noturno || 1} FDS:{s.min_profissionais_fds || 1}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => { setEditingSectorId(s.id); setSectorForm({ nome: s.nome, unidade_id: s.unidade_id, min_profissionais_diurno: s.min_profissionais_diurno || 1, min_profissionais_noturno: s.min_profissionais_noturno || 1, min_profissionais_fds: s.min_profissionais_fds || 1 }); setSectorModal(true); }} className="p-1.5 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild><button className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></AlertDialogTrigger>
                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir setor?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter><AlertDialogCancel disabled={deleteSector.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteSector.isPending} onClick={(e) => { e.preventDefault(); if (!deleteSector.isPending) deleteSector.mutate(s.id); }}>{deleteSector.isPending ? 'Excluindo...' : 'Excluir'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            );
                          })}
                          <button onClick={() => { setSectorForm({ nome: '', unidade_id: u.id, min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 }); setEditingSectorId(null); setSectorModal(true); }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <Plus className="h-3.5 w-3.5" /> Adicionar setor
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
            {units.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhuma unidade cadastrada.</p>}
          </div>
        )}
      </div>

      {/* Unit Modal */}
      <Dialog open={unitModal} onOpenChange={setUnitModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingUnitId ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle><DialogDescription>Preencha os dados da unidade de saúde.</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveUnit.mutate(unitForm); }} className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Nome *</label><input required value={unitForm.nome} onChange={e => setUnitForm(f => ({ ...f, nome: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Tipo</label>
              <select value={unitForm.tipo} onChange={e => setUnitForm(f => ({ ...f, tipo: e.target.value }))} className={inputClass}>
                <option value="hospital">Hospital</option><option value="upa">UPA</option><option value="maternidade">Maternidade</option><option value="clinica">Clínica</option><option value="pronto_atendimento">Pronto Atendimento</option>
              </select></div>
            <div><label className="text-sm font-medium text-foreground">Endereço</label><input value={unitForm.endereco} onChange={e => setUnitForm(f => ({ ...f, endereco: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Telefone</label><input value={unitForm.telefone} onChange={e => setUnitForm(f => ({ ...f, telefone: e.target.value }))} className={inputClass} /></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setUnitModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveUnit.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saveUnit.isPending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sector Modal */}
      <Dialog open={sectorModal} onOpenChange={setSectorModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSectorId ? 'Editar Setor' : 'Novo Setor'}</DialogTitle><DialogDescription>Cobertura mínima determina alertas de descobertura.</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveSector.mutate(sectorForm); }} className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Nome *</label><input required value={sectorForm.nome} onChange={e => setSectorForm(f => ({ ...f, nome: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Unidade *</label>
              <select required value={sectorForm.unidade_id} onChange={e => setSectorForm(f => ({ ...f, unidade_id: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select></div>
            <div className="border-t border-border pt-3">
              <p className="text-sm font-semibold text-foreground mb-2">Cobertura Mínima</p>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground">Diurno</label><input type="number" min={0} value={sectorForm.min_profissionais_diurno} onChange={e => setSectorForm(f => ({ ...f, min_profissionais_diurno: parseInt(e.target.value) || 0 }))} className={inputClass} /></div>
                <div><label className="text-xs text-muted-foreground">Noturno</label><input type="number" min={0} value={sectorForm.min_profissionais_noturno} onChange={e => setSectorForm(f => ({ ...f, min_profissionais_noturno: parseInt(e.target.value) || 0 }))} className={inputClass} /></div>
                <div><label className="text-xs text-muted-foreground">FDS</label><input type="number" min={0} value={sectorForm.min_profissionais_fds} onChange={e => setSectorForm(f => ({ ...f, min_profissionais_fds: parseInt(e.target.value) || 0 }))} className={inputClass} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setSectorModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveSector.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saveSector.isPending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
