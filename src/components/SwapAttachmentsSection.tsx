import { useState, useRef, useEffect, useCallback } from "react";
import { Paperclip, Upload, FileText, Trash2, Download, AlertCircle, ShieldX, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  SWAP_ATTACHMENT_TYPES,
  MAX_FILES_PER_SWAP,
  MAX_FILE_SIZE_BYTES,
  type SwapAttachment,
  listSwapAttachments,
  uploadSwapAttachment,
  removeSwapAttachment,
  rejectSwapAttachment,
  getSignedAttachmentUrl,
  validateFile,
  formatBytes,
  getAttachmentTypeLabel,
} from "@/lib/swapAttachments";

type Props = {
  trocaId?: string | null;
  /** Quando trocaId é null/undefined o componente entra em "modo pendente": acumula arquivos para envio após criar a troca. */
  pendingFiles?: PendingFile[];
  onPendingChange?: (files: PendingFile[]) => void;
  /** Determina se o usuário pode enviar/remover anexos próprios (ex: solicitante). */
  canUpload?: boolean;
  /** Determina se gestor (rejeitar/marcar). */
  isManager?: boolean;
  /** Profissional logado (para vincular anexo). */
  professionalId?: string | null;
  /** Status atual da troca — define se o solicitante ainda pode remover anexos. */
  swapStatus?: string;
  /** Quando a troca já existe, dispara reload externo (opcional). */
  onChanged?: () => void;
};

export type PendingFile = {
  uid: string;
  file: File;
  tipo: string;
  descricao: string;
};

const newUid = () => Math.random().toString(36).slice(2, 10);

