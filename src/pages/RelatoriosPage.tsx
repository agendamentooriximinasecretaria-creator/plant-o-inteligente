import { FileText, Download } from "lucide-react";
import { motion } from "framer-motion";

const reports = [
  { id: 'r1', nome: 'Relatório de Escala por Período', descricao: 'Visualize todos os plantões organizados por período', icon: '📋' },
  { id: 'r2', nome: 'Relatório Financeiro por Profissional', descricao: 'Detalhamento financeiro individual', icon: '💰' },
  { id: 'r3', nome: 'Relatório Financeiro por Setor', descricao: 'Custos agrupados por setor', icon: '🏥' },
  { id: 'r4', nome: 'Relatório de Trocas', descricao: 'Histórico completo de trocas de plantão', icon: '🔄' },
  { id: 'r5', nome: 'Relatório de Conflitos', descricao: 'Conflitos detectados e resoluções', icon: '⚠️' },
  { id: 'r6', nome: 'Relatório de Plantões Concluídos', descricao: 'Plantões realizados com sucesso', icon: '✅' },
  { id: 'r7', nome: 'Relatório de Plantões Cancelados', descricao: 'Plantões que foram cancelados', icon: '❌' },
  { id: 'r8', nome: 'Relatório de Produtividade', descricao: 'Produtividade por profissional', icon: '📊' },
];

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-1">Gere e exporte relatórios gerenciais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow">
            <div className="flex items-start gap-4">
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-foreground">{r.nome}</h3>
                <p className="text-sm text-muted-foreground mt-1">{r.descricao}</p>
                <div className="flex gap-2 mt-4">
                  {['PDF', 'Excel', 'CSV'].map(f => (
                    <button key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors">
                      <Download className="h-3 w-3" /> {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
