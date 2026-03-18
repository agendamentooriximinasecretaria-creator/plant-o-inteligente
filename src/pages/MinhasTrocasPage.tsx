import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { dispatchNotification } from "@/lib/notifyHelper";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ComprovanteTroca from "@/components/ComprovanteTroca";

const tabs = [
  { id: "solicitar", label: "Solicitar Troca" },
  { id: "recebidas", label: "Trocas Recebidas" },
  { id: "historico", label: "Histórico de Trocas" },
] as const;

export default function MinhasTrocasPage() {
  const sb = supabase as any;
  const qc = useQueryClient();
  const { professionalId } = useAuth();
  const [params, setParams] = useSearchParams();
  const currentTab = (params.get("tab") || "solicitar") as (typeof tabs)[number]["id"];

  const [form, setForm] = useState({
    shift_id: "",
    tipo: "grupo",
    destinatario_id: "",
    motivo: "",
  });
  const [comprovanteId, setComprovanteId] = useState<string | null>(null);

  const { data: settings = {} } = useQuery({
    queryKey: ["professional-swap-settings"],
    queryFn: async () => {
      const { data } = await sb.from("system_settings").select("key, value").eq("key", "conflict_rules").maybeSingle();
      return data?.value || {};
    },
  });

  const needsManagerApproval = (settings as any)?.aprovacao_gestor_trocas ?? true;

  const { data: myShifts = [] } = useQuery({
    queryKey: ["professional-my-shifts-for-swaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, data, hora_inicio, hora_fim, status")
        .neq("status", "cancelado")
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: directory = [] } = useQuery({
    queryKey: ["professional-directory"],
    queryFn: async () => {
      const { data, error } = await sb.rpc("list_professional_directory");
      if (error) throw error;
      return (data || []).filter((p: any) => p.id !== professionalId);
    },
    enabled: !!professionalId,
  });

  const { data: swaps = [] } = useQuery({
    queryKey: ["professional-swaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_swaps")
        .select("id, shift_id, solicitante_id, destinatario_id, status, tipo, motivo, created_at, observacao_gestor, shifts:shift_id(data, hora_inicio, hora_fim), solicitante:solicitante_id(nome), destinatario:destinatario_id(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!professionalId,
  });

  const incoming = useMemo(
    () => swaps.filter((s: any) => s.destinatario_id === professionalId || (s.destinatario_id === null && s.solicitante_id !== professionalId)),
    [swaps, professionalId],
  );

  const history = useMemo(() => swaps.filter((s: any) => ["aceita", "recusada", "aprovada", "rejeitada", "concluida", "cancelada"].includes(s.status)), [swaps]);

  const createSwap = useMutation({
    mutationFn: async () => {
      if (!professionalId) throw new Error("Seu usuário ainda não está vinculado a um profissional.");
      if (!form.shift_id || !form.motivo) throw new Error("Selecione um plantão e informe o motivo.");
      if (form.tipo === "direto" && !form.destinatario_id) throw new Error("Selecione o destinatário da troca direta.");

      const { data: inserted, error } = await supabase
        .from("shift_swaps")
        .insert({
          shift_id: form.shift_id,
          solicitante_id: professionalId,
          destinatario_id: form.tipo === "direto" ? form.destinatario_id : null,
          tipo: form.tipo,
          motivo: form.motivo,
          status: "solicitada",
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("swap_history").insert({
        swap_id: inserted.id,
        acao: "Troca solicitada",
        usuario: "Profissional",
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      // Notify destination or all active professionals
      if (form.tipo === "direto" && form.destinatario_id) {
        await dispatchNotification({ professionalId: form.destinatario_id, tipo: 'troca', titulo: '🔄 Nova solicitação de troca', mensagem: 'Um colega solicitou uma troca de plantão com você.' });
      } else {
        // Group swap - notify all active professionals
        const { data: allProfs } = await supabase.from("professionals").select("id").eq("status", "ativo").neq("id", professionalId!);
        for (const p of allProfs || []) {
          await dispatchNotification({ professionalId: p.id, tipo: 'troca', titulo: '🔄 Plantão disponível para troca', mensagem: 'Um colega disponibilizou um plantão para troca. Verifique na aba Trocas Recebidas.' });
        }
      }
    },
    onSuccess: () => {
      toast.success("Troca solicitada com sucesso.");
      setForm({ shift_id: "", tipo: "grupo", destinatario_id: "", motivo: "" });
      qc.invalidateQueries({ queryKey: ["professional-swaps"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao solicitar troca."),
  });

  const respondSwap = useMutation({
    mutationFn: async ({ swapId, accept }: { swapId: string; accept: boolean }) => {
      if (!professionalId) throw new Error("Profissional não vinculado.");

      const selected = swaps.find((s: any) => s.id === swapId);
      if (!selected) throw new Error("Troca não encontrada.");

      const nextStatus = accept
        ? (needsManagerApproval ? "aguardando_aprovacao" : "aprovada")
        : "recusada";

      const { error: swapError } = await supabase
        .from("shift_swaps")
        .update({ status: nextStatus, destinatario_id: professionalId })
        .eq("id", swapId);

      if (swapError) throw swapError;

      if (accept && !needsManagerApproval) {
        const { error: shiftError } = await supabase
          .from("shifts")
          .update({ profissional_id: professionalId, status: "confirmado" })
          .eq("id", selected.shift_id);

        if (shiftError) throw shiftError;

        await supabase
          .from("shift_swaps")
          .update({ status: "concluida" })
          .eq("id", swapId);
      }

      await supabase.from("swap_history").insert({
        swap_id: swapId,
        acao: accept ? "Troca aceita pelo profissional" : "Troca recusada pelo profissional",
        usuario: "Profissional",
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      // Notify the requesting professional
      await dispatchNotification({
        professionalId: selected.solicitante_id,
        tipo: 'troca',
        titulo: accept ? '✅ Troca aceita' : '❌ Troca recusada',
        mensagem: accept ? 'Sua solicitação de troca foi aceita por um colega.' : 'Sua solicitação de troca foi recusada.',
      });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.accept ? "Troca aceita." : "Troca recusada.");
      qc.invalidateQueries({ queryKey: ["professional-swaps"] });
      qc.invalidateQueries({ queryKey: ["professional-my-shifts-for-swaps"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao responder troca."),
  });

  const setTab = (tab: (typeof tabs)[number]["id"]) => setParams({ tab });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="module-title">Trocas de Plantão</h1>
        <p className="text-sm text-muted-foreground mt-1">Solicite, receba e acompanhe trocas em tempo real.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentTab === "solicitar" && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Plantão a trocar *</label>
            <select
              value={form.shift_id}
              onChange={(e) => setForm((f) => ({ ...f, shift_id: e.target.value }))}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {myShifts.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {new Date(`${s.data}T12:00:00`).toLocaleDateString("pt-BR")} • {s.hora_inicio}-{s.hora_fim}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Tipo de troca *</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, destinatario_id: "" }))}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="grupo">Solicitar para grupo</option>
              <option value="direto">Solicitar para colega específico</option>
            </select>
          </div>

          {form.tipo === "direto" && (
            <div>
              <label className="text-sm font-medium text-foreground">Destinatário *</label>
              <select
                value={form.destinatario_id}
                onChange={(e) => setForm((f) => ({ ...f, destinatario_id: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecione...</option>
                {directory.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">Motivo *</label>
            <textarea
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            onClick={() => createSwap.mutate()}
            disabled={createSwap.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {createSwap.isPending ? "Enviando..." : "Solicitar troca"}
          </button>
        </div>
      )}

      {currentTab === "recebidas" && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nenhuma troca recebida.</p>
          ) : (
            incoming.map((swap: any) => (
              <div key={swap.id} className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <p className="text-sm text-foreground font-medium">{swap.motivo}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(swap.created_at).toLocaleString("pt-BR")} • {swap.status}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Plantão: {new Date(`${(swap.shifts as any)?.data}T12:00:00`).toLocaleDateString("pt-BR")} • {(swap.shifts as any)?.hora_inicio} - {(swap.shifts as any)?.hora_fim}
                </p>
                {swap.status === "solicitada" || swap.status === "aguardando_resposta" ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => respondSwap.mutate({ swapId: swap.id, accept: true })}
                      className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-success-foreground hover:opacity-90"
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => respondSwap.mutate({ swapId: swap.id, accept: false })}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90"
                    >
                      Recusar
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {currentTab === "historico" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Sem histórico de trocas finalizadas.</p>
          ) : (
            history.map((swap: any) => (
              <div key={swap.id} className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <p className="text-sm text-foreground font-medium">{swap.motivo}</p>
                <p className="text-xs text-muted-foreground mt-1">Status: {swap.status}</p>
                {swap.observacao_gestor && <p className="text-xs text-muted-foreground mt-1">Obs. gestor: {swap.observacao_gestor}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
