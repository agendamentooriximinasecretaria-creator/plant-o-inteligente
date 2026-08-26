import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { Plus, Trash2, Edit, Save, X, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ADN_MODO_OPTIONS, normalizeAdnModo, type AdnModo } from "@/lib/adn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface ShiftInterval {
  inicio: string;
  fim: string;
}

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
  adn_modo?: AdnModo;
  intervalos?: ShiftInterval[] | null;
}


/** Faixas normalizadas de um tipo (fallback para hora_inicio/hora_fim em tipos antigos). */
export function getIntervalos(t: Partial<ShiftType>): ShiftInterval[] {
  const arr = Array.isArray(t.intervalos) ? t.intervalos.filter(i => i?.inicio && i?.fim) : [];
  if (arr.length > 0) return arr.map(i => ({ inicio: i.inicio.slice(0, 5), fim: i.fim.slice(0, 5) }));
  if (t.hora_inicio && t.hora_fim) return [{ inicio: t.hora_inicio.slice(0, 5), fim: t.hora_fim.slice(0, 5) }];
  return [];
}

const COR_OPTIONS = [
  { value: 'success', label: 'Verde (Diurno)' },
  { value: 'primary', label: 'Azul (Noturno)' },
  { value: 'warning', label: 'Amarelo (Curto)' },
  { value: 'destructive', label: 'Vermelho (24h)' },
  { value: 'accent', label: 'Roxo (Especial)' },
  { value: 'muted', label: 'Cinza (Outros)' },
  { value: 'teal', label: 'Verde-água (Sobreaviso)' },
  { value: 'sky', label: 'Azul claro (Manhã)' },
  { value: 'indigo', label: 'Índigo (Tarde)' },
  { value: 'violet', label: 'Violeta (Turno partido)' },
  { value: 'fuchsia', label: 'Magenta (Extra)' },
  { value: 'pink', label: 'Rosa (Ambulatório)' },
  { value: 'rose', label: 'Rosé (Urgência)' },
  { value: 'orange', label: 'Laranja (Reforço)' },
  { value: 'amber', label: 'Âmbar (Treinamento)' },
  { value: 'lime', label: 'Lima (Apoio)' },
  { value: 'emerald', label: 'Esmeralda (Consulta)' },
  { value: 'cyan', label: 'Ciano (Telemedicina)' },
  { value: 'slate', label: 'Grafite (Administrativo)' },
  { value: 'stone', label: 'Pedra (Neutro)' },
];

const COLOR_DOT_MAP: Record<string, string> = {
  success: 'bg-success', primary: 'bg-primary', warning: 'bg-warning',
  destructive: 'bg-destructive', accent: 'bg-accent', muted: 'bg-muted-foreground',
  teal: 'bg-teal-500', sky: 'bg-sky-500', indigo: 'bg-indigo-500',
  violet: 'bg-violet-500', fuchsia: 'bg-fuchsia-500', pink: 'bg-pink-500',
  rose: 'bg-rose-500', orange: 'bg-orange-500', amber: 'bg-amber-500',
  lime: 'bg-lime-500', emerald: 'bg-emerald-500', cyan: 'bg-cyan-500',
  slate: 'bg-slate-500', stone: 'bg-stone-500',
};

const colorDot = (cor: string) => COLOR_DOT_MAP[cor] || 'bg-muted-foreground';


const calcCarga = (ini: string, fim: string): number => {
  if (!ini || !fim) return 0;
  const [hi, mi] = ini.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  let mins = (hf * 60 + mf) - (hi * 60 + mi);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 10) / 10;
};

const sumCarga = (ints: ShiftInterval[]) =>
  Math.round(ints.reduce((acc, i) => acc + calcCarga(i.inicio, i.fim), 0) * 10) / 10;

const toMin = (h: string) => {
  const [a, b] = h.split(':').map(Number);
  return (a || 0) * 60 + (b || 0);
};

/** Retorna mensagem de erro se as faixas forem inválidas ou sobrepostas. */
const validarIntervalos = (ints: ShiftInterval[]): string | null => {
  if (ints.length === 0) return 'Informe ao menos uma faixa de horário.';
  for (const i of ints) {
    if (!i.inicio || !i.fim) return 'Preencha início e fim de todas as faixas.';
    if (calcCarga(i.inicio, i.fim) === 0) return 'Faixa de horário inválida (início igual ao fim).';
  }
  const ranges = ints.map(i => {
    const s = toMin(i.inicio);
    let e = toMin(i.fim);
    if (e <= s) e += 24 * 60;
    return { s, e };
  });
  for (let a = 0; a < ranges.length; a++) {
    for (let b = a + 1; b < ranges.length; b++) {
      const overlap = Math.min(ranges[a].e, ranges[b].e) - Math.max(ranges[a].s, ranges[b].s);
      if (overlap > 0) return 'As faixas de horário não podem se sobrepor.';
    }
  }
  return null;
};

