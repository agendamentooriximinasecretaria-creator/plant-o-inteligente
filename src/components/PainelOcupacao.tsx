import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { dispatchNotification } from "@/lib/notifyHelper";
import { logAudit } from "@/lib/auditLog";
import { abrirWhatsApp } from "@/utils/contato";
import { motion } from "framer-motion";

const nivelConfig: Record<string, { cor: string; bg: string; label: string; icone: string; border: string }> = {
  normal:      { cor: 'hsl(var(--success))',      bg: 'bg-success/10',      label: 'Normal',       icone: '🟢', border: 'border-success/40' },
  atencao:     { cor: 'hsl(var(--warning))',      bg: 'bg-warning/10',      label: 'Atenção',      icone: '🟡', border: 'border-warning/40' },
  lotado:      { cor: 'hsl(var(--destructive))',  bg: 'bg-destructive/10',  label: 'Lotado',       icone: '🔴', border: 'border-destructive/40' },
  superlotado: { cor: 'hsl(var(--accent))',       bg: 'bg-accent/10',       label: 'Superlotado',  icone: '🆘', border: 'border-accent/40' },
};

export function PainelOcupacao() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: ocupacoes = [], refetch } = useQuery({
    queryKey: ["setor-ocupacao"],
    queryFn: async () => {
      const { data } = await supabase
        .from("setor_ocupacao")
        .select("*, sectors:setor_id(id, nome)")
        .order("nivel", { ascending: false });
      return (data || []) as any[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("ocupacao-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "setor_ocupacao" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const [editOcupacao, setEditOcupacao] = useState<any | null>(null);
  const [reforcoSetor, setReforcoSetor] = useState<any | null>(null);

  const setoresLotados = ocupacoes.filter((o) => o.nivel === "lotado" || o.nivel === "superlotado");

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kpi-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">🏥 Ocupação em Tempo Real</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {setoresLotados.length > 0
                ? `⚠️ ${setoresLotados.length} setor(es) com alta demanda`
                : "✅ Todos os setores dentro do normal"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditOcupacao(ocupacoes[0] || true)}>
            Atualizar ocupação
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ocupacoes.map((o) => {
            const cfg = nivelConfig[o.nivel] || nivelConfig.normal;
            const pct = o.capacidade_maxima > 0 ? Math.round((o.pacientes_atual / o.capacidade_maxima) * 100) : 0;
            return (
              <div
                key={o.id}
                className={`rounded-lg p-3 border-2 ${cfg.border} ${cfg.bg} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => setEditOcupacao(o)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-foreground truncate">{o.sectors?.nome}</span>
                  <span className="text-lg">{cfg.icone}</span>
                </div>
                <Progress value={Math.min(pct, 100)} className="h-2 mb-1" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{o.pacientes_atual}/{o.capacidade_maxima} pac.</span>
                  <span className="text-xs font-bold" style={{ color: cfg.cor }}>{pct}%</span>
                </div>
                {(o.nivel === "lotado" || o.nivel === "superlotado") && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="mt-2 w-full text-xs h-7"
                    onClick={(e) => { e.stopPropagation(); setReforcoSetor(o); }}
                  >
                    🆘 Acionar Reforço
                  </Button>
                )}
              </div>
            );
          })}
          {ocupacoes.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-4">Nenhum setor configurado.</p>
          )}
        </div>
      </motion.div>

      {editOcupacao && (
        <ModalAtualizarOcupacao
          ocupacoes={ocupacoes}
          onClose={() => setEditOcupacao(null)}
          userId={user?.id}
          qc={qc}
        />
      )}

      {reforcoSetor && (
        <ModalAcionarReforco
          setorLotado={reforcoSetor}
          onClose={() => setReforcoSetor(null)}
          userId={user?.id}
          qc={qc}
        />
      )}
    </>
  );
}

/* ─── Modal: Atualizar Ocupação ─── */
function ModalAtualizarOcupacao({ ocupacoes, onClose, userId, qc }: { ocupacoes: any[]; onClose: () => void; userId?: string; qc: any }) {
  const [inputs, setInputs] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    ocupacoes.forEach((o) => { m[o.setor_id] = o.pacientes_atual; });
    return m;
  });

  const calcNivel = (qtd: number, max: number) => {
    const pct = (qtd / Math.max(max, 1)) * 100;
    if (pct <= 60) return "normal";
    if (pct <= 80) return "atencao";
    if (pct <= 100) return "lotado";
    return "superlotado";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      for (const o of ocupacoes) {
        const pacientes = inputs[o.setor_id] ?? o.pacientes_atual;
        const novoNivel = calcNivel(pacientes, o.capacidade_maxima);
        const nivelAnterior = o.nivel;

        await supabase.from("setor_ocupacao").update({
          pacientes_atual: pacientes,
          nivel: novoNivel,
          atualizado_por: userId,
          updated_at: new Date().toISOString(),
        }).eq("setor_id", o.setor_id);

        // History log
        await supabase.from("historico_ocupacao").insert({
          setor_id: o.setor_id,
          nivel: novoNivel,
          pacientes,
        } as any);

        // Notify if became critical
        if ((novoNivel === "lotado" || novoNivel === "superlotado") && nivelAnterior !== novoNivel) {
          const icon = novoNivel === "superlotado" ? "🆘" : "🔴";
          const label = novoNivel === "superlotado" ? "SUPERLOTAÇÃO" : "LOTADO";
          await dispatchNotification({
            userId,
            tipo: "sistema",
            titulo: `${icon} ${o.sectors?.nome} — ${label}`,
            mensagem: `${pacientes} pacientes (${Math.round((pacientes / o.capacidade_maxima) * 100)}% da capacidade)`,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setor-ocupacao"] });
      toast.success("Ocupação atualizada!");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🏥 Atualizar Ocupação dos Setores</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {ocupacoes.map((o) => {
            const val = inputs[o.setor_id] ?? 0;
            const nivel = calcNivel(val, o.capacidade_maxima);
            const cfg = nivelConfig[nivel];
            return (
              <div key={o.setor_id} className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground flex-1 truncate">{o.sectors?.nome}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setInputs((p) => ({ ...p, [o.setor_id]: Math.max(0, (p[o.setor_id] ?? 0) - 1) }))}>−</Button>
                  <Input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => setInputs((p) => ({ ...p, [o.setor_id]: parseInt(e.target.value) || 0 }))}
                    className="w-16 text-center h-8"
                  />
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setInputs((p) => ({ ...p, [o.setor_id]: (p[o.setor_id] ?? 0) + 1 }))}>+</Button>
                </div>
                <span className="text-sm">{cfg.icone}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Modal: Acionar Reforço ─── */
function ModalAcionarReforco({ setorLotado, onClose, userId, qc }: { setorLotado: any; onClose: () => void; userId?: string; qc: any }) {
  const [selecionados, setSelecionados] = useState<any[]>([]);
  const [motivo, setMotivo] = useState("");
  const [prioridade, setPrioridade] = useState<"normal" | "alta" | "critica">("alta");
  const [enviando, setEnviando] = useState(false);

  const hoje = new Date().toISOString().split("T")[0];
  const horaAtual = new Date().toTimeString().slice(0, 5);

  const { data: emPlantao = [] } = useQuery({
    queryKey: ["reforco-em-plantao", setorLotado.setor_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("shifts")
        .select("id, setor_id, professionals:profissional_id(id, nome, profissao, telefone, user_id), sectors:setor_id(nome)")
        .eq("data", hoje)
        .neq("setor_id", setorLotado.setor_id)
        .neq("status", "cancelado")
        .lte("hora_inicio", horaAtual)
        .gte("hora_fim", horaAtual);
      return (data || []).map((s: any) => ({
        ...s.professionals,
        situacao: "em_plantao",
        setor_atual: s.sectors?.nome || "—",
        setor_atual_id: s.setor_id,
      }));
    },
  });

  const { data: deFolga = [] } = useQuery({
    queryKey: ["reforco-de-folga", setorLotado.setor_id],
    queryFn: async () => {
      const { data: todos } = await supabase.from("professionals_safe").select("id, nome, profissao, telefone, user_id").eq("status", "ativo");
      const { data: hojeShifts } = await supabase.from("shifts").select("profissional_id").eq("data", hoje).neq("status", "cancelado");
      const idsEmPlantao = new Set((hojeShifts || []).map((s: any) => s.profissional_id));
      return (todos || []).filter((p: any) => !idsEmPlantao.has(p.id)).map((p: any) => ({ ...p, situacao: "folga", setor_atual: "Folga" }));
    },
  });

  const toggle = (prof: any) => {
    setSelecionados((prev) => prev.find((p) => p.id === prof.id) ? prev.filter((p) => p.id !== prof.id) : [...prev, prof]);
  };

  const enviar = async () => {
    if (selecionados.length === 0) return toast.error("Selecione pelo menos um profissional");
    if (motivo.length < 10) return toast.error("Descreva o motivo (mín. 10 caracteres)");
    setEnviando(true);
    try {
      for (const prof of selecionados) {
        const { data: ac } = await supabase.from("acionamentos_reforco").insert({
          setor_origem_id: setorLotado.setor_id,
          setor_destino_id: prof.setor_atual_id || null,
          profissional_id: prof.id,
          acionado_por: userId,
          motivo,
          prioridade,
          status: "aguardando",
        } as any).select().single();

        // Notification
        await dispatchNotification({
          professionalId: prof.id,
          userId: prof.user_id,
          tipo: "reforco_solicitado",
          titulo: prioridade === "critica"
            ? `🆘 URGENTE — Reforço no ${setorLotado.sectors?.nome}`
            : `⚠️ Reforço solicitado — ${setorLotado.sectors?.nome}`,
          mensagem: `${motivo}\n\nDirija-se ao ${setorLotado.sectors?.nome} o mais breve possível.`,
        });

        // WhatsApp via wa.me
        if (prof.telefone) {
          const primeiroNome = prof.nome.split(" ")[0];
          abrirWhatsApp(prof.telefone, prof.nome, {
            tipo: "urgencia",
            setor: setorLotado.sectors?.nome,
          });
        }

        // Audit
        await logAudit("Reforço acionado", "acionamentos", {
          setor_lotado: setorLotado.sectors?.nome,
          profissional: prof.nome,
          prioridade,
          motivo,
          acionamento_id: ac?.id,
        });
      }
      qc.invalidateQueries({ queryKey: ["acionamentos-reforco"] });
      toast.success(`✅ ${selecionados.length} profissional(is) acionado(s)!`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const prioridadeOpts = [
    { value: "normal" as const, label: "🟡 Normal", active: "bg-warning/20 border-warning" },
    { value: "alta" as const, label: "🔴 Alta", active: "bg-destructive/20 border-destructive" },
    { value: "critica" as const, label: "🆘 Crítica", active: "bg-accent/20 border-accent" },
  ];

  const renderList = (list: any[], label: string, icon: string, badgeVariant: "default" | "secondary") => (
    list.length > 0 && (
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">{icon} {label}</p>
        <div className="space-y-2">
          {list.map((prof) => {
            const selected = selecionados.find((p) => p.id === prof.id);
            return (
              <div
                key={prof.id}
                onClick={() => toggle(prof)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                  {selected && <span className="text-primary-foreground text-xs">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{prof.nome}</p>
                  <p className="text-xs text-muted-foreground">{prof.profissao}</p>
                  {prof.situacao === "em_plantao" && <p className="text-xs text-info font-medium">📍 Atualmente em: {prof.setor_atual}</p>}
                </div>
                <Badge variant={badgeVariant} className="text-xs shrink-0">
                  {prof.situacao === "em_plantao" ? "Em plantão" : "Folga"}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    )
  );

  const pct = setorLotado.capacidade_maxima > 0 ? Math.round((setorLotado.pacientes_atual / setorLotado.capacidade_maxima) * 100) : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-destructive text-destructive-foreground p-4 rounded-t-lg">
          <h2 className="text-lg font-bold">🆘 Acionar Reforço</h2>
          <p className="text-sm opacity-80">
            {setorLotado.sectors?.nome} — {setorLotado.pacientes_atual} pacientes ({pct}% da capacidade)
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Priority */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Nível de Prioridade:</label>
            <div className="flex gap-2">
              {prioridadeOpts.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPrioridade(p.value)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-bold transition-all ${prioridade === p.value ? p.active : "bg-muted/30 border-border"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm font-semibold text-foreground block mb-1">Motivo do acionamento: *</label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Alta demanda no PS, 18 pacientes, 2 casos graves..."
              className="resize-none h-20"
            />
          </div>

          {/* Professionals */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground block">Selecionar profissional(is):</label>
            {renderList(emPlantao, "EM PLANTÃO AGORA (outros setores)", "🏥", "default")}
            {renderList(deFolga, "DE FOLGA HOJE", "🏠", "secondary")}
            {emPlantao.length === 0 && deFolga.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum profissional disponível.</p>
            )}
          </div>

          {/* Summary */}
          {selecionados.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <p className="text-sm font-semibold text-foreground">📋 Resumo:</p>
              <p className="text-xs text-muted-foreground mt-1">• {selecionados.length} profissional(is) serão notificados</p>
              <p className="text-xs text-muted-foreground">• Notificação interna imediata + WhatsApp</p>
              <p className="text-xs text-muted-foreground">• Registro em auditoria</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={selecionados.length === 0 || motivo.length < 10 || enviando}
              onClick={enviar}
            >
              {enviando ? "Enviando..." : `🆘 Acionar ${selecionados.length > 0 ? `(${selecionados.length})` : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
