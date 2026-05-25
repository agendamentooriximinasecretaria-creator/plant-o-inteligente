import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Plus, Trash2, Edit, Save, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface ShiftType {
  id: string;
  nome: string;
  sigla: string;
  hora_inicio: string;
  hora_fim: string;
  carga_horaria: number;
  cor: string;
  ordem: number;
  ativo: boolean;
  gera_adicional_noturno: boolean;
}

const COR_OPTIONS = [
  { value: 'success', label: 'Verde (Diurno)' },
  { value: 'primary', label: 'Azul (Noturno)' },
  { value: 'warning', label: 'Amarelo (Curto)' },
  { value: 'destructive', label: 'Vermelho (24h)' },
  { value: 'accent', label: 'Roxo (Especial)' },
  { value: 'muted', label: 'Cinza (Outros)' },
];

const colorDot = (cor: string) => {
  const map: Record<string, string> = {
    success: 'bg-success', primary: 'bg-primary', warning: 'bg-warning',
    destructive: 'bg-destructive', accent: 'bg-accent', muted: 'bg-muted-foreground',
  };
  return map[cor] || 'bg-muted-foreground';
};

const calcCarga = (ini: string, fim: string): number => {
  if (!ini || !fim) return 0;
  const [hi, mi] = ini.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  let mins = (hf * 60 + mf) - (hi * 60 + mi);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
};

const empty: Omit<ShiftType, 'id'> = {
  nome: '', sigla: '', hora_inicio: '07:00', hora_fim: '19:00',
  carga_horaria: 12, cor: 'primary', ordem: 0, ativo: true, gera_adicional_noturno: false,
};

export function ShiftTypesManager() {
  const sb = supabase as any;
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ShiftType, 'id'>>(empty);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ['shift_types'],
    queryFn: async () => {
      const { data, error } = await sb.from('shift_types').select('*').order('ordem', { ascending: true });
      if (error) throw error;
      return data as ShiftType[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Omit<ShiftType, 'id'>) => {
      const cargaCalc = calcCarga(payload.hora_inicio, payload.hora_fim);
      const data = { ...payload, carga_horaria: payload.carga_horaria || cargaCalc };
      if (editingId) {
        const { error } = await sb.from('shift_types').update(data).eq('id', editingId);
        if (error) throw error;
        await logAudit('Tipo de plantão atualizado', 'configuracoes', { id: editingId, nome: data.nome });
      } else {
        const { error } = await sb.from('shift_types').insert(data);
        if (error) throw error;
        await logAudit('Tipo de plantão criado', 'configuracoes', { nome: data.nome });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift_types'] });
      toast.success(editingId ? 'Tipo atualizado!' : 'Tipo criado!');
      setModalOpen(false); setEditingId(null); setForm(empty);
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('shift_types').delete().eq('id', id);
      if (error) throw error;
      await logAudit('Tipo de plantão excluído', 'configuracoes', { id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shift_types'] });
      toast.success('Tipo excluído');
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...empty, ordem: (tipos.length + 1) });
    setModalOpen(true);
  };

  const openEdit = (t: ShiftType) => {
    setEditingId(t.id);
    setForm({
      nome: t.nome, sigla: t.sigla, hora_inicio: t.hora_inicio.slice(0, 5),
      hora_fim: t.hora_fim.slice(0, 5), carga_horaria: t.carga_horaria,
      cor: t.cor, ordem: t.ordem, ativo: t.ativo,
      gera_adicional_noturno: t.gera_adicional_noturno ?? false,
    });
    setModalOpen(true);
  };

  const inputClass = "w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {tipos.length} tipo(s) cadastrado(s) — usados no formulário de Novo Plantão
        </p>
        <button onClick={openCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="h-4 w-4" /> Novo tipo
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tipos.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Nenhum tipo de plantão cadastrado
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 px-2">Cor</th>
                <th className="text-left font-medium py-2 px-2">Nome</th>
                <th className="text-left font-medium py-2 px-2">Sigla</th>
                <th className="text-left font-medium py-2 px-2">Horário</th>
                <th className="text-left font-medium py-2 px-2">Carga</th>
                <th className="text-left font-medium py-2 px-2">Status</th>
                <th className="text-right font-medium py-2 px-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tipos.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/40">
                  <td className="py-2 px-2"><span className={`inline-block h-3 w-3 rounded-full ${colorDot(t.cor)}`} /></td>
                  <td className="py-2 px-2 font-medium text-foreground">{t.nome}</td>
                  <td className="py-2 px-2"><span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{t.sigla}</span></td>
                  <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{t.hora_inicio.slice(0,5)}–{t.hora_fim.slice(0,5)}</td>
                  <td className="py-2 px-2 text-muted-foreground">{t.carga_horaria}h</td>
                  <td className="py-2 px-2">
                    <span className={`status-badge text-[10px] ${t.ativo ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                      {t.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Editar">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setConfirmDel(t.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? 'Editar Tipo de Plantão' : 'Novo Tipo de Plantão'}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveMut.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-foreground">Nome *</label>
                <input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Diurno 12h" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Sigla * <span className="text-xs text-muted-foreground">(1-3 chars)</span></label>
                <input required maxLength={3} value={form.sigla} onChange={e => setForm(f => ({ ...f, sigla: e.target.value.toUpperCase() }))} placeholder="D" className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Cor no calendário</label>
                <select value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} className={inputClass}>
                  {COR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Hora início *</label>
                <input required type="time" value={form.hora_inicio}
                  onChange={e => { const v = e.target.value; setForm(f => ({ ...f, hora_inicio: v, carga_horaria: calcCarga(v, f.hora_fim) })); }}
                  className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Hora fim *</label>
                <input required type="time" value={form.hora_fim}
                  onChange={e => { const v = e.target.value; setForm(f => ({ ...f, hora_fim: v, carga_horaria: calcCarga(f.hora_inicio, v) })); }}
                  className={inputClass} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Carga horária (h)</label>
                <input type="number" step="0.5" min={0} max={24} value={form.carga_horaria}
                  onChange={e => setForm(f => ({ ...f, carga_horaria: Number(e.target.value) }))} className={inputClass} />
                <p className="text-[11px] text-muted-foreground mt-1">Calculada automaticamente, ajuste se preciso.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Ordem</label>
                <input type="number" min={0} value={form.ordem}
                  onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} className={inputClass} />
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-1">
                <input type="checkbox" id="ativo" checked={form.ativo}
                  onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="rounded" />
                <label htmlFor="ativo" className="text-sm text-foreground">Ativo (aparece no formulário)</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted">
                <X className="h-4 w-4 inline mr-1" /> Cancelar
              </button>
              <button type="submit" disabled={saveMut.isPending} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {saveMut.isPending ? <Loader2 className="h-4 w-4 inline animate-spin mr-1" /> : <Save className="h-4 w-4 inline mr-1" />}
                Salvar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de plantão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Plantões já criados com este tipo não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && delMut.mutate(confirmDel)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
