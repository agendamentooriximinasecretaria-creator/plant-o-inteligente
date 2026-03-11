import { swaps } from "@/data/mockData";
import { SWAP_STATUS_LABELS } from "@/types/hospital";
import type { SwapStatus } from "@/types/hospital";
import { ArrowLeftRight, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

const statusStyles: Record<SwapStatus, { class: string; icon: typeof Clock }> = {
  solicitada: { class: 'bg-info/10 text-info', icon: Clock },
  aguardando_resposta: { class: 'bg-warning/10 text-warning', icon: Clock },
  aceita: { class: 'bg-success/10 text-success', icon: CheckCircle2 },
  recusada: { class: 'bg-destructive/10 text-destructive', icon: XCircle },
  aguardando_aprovacao: { class: 'bg-warning/10 text-warning', icon: AlertCircle },
  aprovada: { class: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejeitada: { class: 'bg-destructive/10 text-destructive', icon: XCircle },
  cancelada: { class: 'bg-muted text-muted-foreground', icon: XCircle },
  concluida: { class: 'bg-accent/10 text-accent', icon: CheckCircle2 },
};

export default function TrocasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Trocas de Plantão</h1>
        <p className="text-muted-foreground text-sm mt-1">{swaps.length} trocas registradas</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: swaps.length, color: 'text-primary bg-primary/10' },
          { label: 'Aguardando', value: swaps.filter(s => ['solicitada', 'aguardando_resposta', 'aguardando_aprovacao'].includes(s.status)).length, color: 'text-warning bg-warning/10' },
          { label: 'Aprovadas', value: swaps.filter(s => s.status === 'aprovada' || s.status === 'concluida').length, color: 'text-success bg-success/10' },
          { label: 'Recusadas', value: swaps.filter(s => s.status === 'recusada' || s.status === 'rejeitada').length, color: 'text-destructive bg-destructive/10' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {swaps.map((swap, i) => {
          const style = statusStyles[swap.status];
          const Icon = style.icon;
          return (
            <motion.div
              key={swap.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-lg border border-border p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-lg bg-primary/10">
                    <ArrowLeftRight className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{swap.solicitanteNome}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-foreground">{swap.destinatarioNome || 'Grupo'}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{swap.motivo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado em {new Date(swap.criadoEm).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`status-badge ${style.class}`}>
                    <Icon className="h-3.5 w-3.5 mr-1" />
                    {SWAP_STATUS_LABELS[swap.status]}
                  </span>
                  {['solicitada', 'aguardando_resposta', 'aguardando_aprovacao'].includes(swap.status) && (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-opacity">Aprovar</button>
                      <button className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity">Rejeitar</button>
                    </div>
                  )}
                </div>
              </div>

              {swap.historico.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico</p>
                  <div className="space-y-2">
                    {swap.historico.map((h, j) => (
                      <div key={j} className="flex items-start gap-2 text-xs">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <span className="text-foreground font-medium">{h.acao}</span>
                          <span className="text-muted-foreground"> por {h.usuario}</span>
                          {h.detalhes && <span className="text-muted-foreground"> — {h.detalhes}</span>}
                          <span className="text-muted-foreground block">
                            {new Date(h.dataHora).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