export default function SwapAttachmentsSection({
  trocaId,
  pendingFiles = [],
  onPendingChange,
  canUpload = true,
  isManager = false,
  professionalId,
  swapStatus,
  onChanged,
}: Props) {
  const [attachments, setAttachments] = useState<SwapAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<string>("atestado_medico");
  const [descricao, setDescricao] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");

  const isPendingMode = !trocaId;
  const swapEditable = !swapStatus || ["solicitada", "aguardando_resposta"].includes(swapStatus);

  const reload = useCallback(async () => {
    if (!trocaId) return;
    setLoading(true);
    try {
      const list = await listSwapAttachments(trocaId);
      setAttachments(list);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar anexos.");
    } finally {
      setLoading(false);
    }
  }, [trocaId]);

  useEffect(() => { reload(); }, [reload]);

  const totalCount = (isPendingMode ? pendingFiles.length : attachments.filter(a => a.status === "ativo").length);
  const limitReached = totalCount >= MAX_FILES_PER_SWAP;

  const handlePick = () => fileRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    fileRef.current && (fileRef.current.value = "");

    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    if (limitReached) { toast.error(`Máximo de ${MAX_FILES_PER_SWAP} anexos por solicitação.`); return; }

    if (isPendingMode) {
      onPendingChange?.([...pendingFiles, { uid: newUid(), file, tipo, descricao: descricao.trim() }]);
      setDescricao("");
      toast.success(`"${file.name}" pronto para envio.`);
      return;
    }

    setBusy(true);
    try {
      await uploadSwapAttachment({
        trocaId: trocaId!,
        file,
        tipo,
        descricao: descricao.trim(),
        professionalId: professionalId || null,
      });
      setDescricao("");
      toast.success("Anexo enviado.");
      await reload();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar anexo.");
    } finally {
      setBusy(false);
    }
  };

  const removePending = (uid: string) => {
    onPendingChange?.(pendingFiles.filter((p) => p.uid !== uid));
  };

  const handleRemove = async (a: SwapAttachment) => {
    if (!confirm(`Remover anexo "${a.nome_original}"?`)) return;
    setBusy(true);
    try {
      await removeSwapAttachment(a.id, a.storage_path);
      toast.success("Anexo removido.");
      await reload();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover anexo.");
    } finally { setBusy(false); }
  };

  const handleDownload = async (a: SwapAttachment) => {
    try {
      const url = await getSignedAttachmentUrl(a.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar link de download.");
    }
  };

  const handleReject = async (a: SwapAttachment) => {
    if (!rejectMotivo.trim()) { toast.error("Informe o motivo."); return; }
    setBusy(true);
    try {
      await rejectSwapAttachment(a.id, rejectMotivo);
      toast.success("Anexo rejeitado.");
      setRejectingId(null);
      setRejectMotivo("");
      await reload();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao rejeitar anexo.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Anexos justificativos</h4>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {totalCount}/{MAX_FILES_PER_SWAP} • até {Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB
        </span>
      </div>

      {canUpload && (!swapStatus || swapEditable) && (
        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-foreground">Tipo de documento</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                disabled={limitReached || busy}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
              >
                {SWAP_ATTACHMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Descrição (opcional)</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.slice(0, 200))}
                disabled={limitReached || busy}
                placeholder="Observação do anexo"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={handlePick}
              disabled={limitReached || busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {busy ? "Enviando..." : isPendingMode ? "Adicionar anexo" : "Enviar anexo"}
            </button>
            <p className="text-[11px] text-muted-foreground">PDF, JPG, PNG, DOC ou DOCX</p>
          </div>
          {limitReached && (
            <p className="flex items-center gap-1 text-[11px] text-warning">
              <AlertCircle className="h-3 w-3" /> Limite de {MAX_FILES_PER_SWAP} anexos atingido.
            </p>
          )}
        </div>
      )}

      {/* Pendentes */}
      {isPendingMode && pendingFiles.length > 0 && (
        <ul className="space-y-1.5">
          {pendingFiles.map((p) => (
            <li key={p.uid} className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border bg-background px-2.5 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{p.file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {getAttachmentTypeLabel(p.tipo)} • {formatBytes(p.file.size)}{p.descricao ? ` • ${p.descricao}` : ""}
                </p>
              </div>
              <button onClick={() => removePending(p.uid)} className="text-muted-foreground hover:text-destructive" title="Remover">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Existentes */}
      {!isPendingMode && (
        <div className="space-y-1.5">
          {loading && <p className="text-xs text-muted-foreground">Carregando anexos...</p>}
          {!loading && attachments.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum anexo enviado.</p>
          )}
          {attachments.map((a) => {
            const isMine = a.enviado_por_profissional_id === professionalId;
            const canDelete = (isMine && swapEditable) || isManager;
            const rejected = a.status === "rejeitado";
            return (
              <div key={a.id} className={`rounded-md border px-2.5 py-2 ${rejected ? "border-destructive/30 bg-destructive/5" : "border-border bg-background"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-xs font-medium text-foreground">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      {a.nome_original}
                      {rejected && <span className="ml-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">Rejeitado</span>}
                      {!rejected && a.analisado_em && (
                        <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Analisado
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {getAttachmentTypeLabel(a.tipo_documento)} • {formatBytes(a.tamanho)} • {new Date(a.created_at).toLocaleString("pt-BR")}
                    </p>
                    {a.descricao && <p className="mt-0.5 text-[11px] text-muted-foreground italic">"{a.descricao}"</p>}
                    {rejected && a.motivo_rejeicao && (
                      <p className="mt-0.5 text-[11px] text-destructive">Motivo: {a.motivo_rejeicao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleDownload(a)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Baixar">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {isManager && !rejected && (
                      <button onClick={() => { setRejectingId(a.id); setRejectMotivo(""); }} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Rejeitar anexo">
                        <ShieldX className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleRemove(a)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remover">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {rejectingId === a.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      autoFocus
                      value={rejectMotivo}
                      onChange={(e) => setRejectMotivo(e.target.value)}
                      placeholder="Motivo da rejeição"
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button onClick={() => handleReject(a)} disabled={busy} className="rounded-md bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50">Confirmar</button>
                    <button onClick={() => { setRejectingId(null); setRejectMotivo(""); }} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted">Cancelar</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
