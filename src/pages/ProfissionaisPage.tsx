import { useState } from "react";
import { professionals } from "@/data/mockData";
import { PROFISSAO_LABELS } from "@/types/hospital";
import { Search, Plus, Mail, Phone, User2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfissionaisPage() {
  const [search, setSearch] = useState('');
  const [filterProfissao, setFilterProfissao] = useState('');

  const filtered = professionals.filter(p => {
    if (search && !p.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterProfissao && p.profissao !== filterProfissao) return false;
    return true;
  });

  const profissoes = [...new Set(professionals.map(p => p.profissao))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="module-title">Profissionais</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} profissionais cadastrados</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity self-start">
          <Plus className="h-4 w-4" /> Novo Profissional
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text" placeholder="Buscar por nome..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-48 placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={filterProfissao} onChange={e => setFilterProfissao(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as profissões</option>
          {profissoes.map(p => <option key={p} value={p}>{PROFISSAO_LABELS[p]}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-foreground truncate">{p.nome}</h3>
                  <span className={`status-badge text-[10px] ${p.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-sm text-primary font-medium">{PROFISSAO_LABELS[p.profissao]}</p>
                <p className="text-xs text-muted-foreground">{p.especialidade} • {p.registro}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">{p.setorPrincipal}</span>
                  <span className="text-sm font-semibold text-foreground">R$ {p.valorHora}/h</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
