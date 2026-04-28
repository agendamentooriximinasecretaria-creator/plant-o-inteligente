import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

export const SWAP_ATTACHMENT_BUCKET = "swap-attachments";

export const SWAP_ATTACHMENT_TYPES = [
  { value: "atestado_medico", label: "Atestado médico" },
  { value: "declaracao", label: "Declaração" },
  { value: "comprovante_consulta", label: "Comprovante de consulta" },
  { value: "convocacao", label: "Convocação" },
  { value: "documento_institucional", label: "Documento institucional" },
  { value: "documento_pessoal", label: "Documento pessoal" },
  { value: "outro", label: "Outro" },
] as const;

/** @deprecated Defaults — use settings de system_settings.swap_attachments_rules */
export const MAX_FILES_PER_SWAP = 5;
/** @deprecated Defaults — use settings de system_settings.swap_attachments_rules */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const DEFAULT_ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
const MIME_BY_EXT: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg", "image/jpg"],
  jpeg: ["image/jpeg", "image/jpg"],
  png: ["image/png"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};
const BLOCKED_EXTENSIONS = ["exe", "bat", "cmd", "js", "sh", "zip", "rar", "msi", "ps1", "vbs", "jar", "apk"];

export type SwapAttachment = {
  id: string;
  troca_id: string;
  tipo_documento: string;
  descricao: string | null;
  nome_original: string;
  mime_type: string;
  tamanho: number;
  storage_path: string;
  status: "ativo" | "removido" | "rejeitado";
  motivo_rejeicao: string | null;
  enviado_por_user_id: string;
  enviado_por_profissional_id: string | null;
  analisado_por: string | null;
  analisado_em: string | null;
  created_at: string;
};

export function validateFile(
  file: File,
  opts?: { allowedExtensions?: string[]; maxSizeBytes?: number }
): string | null {
  const allowed = (opts?.allowedExtensions && opts.allowedExtensions.length > 0)
    ? opts.allowedExtensions.map((e) => e.toLowerCase())
    : DEFAULT_ALLOWED_EXTENSIONS;
  const maxSize = opts?.maxSizeBytes && opts.maxSizeBytes > 0 ? opts.maxSizeBytes : MAX_FILE_SIZE_BYTES;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (BLOCKED_EXTENSIONS.includes(ext)) return `Tipo de arquivo "${ext}" não permitido.`;
  if (!allowed.includes(ext)) return `Extensão .${ext} não permitida pelas configurações do sistema.`;
  if (file.size > maxSize) return `Arquivo "${file.name}" excede o limite de ${(maxSize / 1024 / 1024).toFixed(0)} MB.`;
  if (file.size <= 0) return `Arquivo "${file.name}" está vazio.`;
  const allowedMime = new Set(allowed.flatMap((e) => MIME_BY_EXT[e] || []));
  if (file.type && !allowedMime.has(file.type)) return `Tipo MIME "${file.type}" não permitido.`;
  return null;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function listSwapAttachments(trocaId: string): Promise<SwapAttachment[]> {
  const sb = supabase as any;
  const { data, error } = await sb
    .from("swap_attachments")
    .select("*")
    .eq("troca_id", trocaId)
    .neq("status", "removido")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as SwapAttachment[];
}

export async function uploadSwapAttachment(params: {
  trocaId: string;
  file: File;
  tipo: string;
  descricao?: string;
  professionalId?: string | null;
}): Promise<SwapAttachment> {
  const err = validateFile(params.file);
  if (err) throw new Error(err);

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sessão expirada.");

  const safeName = sanitizeFileName(params.file.name);
  const path = `${params.trocaId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(SWAP_ATTACHMENT_BUCKET)
    .upload(path, params.file, {
      contentType: params.file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw upErr;

  const sb = supabase as any;
  const { data, error } = await sb
    .from("swap_attachments")
    .insert({
      troca_id: params.trocaId,
      tipo_documento: params.tipo,
      descricao: params.descricao || null,
      nome_original: params.file.name,
      mime_type: params.file.type || "application/octet-stream",
      tamanho: params.file.size,
      storage_path: path,
      enviado_por_user_id: uid,
      enviado_por_profissional_id: params.professionalId || null,
    })
    .select("*")
    .single();

  if (error) {
    // rollback storage
    await supabase.storage.from(SWAP_ATTACHMENT_BUCKET).remove([path]).catch(() => {});
    throw error;
  }

  return data as SwapAttachment;
}

export async function getSignedAttachmentUrl(storagePath: string, opts?: { audit?: { attachmentId: string; trocaId: string; action: 'visualizar' | 'baixar'; nome?: string } }): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SWAP_ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);
  if (error) throw error;
  if (opts?.audit) {
    logAudit(
      opts.audit.action === 'visualizar' ? 'anexo_troca_visualizado' : 'anexo_troca_baixado',
      'trocas_anexos',
      { attachment_id: opts.audit.attachmentId, troca_id: opts.audit.trocaId, nome_original: opts.audit.nome }
    ).catch(() => {});
  }
  return data.signedUrl;
}

export function isPreviewable(mime: string, name: string): 'pdf' | 'image' | null {
  const m = (mime || '').toLowerCase();
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  return null;
}

export function getFileIconType(mime: string, name: string): 'pdf' | 'image' | 'doc' | 'file' {
  const p = isPreviewable(mime, name);
  if (p) return p;
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['doc', 'docx'].includes(ext) || (mime || '').includes('word')) return 'doc';
  return 'file';
}

export async function removeSwapAttachment(attachmentId: string, storagePath: string): Promise<void> {
  const sb = supabase as any;
  const { error } = await sb
    .from("swap_attachments")
    .update({ status: "removido" })
    .eq("id", attachmentId);
  if (error) throw error;
  await supabase.storage.from(SWAP_ATTACHMENT_BUCKET).remove([storagePath]).catch(() => {});
}

export async function rejectSwapAttachment(attachmentId: string, motivo: string): Promise<void> {
  if (!motivo.trim()) throw new Error("Informe o motivo da rejeição.");
  const sb = supabase as any;
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await sb
    .from("swap_attachments")
    .update({
      status: "rejeitado",
      motivo_rejeicao: motivo.trim(),
      analisado_por: userData.user?.id,
      analisado_em: new Date().toISOString(),
    })
    .eq("id", attachmentId);
  if (error) throw error;
}

export async function markAttachmentAnalyzed(attachmentId: string): Promise<void> {
  const sb = supabase as any;
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await sb
    .from("swap_attachments")
    .update({ analisado_por: userData.user?.id, analisado_em: new Date().toISOString() })
    .eq("id", attachmentId);
  if (error) throw error;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function getAttachmentTypeLabel(value: string): string {
  return SWAP_ATTACHMENT_TYPES.find((t) => t.value === value)?.label || value;
}
