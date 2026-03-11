import { units, sectors } from "@/data/mockData";
import { Building2, MapPin, Layers } from "lucide-react";
import { motion } from "framer-motion";

export default function SetoresPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Setores e Unidades</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie unidades de saúde e seus setores</p>
      </div>

      <div>
        <h2 className="font-display font-semibold text-foreground text-lg mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" /> Unidades de Saúde
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {units.map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{u.nome}</h3>
                  <span className="status-badge bg-info/10 text-info text-[10px] mt-1">{u.tipo}</span>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{u.endereco}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sectors.filter(s => s.unidadeId === u.id).length} setores
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display font-semibold text-foreground text-lg mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-accent" /> Setores
        </h2>
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-[var(--shadow-card)]">
          <table className="w-full text-sm">
            <thead><tr className="table-header"><th className="text-left p-3">Setor</th><th className="text-left p-3">Unidade</th></tr></thead>
            <tbody>
              {sectors.map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">{s.nome}</td>
                  <td className="p-3 text-muted-foreground">{s.unidadeNome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
