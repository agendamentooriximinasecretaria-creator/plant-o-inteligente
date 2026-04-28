import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCrossSwaps } from "@/lib/queryInvalidation";
import { useAuth } from "@/hooks/useAuth";
import { dispatchNotification } from "@/lib/notifyHelper";
import { logAudit } from "@/lib/auditLog";
import { toast } from "sonner";
import { FileText, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ComprovanteTroca from "@/components/ComprovanteTroca";
import SwapAttachmentsSection, { type PendingFile } from "@/components/SwapAttachmentsSection";
import { uploadSwapAttachment } from "@/lib/swapAttachments";
import { useSwapAttachmentSettings, motivoEhSaude, HEALTH_DOC_TYPES } from "@/lib/swapAttachmentSettings";

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
  const [pendingAttachments, setPendingAttachments] = useState<PendingFile[]>([]);
  const [viewAttachmentsId, setViewAttachmentsId] = useState<string | null>(null);

  const { data: settings = {} } = useQuery({
    queryKey: ["professional-swap-settings"],
    queryFn: async () => {
      const { data } = await sb.from("system_settings").select("key, value").eq("key", "conflict_rules").maybeSingle();
      return data?.value || {};
    },
  });

  const needsManagerApproval = (settings as any)?.aprovacao_gestor_trocas ?? true;

  // Fetch own profile to know the personal limits
  const { data: myProfile } = useQuery({
    queryKey: ["my-professional-limits", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data } = await supabase.from("professionals")
        .select("limite_trocas_plantao_mes, limite_trocas_paciente_mes")
        .eq("id", professionalId!)
        .maybeSingle();
      return data;
    },
  });

  // Counter (used in current month)
  const { data: trocasStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["my-trocas-status", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data } = await sb.rpc("get_trocas_status_mes", { _profissional_id: professionalId });
      return data as { used: number; limit: number; remaining: number } | null;
    },
  });

  const limiteAtingido = !!trocasStatus && trocasStatus.remaining <= 0;

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
      if (limiteAtingido) throw new Error("Limite mensal de trocas atingido conforme configuração do sistema.");
      if (!form.shift_id || !form.motivo) throw new Error("Selecione um plantão e informe o motivo.");
      if (form.tipo === "direto" && !form.destinatario_id) throw new Error("Selecione o destinatário da troca direta.");

      // Validações de anexos conforme configuração
      const ehSaude = motivoEhSaude(form.motivo) || pendingAttachments.some((p) => HEALTH_DOC_TYPES.has(p.tipo));
      const obrigatorioAgora =
        attachSettings?.permitir_anexos && (
          attachSettings?.obrigatorio ||
          (attachSettings?.obrigatorio_apenas_saude && ehSaude)
        );
      if (obrigatorioAgora && pendingAttachments.length === 0) {
        throw new Error("É obrigatório anexar documento justificativo para este tipo de troca.");
      }
      if (attachSettings?.exigir_descricao && pendingAttachments.some((p) => !p.descricao.trim())) {
        throw new Error("A descrição é obrigatória em todos os anexos conforme configuração do sistema.");
      }
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

      await logAudit('Solicitação de troca criada', 'trocas', {
        swap_id: inserted.id,
        shift_id: form.shift_id,
        tipo: form.tipo,
        solicitante_id: professionalId,
        destinatario_id: form.tipo === "direto" ? form.destinatario_id : null,
        motivo: form.motivo,
      });

      // Envia anexos pendentes (se houver)
      if (pendingAttachments.length > 0) {
        for (const p of pendingAttachments) {
          try {
            await uploadSwapAttachment({
              trocaId: inserted.id,
              file: p.file,
              tipo: p.tipo,
              descricao: p.descricao,
              professionalId,
            });
          } catch (err: any) {
            toast.error(`Falha ao enviar "${p.file.name}": ${err.message || 'erro desconhecido'}`);
          }
        }
      }

      if (form.tipo === "direto" && form.destinatario_id) {
        await dispatchNotification({ professionalId: form.destinatario_id, tipo: 'troca', titulo: '🔄 Nova solicitação de troca', mensagem: 'Um colega solicitou uma troca de plantão com você.' });
      } else {
        const { data: allProfs } = await supabase.from("professionals_safe").select("id").eq("status", "ativo").neq("id", professionalId!);
        for (const p of allProfs || []) {
          await dispatchNotification({ professionalId: p.id, tipo: 'troca', titulo: '🔄 Plantão disponível para troca', mensagem: 'Um colega disponibilizou um plantão para troca.' });
        }
      }
    },
    onSuccess: () => {
      toast.success("Troca solicitada com sucesso.");
      setForm({ shift_id: "", tipo: "grupo", destinatario_id: "", motivo: "" });
      setPendingAttachments([]);
      qc.invalidateQueries({ queryKey: ["professional-swaps"] });
      invalidateCrossSwaps(qc);
      refetchStatus();
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

      await logAudit(accept ? 'Troca aceita pelo destinatário' : 'Troca recusada pelo destinatário', 'trocas', {
        swap_id: swapId,
        shift_id: selected.shift_id,
        solicitante_id: selected.solicitante_id,
        destinatario_id: professionalId,
        novo_status: nextStatus,
      });

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
      invalidateCrossSwaps(qc);
      refetchStatus();
    },
    onError: (error: any) => toast.error(error.message ?? "Erro ao responder troca."),
  });

  const setTab = (tab: (typeof tabs)[number]["id"]) => setParams({ tab });

  const counterColor = limiteAtingido ? 'bg-destructive/10 text-destructive border-destructive/30'
    : (trocasStatus && trocasStatus.remaining === 1) ? 'bg-warning/10 text-warning border-warning/30'
    : 'bg-success/10 text-success border-success/30';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="module-title">Trocas de Plantão</h1>
          <p className="text-sm text-muted-foreground mt-1">Solicite, receba e acompanhe trocas em tempo real.</p>
        </div>
        {trocasStatus && (
          <div className={`rounded-lg border px-3 py-2 text-sm font-medium ${counterColor}`}>
            Trocas realizadas: <strong>{trocasStatus.used}/{trocasStatus.limit}</strong>
            <span className="block text-[11px] opacity-80">{trocasStatus.remaining} restante(s) este mês</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setTab(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              currentTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {currentTab === "solicitar" && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
          {limiteAtingido && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Limite mensal de trocas atingido</p>
                <p className="text-xs opacity-90">Conforme configuração do sistema, você já solicitou {trocasStatus?.used} de {trocasStatus?.limit} trocas permitidas neste mês. Aguarde o próximo ciclo ou converse com seu gestor.</p>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">Plantão a trocar *</label>
            <select value={form.shift_id} onChange={(e) => setForm((f) => ({ ...f, shift_id: e.target.value }))}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={limiteAtingido}>
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
            <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, destinatario_id: "" }))}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={limiteAtingido}>
              <option value="grupo">🌐 Cobertura aberta — qualquer colega qualificado pode aceitar</option>
              <option value="direto">👤 Troca direta — escolher um colega específico</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {form.tipo === 'grupo'
                ? 'O plantão será publicado para todos os profissionais elegíveis. O primeiro a aceitar fica com a vaga.'
                : 'Você escolhe diretamente com quem deseja trocar. Apenas o destinatário será notificado.'}
            </p>
          </div>

          {form.tipo === "direto" && (
            <div>
              <label className="text-sm font-medium text-foreground">Destinatário *</label>
              <select value={form.destinatario_id} onChange={(e) => setForm((f) => ({ ...f, destinatario_id: e.target.value }))}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={limiteAtingido}>
                <option value="">Selecione...</option>
                {directory.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">Motivo *</label>
            <textarea value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} rows={3}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={limiteAtingido} />
          </div>

          <SwapAttachmentsSection
            pendingFiles={pendingAttachments}
            onPendingChange={setPendingAttachments}
            canUpload
            professionalId={professionalId}
          />

          <button onClick={() => createSwap.mutate()} disabled={createSwap.isPending || limiteAtingido}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {createSwap.isPending ? "Enviando..." : limiteAtingido ? "Limite atingido" : "Solicitar troca"}
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
                <p className="text-xs text-muted-foreground mt-1">{new Date(swap.created_at).toLocaleString("pt-BR")} • {swap.status}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Plantão: {new Date(`${(swap.shifts as any)?.data}T12:00:00`).toLocaleDateString("pt-BR")} • {(swap.shifts as any)?.hora_inicio} - {(swap.shifts as any)?.hora_fim}
                </p>
                {(swap.status === "solicitada" || swap.status === "aguardando_resposta") && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => respondSwap.mutate({ swapId: swap.id, accept: true })}
                      className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-success-foreground hover:opacity-90">Aceitar</button>
                    <button onClick={() => respondSwap.mutate({ swapId: swap.id, accept: false })}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90">Recusar</button>
                    <button onClick={() => setViewAttachmentsId(swap.id)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Ver anexos
                    </button>
                  </div>
                )}
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
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-foreground font-medium">{swap.motivo}</p>
                    <p className="text-xs text-muted-foreground mt-1">Status: {swap.status}</p>
                    {swap.observacao_gestor && <p className="text-xs text-muted-foreground mt-1">Obs. gestor: {swap.observacao_gestor}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setViewAttachmentsId(swap.id)} className="px-2.5 py-1 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Anexos
                    </button>
                    {['aprovada', 'concluida'].includes(swap.status) && (
                      <button onClick={() => setComprovanteId(swap.id)} className="px-2.5 py-1 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Comprovante
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={!!comprovanteId} onOpenChange={(open) => !open && setComprovanteId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none">
          {comprovanteId && <ComprovanteTroca trocaId={comprovanteId} onClose={() => setComprovanteId(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewAttachmentsId} onOpenChange={(open) => !open && setViewAttachmentsId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg font-semibold text-foreground mb-3">Anexos da troca</h2>
          {viewAttachmentsId && (() => {
            const sw: any = swaps.find((s: any) => s.id === viewAttachmentsId);
            const isOwner = sw?.solicitante_id === professionalId;
            const isReceiver = sw?.destinatario_id === professionalId;
            return (
              <SwapAttachmentsSection
                trocaId={viewAttachmentsId}
                canUpload={isOwner}
                professionalId={professionalId}
                swapStatus={sw?.status}
                isManager={false}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
