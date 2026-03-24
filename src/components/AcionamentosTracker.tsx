import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const statusConfig: Record<string, { label: string; icon: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aguardando: { label: "Aguardando", icon: "⏳", variant: "secondary" },
  confirmado: { label: "Confirmado", icon: "✅", variant: "default" },
  recusado:   { label: "Recusado",   icon: "❌", variant: "destructive" },
  cancelado:  { label: "Cancelado",  icon: "🚫", variant: "outline" },
  concluido:  { label: "Concluído",  icon: "✔️", variant: "default" },
};

export function AcionamentosTracker() {
  const hoje = new Date().toISOString().split("T")[0];

  const { data: acionamentos = [], refetch } = useQuery({
    queryKey: ["acionamentos-reforco", hoje],
    queryFn: async () => {
      const { data } = await supabase
        .from("acionamentos_reforco")
        .select("*, setor_origem:setor_origem_id(nome), profissional:profissional_id(nome, profissao)")
        .gte("created_at", `${hoje}T00:00:00`)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("acionamentos-tracker-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "acionamentos_reforco" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  if (acionamentos.length === 0) return null;

  // Group by setor_origem + created_at (close timestamps)
  const grouped: Record<string, any[]> = {};
  acionamentos.forEach((a: any) => {
    const key = `${a.setor_origem_id}-${a.created_at.slice(0, 16)}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  });

  const minutosAtras = (dt: string) => {
    const diff = Date.now() - new Date(dt).getTime();
    const min = Math.round(diff / 60000);
    if (min < 60) return `${min} min atrás`;
    return `${Math.round(min / 60)}h atrás`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
      <h3 className="text-base font-semibold text-foreground mb-3">🆘 Acionamentos de Reforço — Hoje</h3>
      <div className="space-y-4">
        {Object.entries(grouped).map(([key, items]) => {
          const first = items[0];
          const hora = new Date(first.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={key} className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-foreground">{hora}</span>
                <span className="text-sm text-muted-foreground">{first.setor_origem?.nome}</span>
                <Badge variant={first.prioridade === "critica" ? "destructive" : "secondary"} className="text-xs">
                  {first.prioridade === "critica" ? "🆘 Crítica" : first.prioridade === "alta" ? "🔴 Alta" : "🟡 Normal"}
                </Badge>
              </div>
              <div className="space-y-1">
                {items.map((a: any) => {
                  const cfg = statusConfig[a.status] || statusConfig.aguardando;
                  return (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{a.profissional?.nome}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={cfg.variant} className="text-xs">{cfg.icon} {cfg.label}</Badge>
                        {a.resposta_em && (
                          <span className="text-xs text-muted-foreground">{minutosAtras(a.resposta_em)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
