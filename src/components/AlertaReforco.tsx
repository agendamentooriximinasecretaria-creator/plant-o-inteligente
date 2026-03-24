import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { dispatchNotification } from "@/lib/notifyHelper";
import { logAudit } from "@/lib/auditLog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";

export function AlertaReforco() {
  const { user, professionalId } = useAuth();
  const qc = useQueryClient();

  const { data: acionamentos = [], refetch } = useQuery({
    queryKey: ["meus-acionamentos", professionalId],
    queryFn: async () => {
      if (!professionalId) return [];
      const { data } = await supabase
        .from("acionamentos_reforco")
        .select("*, setor_origem:setor_origem_id(nome), setor_destino:setor_destino_id(nome)")
        .eq("profissional_id", professionalId)
        .eq("status", "aguardando")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!professionalId,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("acionamentos-prof-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "acionamentos_reforco" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const [recusaId, setRecusaId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const responder = async (id: string, resposta: "confirmado" | "recusado", justificativaTexto?: string) => {
    await supabase.from("acionamentos_reforco").update({
      status: resposta,
      resposta_em: new Date().toISOString(),
      justificativa_recusa: resposta === "recusado" ? justificativaTexto : null,
    } as any).eq("id", id);

    const ac = acionamentos.find((a: any) => a.id === id);
    const setorNome = ac?.setor_origem?.nome || "setor";

    // Notify managers
    await dispatchNotification({
      userId: ac?.acionado_por,
      tipo: resposta === "confirmado" ? "reforco_confirmado" : "reforco_recusado",
      titulo: resposta === "confirmado"
        ? `✅ Reforço confirmado — ${setorNome}`
        : `❌ Reforço recusado — ${setorNome}`,
      mensagem: resposta === "confirmado"
        ? `Profissional está se deslocando para o ${setorNome}.`
        : `Motivo: ${justificativaTexto || "Não informado"}`,
    });

    await logAudit(
      resposta === "confirmado" ? "Reforço confirmado" : "Reforço recusado",
      "acionamentos",
      { acionamento_id: id, setor: setorNome }
    );

    qc.invalidateQueries({ queryKey: ["meus-acionamentos"] });
    toast[resposta === "confirmado" ? "success" : "warning"](
      resposta === "confirmado" ? "✅ Confirmado! O gestor foi notificado." : "Recusa registrada."
    );
  };

  const minutosAtras = (dt: string) => {
    const diff = Date.now() - new Date(dt).getTime();
    return Math.max(1, Math.round(diff / 60000));
  };

  if (acionamentos.length === 0) return null;

  return (
    <>
      {acionamentos.map((ac: any) => (
        <motion.div
          key={ac.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive text-destructive-foreground p-4 rounded-xl mb-4 border-2 border-destructive/60 animate-pulse"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">🆘</span>
            <div className="flex-1">
              <p className="font-bold text-lg">
                {ac.prioridade === "critica" ? "ACIONAMENTO CRÍTICO" : "Reforço Solicitado"}
              </p>
              <p className="text-sm opacity-90 mt-1">
                Sua presença é solicitada no <strong>{ac.setor_origem?.nome}</strong>
              </p>
              <p className="text-xs opacity-70 mt-1">Motivo: {ac.motivo}</p>
              <p className="text-xs opacity-70">Solicitado há {minutosAtras(ac.created_at)} min</p>
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <Button
              variant="secondary"
              className="flex-1 font-bold"
              onClick={() => responder(ac.id, "confirmado")}
            >
              ✅ Estou indo agora
            </Button>
            <Button
              variant="outline"
              className="flex-1 font-bold border-destructive-foreground/30 text-destructive-foreground hover:bg-destructive-foreground/10"
              onClick={() => { setRecusaId(ac.id); setJustificativa(""); }}
            >
              ❌ Não posso ir
            </Button>
          </div>
        </motion.div>
      ))}

      <Dialog open={!!recusaId} onOpenChange={() => setRecusaId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Motivo da recusa</DialogTitle>
          </DialogHeader>
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Informe o motivo..."
            className="resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setRecusaId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!justificativa.trim()}
              onClick={() => {
                if (recusaId) responder(recusaId, "recusado", justificativa);
                setRecusaId(null);
              }}
            >
              Confirmar recusa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
