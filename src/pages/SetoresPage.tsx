import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Building2, MapPin, Layers, Plus, Edit, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function SetoresPage() {
  const qc = useQueryClient();
  const [unitModal, setUnitModal] = useState(false);
  const [sectorModal, setSectorModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({ nome: '', tipo: 'hospital', endereco: '', telefone: '' });
  const [sectorForm, setSectorForm] = useState({ nome: '', unidade_id: '', min_profissionais_diurno: 1, min_profissionais_noturno: 1, min_profissionais_fds: 1 });

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['units'],
    queryFn: async () => { const { data, error } = await supabase.from('units').select('*').order('nome'); if (error) throw error; return data; },
  });

  const { data: sectors = [], isLoading: loadingSectors } = useQuery({
    queryKey: ['sectors'],
    queryFn: async () => { const { data, error } = await supabase.from('sectors').select('*, units:unidade_id(nome)').order('nome'); if (error) throw error; return data; },
  });

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
      const payload = { nome: form.nome, unidade_id: form.unidade_id };
      if (editingSectorId) {
        const { error } = await supabase.from('sectors').update(payload).eq('id', editingSectorId);
        if (error) throw error;
        await logAudit('Setor editado', 'setores', { id: editingSectorId, nome: form.nome });
      } else {
        const { error } = await supabase.from('sectors').insert(payload);
        if (error) throw error;
        await logAudit('Setor criado', 'setores', { nome: form.nome });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success(editingSectorId ? 'Setor atualizado!' : 'Setor criado!'); setSectorModal(false); setEditingSectorId(null); setSectorForm({ nome: '', unidade_id: '' }); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const deleteSector = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('sectors').delete().eq('id', id); if (error) throw error; await logAudit('Setor excluído', 'setores', { id }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sectors'] }); toast.success('Setor excluído!'); },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="space-y-6">
      <div><h1 className="module-title">Setores e Unidades</h1><p className="text-muted-foreground text-sm mt-1">Gerencie unidades de saúde e seus setores</p></div>

      {/* Units */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Unidades de Saúde</h2>
          <button onClick={() => { setUnitForm({ nome: '', tipo: 'hospital', endereco: '', telefone: '' }); setEditingUnitId(null); setUnitModal(true); }} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"><Plus className="h-4 w-4" /> Nova Unidade</button>
        </div>
        {loadingUnits ? <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {units.map((u: any, i: number) => (
              <motion.div key={u.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{u.nome}</h3>
                      <span className="status-badge bg-info/10 text-info text-[10px] mt-1">{u.tipo}</span>
                      {u.endereco && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{u.endereco}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{sectors.filter((s: any) => s.unidade_id === u.id).length} setores</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingUnitId(u.id); setUnitForm({ nome: u.nome, tipo: u.tipo, endereco: u.endereco || '', telefone: u.telefone || '' }); setUnitModal(true); }} className="p-1 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><button className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></AlertDialogTrigger>
                      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir unidade?</AlertDialogTitle><AlertDialogDescription>Todos os setores vinculados serão afetados.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteUnit.mutate(u.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </motion.div>
            ))}
            {units.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhuma unidade cadastrada.</p>}
          </div>
        )}
      </div>

      {/* Sectors */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-foreground text-lg flex items-center gap-2"><Layers className="h-5 w-5 text-accent" /> Setores</h2>
          <button onClick={() => { setSectorForm({ nome: '', unidade_id: units[0]?.id || '' }); setEditingSectorId(null); setSectorModal(true); }} disabled={units.length === 0} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"><Plus className="h-4 w-4" /> Novo Setor</button>
        </div>
        {loadingSectors ? <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></div> : (
          <div className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
            <table className="w-full text-sm">
              <thead><tr className="table-header"><th className="text-left p-3">Setor</th><th className="text-left p-3">Unidade</th><th className="text-left p-3">Ações</th></tr></thead>
              <tbody>
                {sectors.map((s: any) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{s.nome}</td>
                    <td className="p-3 text-muted-foreground">{(s.units as any)?.nome || '—'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingSectorId(s.id); setSectorForm({ nome: s.nome, unidade_id: s.unidade_id }); setSectorModal(true); }} className="p-1 rounded hover:bg-muted"><Edit className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><button className="p-1 rounded hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir setor?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteSector.mutate(s.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
                {sectors.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum setor cadastrado.</td></tr>}
              </tbody>
            </table>
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
              <button type="button" onClick={() => setUnitModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveUnit.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saveUnit.isPending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sector Modal */}
      <Dialog open={sectorModal} onOpenChange={setSectorModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSectorId ? 'Editar Setor' : 'Novo Setor'}</DialogTitle><DialogDescription>Preencha os dados do setor.</DialogDescription></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveSector.mutate(sectorForm); }} className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Nome *</label><input required value={sectorForm.nome} onChange={e => setSectorForm(f => ({ ...f, nome: e.target.value }))} className={inputClass} /></div>
            <div><label className="text-sm font-medium text-foreground">Unidade *</label>
              <select required value={sectorForm.unidade_id} onChange={e => setSectorForm(f => ({ ...f, unidade_id: e.target.value }))} className={inputClass}>
                <option value="">Selecione...</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select></div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setSectorModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saveSector.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">{saveSector.isPending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
