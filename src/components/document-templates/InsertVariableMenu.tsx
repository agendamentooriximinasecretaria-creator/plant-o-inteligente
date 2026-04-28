import { useMemo, useState } from 'react';
import { Search, Copy, Plus, X, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  VARIABLE_CATALOG, CATEGORY_LABEL, VariableCategory, VariableDef,
} from '@/lib/documentVariables';

interface Props {
  /** Filtra para mostrar apenas estas chaves; se vazio mostra todas. */
  allowedKeys?: string[];
  onInsert: (token: string) => void;
  onClose: () => void;
}

const CATEGORY_ORDER: VariableCategory[] = ['institucional', 'profissional', 'plantao', 'escala', 'troca', 'assinatura'];

export function InsertVariableMenu({ allowedKeys, onInsert, onClose }: Props) {
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState<VariableCategory | 'todas'>('todas');

  const list = useMemo(() => {
    let arr = VARIABLE_CATALOG.filter(v => !allowedKeys || allowedKeys.includes(v.key));
    if (activeCat !== 'todas') arr = arr.filter(v => v.category === activeCat);
    if (q.trim()) {
      const s = q.toLowerCase();
      arr = arr.filter(v =>
        v.key.toLowerCase().includes(s) ||
        v.label.toLowerCase().includes(s) ||
        v.description.toLowerCase().includes(s)
      );
    }
    return arr;
  }, [q, activeCat, allowedKeys]);

  const grouped = useMemo(() => {
    const g: Record<VariableCategory, VariableDef[]> = {
      institucional: [], profissional: [], plantao: [], escala: [], troca: [], assinatura: [],
    };
    for (const v of list) g[v.category].push(v);
    return g;
  }, [list]);

  const copy = (key: string) => {
    const token = `{{${key}}}`;
    navigator.clipboard?.writeText(token);
    toast.success(`Copiado: ${token}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-display font-semibold text-foreground">Inserir variável</h3>
            <p className="text-xs text-muted-foreground">Clique em uma variável para inserir no documento. Use a busca para filtrar.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & tabs */}
        <div className="p-3 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)}
              autoFocus placeholder="Buscar por nome, chave ou descrição..."
              className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CatPill label="Todas" active={activeCat === 'todas'} onClick={() => setActiveCat('todas')} />
            {CATEGORY_ORDER.map(c => (
              <CatPill key={c} label={CATEGORY_LABEL[c]} active={activeCat === c} onClick={() => setActiveCat(c)} />
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto p-3 space-y-4">
          {list.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma variável encontrada.</div>
          ) : (
            CATEGORY_ORDER.map(cat => grouped[cat].length > 0 && (
              <div key={cat}>
                {activeCat === 'todas' && (
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-2 px-1">
                    {CATEGORY_LABEL[cat]}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {grouped[cat].map(v => (
                    <div key={v.key}
                      className="group bg-muted/30 hover:bg-muted/60 border border-border rounded-lg p-2.5 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <code className="text-[11px] font-mono bg-card border border-border px-1.5 py-0.5 rounded text-primary">
                              {`{{${v.key}}}`}
                            </code>
                            {v.sensitive && (
                              <span title="Dados sensíveis: requer permissão" className="inline-flex items-center gap-0.5 text-[10px] text-warning">
                                <ShieldAlert className="h-3 w-3" /> sensível
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-medium text-foreground mt-1">{v.label}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-2">{v.description}</div>
                        </div>
                        <div className="flex flex-col gap-1 opacity-70 group-hover:opacity-100 transition">
                          <button onClick={() => copy(v.key)} title="Copiar"
                            className="p-1 rounded hover:bg-card text-muted-foreground hover:text-foreground">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { onInsert(`{{${v.key}}}`); }} title="Inserir no editor"
                            className="p-1 rounded bg-primary text-primary-foreground hover:opacity-90">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CatPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-foreground border-border hover:bg-muted/70'
      }`}>
      {label}
    </button>
  );
}
