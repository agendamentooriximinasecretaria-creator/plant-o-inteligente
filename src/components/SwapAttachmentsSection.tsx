import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Paperclip, Upload, FileText, FileImage, FileType2, File as FileIcon, Trash2, Download, Eye, AlertCircle, ShieldX, CheckCircle2, X, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type SwapAttachment,
  listSwapAttachments,
  uploadSwapAttachment,
  removeSwapAttachment,
  rejectSwapAttachment,
  markAttachmentAnalyzed,
  getSignedAttachmentUrl,
  validateFile,
  formatBytes,
  getAttachmentTypeLabel,
  isPreviewable,
  getFileIconType,
} from "@/lib/swapAttachments";
import {
  useSwapAttachmentSettings,
  activeDocTypes,
  DEFAULT_SWAP_ATTACHMENT_SETTINGS,
} from "@/lib/swapAttachmentSettings";
import { supabase } from "@/integrations/supabase/client";

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
  const { data: settings = DEFAULT_SWAP_ATTACHMENT_SETTINGS } = useSwapAttachmentSettings();
  const docTypes = useMemo(() => activeDocTypes(settings), [settings]);
  const maxFiles = settings.max_arquivos || 5;
  const maxSizeBytes = (settings.max_tamanho_mb || 10) * 1024 * 1024;
  const allowedExt = settings.tipos_permitidos || [];
  const acceptAttr = useMemo(() => allowedExt.map((e) => `.${e}`).join(","), [allowedExt]);

  const [attachments, setAttachments] = useState<SwapAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<string>(docTypes[0]?.value || "outro");
  const [descricao, setDescricao] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ a: SwapAttachment; url: string; kind: 'pdf' | 'image' } | null>(null);

  // Garante que o tipo selecionado é válido após carregar settings
  useEffect(() => {
    if (docTypes.length > 0 && !docTypes.some((t) => t.value === tipo)) {
      setTipo(docTypes[0].value);
    }
  }, [docTypes, tipo]);

  const isPendingMode = !trocaId;
  const swapEditable = !swapStatus || ["solicitada", "aguardando_resposta"].includes(swapStatus);
  const podeRemoverPendente = settings.permitir_remover_pendente;

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

  // Carrega nomes dos remetentes (sem expor PII)
  useEffect(() => {
    const ids = Array.from(new Set(attachments.map(a => a.enviado_por_profissional_id).filter(Boolean))) as string[];
    const missing = ids.filter(id => !(id in senderNames));
    if (missing.length === 0) return;
    (async () => {
      const sb = supabase as any;
      const { data } = await sb.from('professionals_safe').select('id, nome').in('id', missing);
      const map: Record<string, string> = { ...senderNames };
      (data || []).forEach((p: any) => { map[p.id] = p.nome; });
      setSenderNames(map);
    })();
  }, [attachments, senderNames]);

  const totalCount = (isPendingMode ? pendingFiles.length : attachments.filter(a => a.status === "ativo").length);
  const limitReached = totalCount >= maxFiles;

  const handlePick = () => fileRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    fileRef.current && (fileRef.current.value = "");

    const err = validateFile(file, { allowedExtensions: allowedExt, maxSizeBytes });
    if (err) { toast.error(err); return; }
    if (limitReached) { toast.error(`Máximo de ${maxFiles} anexos por solicitação.`); return; }
    if (settings.exigir_descricao && !descricao.trim()) {
      toast.error("Descrição do anexo é obrigatória conforme configuração do sistema.");
      return;
    }

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
      const url = await getSignedAttachmentUrl(a.storage_path, {
        audit: { attachmentId: a.id, trocaId: a.troca_id, action: 'baixar', nome: a.nome_original },
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = a.nome_original;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar link de download.");
    }
  };

  const handlePreview = async (a: SwapAttachment) => {
    const kind = isPreviewable(a.mime_type, a.nome_original);
    if (!kind) {
      toast.message("Pré-visualização não suportada para este tipo. Faça o download.");
      return;
    }
    try {
      const url = await getSignedAttachmentUrl(a.storage_path, {
        audit: { attachmentId: a.id, trocaId: a.troca_id, action: 'visualizar', nome: a.nome_original },
      });
      setPreview({ a, url, kind });
    } catch (e: any) {
      toast.error(e.message || "Erro ao abrir anexo.");
    }
  };

  const handleMarkAnalyzed = async (a: SwapAttachment) => {
    setBusy(true);
    try {
      await markAttachmentAnalyzed(a.id);
      toast.success("Anexo marcado como analisado.");
      await reload();
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao marcar anexo.");
    } finally { setBusy(false); }
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

  const renderFileIcon = (a: SwapAttachment) => {
    const t = getFileIconType(a.mime_type, a.nome_original);
    const cls = "h-4 w-4 shrink-0";
    if (t === 'pdf') return <FileType2 className={`${cls} text-red-500`} />;
    if (t === 'image') return <FileImage className={`${cls} text-blue-500`} />;
    if (t === 'doc') return <FileText className={`${cls} text-sky-600`} />;
    return <FileIcon className={`${cls} text-muted-foreground`} />;
  };

  // Quando anexos estão totalmente desativados pela configuração, esconde a seção (gestores ainda veem para revisar histórico).
  if (!settings.permitir_anexos && !isManager && totalCount === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Anexos justificativos</h4>
          {settings.obrigatorio && !settings.obrigatorio_apenas_saude && (
            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">Obrigatório</span>
          )}
          {settings.obrigatorio_apenas_saude && (
            <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">Obrigatório se saúde</span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {totalCount}/{maxFiles} • até {settings.max_tamanho_mb} MB
        </span>
      </div>

      {settings.permitir_anexos && canUpload && (!swapStatus || swapEditable) && (
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
                {docTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">
                Descrição {settings.exigir_descricao ? <span className="text-destructive">*</span> : "(opcional)"}
              </label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.slice(0, 200))}
                disabled={limitReached || busy}
                placeholder={settings.exigir_descricao ? "Descrição obrigatória do anexo" : "Observação do anexo"}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept={acceptAttr}
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
            <p className="text-[11px] text-muted-foreground uppercase">{allowedExt.join(", ")}</p>
          </div>
          {limitReached && (
            <p className="flex items-center gap-1 text-[11px] text-warning">
              <AlertCircle className="h-3 w-3" /> Limite de {maxFiles} anexos atingido.
            </p>
          )}
        </div>
      )}

      {!settings.permitir_anexos && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlertCircle className="h-3 w-3" /> Anexos em trocas estão desativados nas configurações do sistema.
        </p>
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
            const canDelete = (isMine && swapEditable && podeRemoverPendente) || isManager;
            const rejected = a.status === "rejeitado";
            const previewable = isPreviewable(a.mime_type, a.nome_original);
            const senderName = a.enviado_por_profissional_id ? (senderNames[a.enviado_por_profissional_id] || '—') : 'Sistema';
            return (
              <div key={a.id} className={`rounded-md border px-2.5 py-2 ${rejected ? "border-destructive/30 bg-destructive/5" : "border-border bg-background"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-xs font-medium text-foreground">
                      {renderFileIcon(a)}
                      <span className="truncate">{a.nome_original}</span>
                      {rejected && <span className="ml-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive shrink-0">Rejeitado</span>}
                      {!rejected && a.analisado_em && (
                        <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-success/10 px-1.5 py-0.5 text-[10px] text-success shrink-0">
                          <BadgeCheck className="h-2.5 w-2.5" /> Analisado
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {getAttachmentTypeLabel(a.tipo_documento)} • {formatBytes(a.tamanho)} • {new Date(a.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Enviado por: <span className="text-foreground">{senderName}</span></p>
                    {a.descricao && <p className="mt-0.5 text-[11px] text-muted-foreground italic">"{a.descricao}"</p>}
                    {rejected && a.motivo_rejeicao && (
                      <p className="mt-0.5 text-[11px] text-destructive">Motivo: {a.motivo_rejeicao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {previewable && (
                      <button onClick={() => handlePreview(a)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Visualizar">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDownload(a)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Baixar">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {isManager && !rejected && !a.analisado_em && (
                      <button onClick={() => handleMarkAnalyzed(a)} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-success/10 hover:text-success disabled:opacity-50" title="Marcar como analisado">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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
                      placeholder="Motivo da rejeição (obrigatório)"
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

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
            <DialogTitle className="text-sm flex items-center gap-2 truncate">
              {preview && renderFileIcon(preview.a)}
              <span className="truncate">{preview?.a.nome_original}</span>
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground">
              {preview && `${getAttachmentTypeLabel(preview.a.tipo_documento)} • ${formatBytes(preview.a.tamanho)}`}
            </p>
          </DialogHeader>
          <div className="flex-1 bg-muted/40 overflow-auto flex items-center justify-center">
            {preview?.kind === 'pdf' && (
              <iframe src={preview.url} title={preview.a.nome_original} className="w-full h-[80vh] border-0 bg-background" />
            )}
            {preview?.kind === 'image' && (
              <img src={preview.url} alt={preview.a.nome_original} className="max-w-full max-h-[80vh] object-contain" />
            )}
          </div>
          <div className="px-4 py-2 border-t border-border flex items-center justify-end gap-2">
            <button onClick={() => preview && handleDownload(preview.a)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Download className="h-3.5 w-3.5" /> Baixar
            </button>
            <button onClick={() => setPreview(null)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">Fechar</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