const empty: Omit<ShiftType, 'id'> = {
  nome: '', sigla: '', hora_inicio: '07:00', hora_fim: '19:00',
  carga_horaria: 12, cor: 'primary', ordem: 0, ativo: true, gera_adicional_noturno: false,
  adn_modo: 'nunca',
  intervalos: [{ inicio: '07:00', fim: '19:00' }],
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
      const ints = (payload.intervalos || []).filter(i => i.inicio && i.fim);
      const erro = validarIntervalos(ints);
      if (erro) throw new Error(erro);
      const cargaCalc = sumCarga(ints);
      const modo: AdnModo = payload.adn_modo || 'nunca';
      const data = {
        ...payload,
        intervalos: ints,
        hora_inicio: ints[0].inicio,
        hora_fim: ints[ints.length - 1].fim,
        carga_horaria: payload.carga_horaria || cargaCalc,
        adn_modo: modo,
        gera_adicional_noturno: modo !== 'nunca',
      };

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
      intervalos: getIntervalos(t),
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
                  <td className="py-2 px-2 font-mono text-xs text-muted-foreground">
                    {getIntervalos(t).map(i => `${i.inicio}–${i.fim}`).join(' + ')}
                  </td>
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
                <label className="text-sm font-medium text-foreground">Sigla * <span className="text-xs text-muted-foreground">(1-10 chars)</span></label>
                <input required maxLength={10} value={form.sigla} onChange={e => setForm(f => ({ ...f, sigla: e.target.value.toUpperCase() }))} placeholder="D12" className={inputClass} />

              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Cor no calendário</label>
                <select value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))} className={inputClass}>
                  {COR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium text-foreground">Horários *</label>
                {(form.intervalos || []).map((iv, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1">
                      <span className="text-[11px] text-muted-foreground">Início</span>
                      <input required type="time" value={iv.inicio}
                        onChange={e => {
                          const v = e.target.value;
                          setForm(f => {
                            const ints = (f.intervalos || []).map((x, i) => i === idx ? { ...x, inicio: v } : x);
                            return { ...f, intervalos: ints, carga_horaria: sumCarga(ints) };
                          });
                        }}
                        className={inputClass} />
                    </div>
                    <div className="flex-1">
                      <span className="text-[11px] text-muted-foreground">Fim</span>
                      <input required type="time" value={iv.fim}
                        onChange={e => {
                          const v = e.target.value;
                          setForm(f => {
                            const ints = (f.intervalos || []).map((x, i) => i === idx ? { ...x, fim: v } : x);
                            return { ...f, intervalos: ints, carga_horaria: sumCarga(ints) };
                          });
                        }}
                        className={inputClass} />
                    </div>
                    <button type="button" title="Remover faixa"
                      disabled={(form.intervalos || []).length <= 1}
                      onClick={() => setForm(f => {
                        const ints = (f.intervalos || []).filter((_, i) => i !== idx);
                        return { ...f, intervalos: ints, carga_horaria: sumCarga(ints) };
                      })}
                      className="p-2 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setForm(f => {
                    const ints = [...(f.intervalos || []), { inicio: '14:00', fim: '18:00' }];
                    return { ...f, intervalos: ints, carga_horaria: sumCarga(ints) };
                  })}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Adicionar horário
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Use mais de uma faixa para turno partido (ex.: 08:00–12:00 + 14:00–18:00).
                </p>
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
              <div className="col-span-2 space-y-3 pt-1">
                <div>
                  <label className="text-sm font-medium text-foreground">Adicional Noturno (ADN)</label>
                  <select
                    value={form.adn_modo || 'auto'}
                    onChange={e => {
                      const v = e.target.value as AdnModo;
                      setForm(f => ({ ...f, adn_modo: v, gera_adicional_noturno: v !== 'nunca' }));
                    }}
                    className={inputClass}
                  >
                    {ADN_MODO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {ADN_MODO_OPTIONS.find(o => o.value === (form.adn_modo || 'auto'))?.hint}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ativo" checked={form.ativo}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="rounded" />
                  <label htmlFor="ativo" className="text-sm text-foreground">Ativo (aparece no formulário)</label>
                </div>
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
