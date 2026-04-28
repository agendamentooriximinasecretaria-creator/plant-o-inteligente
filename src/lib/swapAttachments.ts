import { supabase } from "@/integrations/supabase/client";

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

export const MAX_FILES_PER_SWAP = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
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

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (BLOCKED_EXTENSIONS.includes(ext)) return `Tipo de arquivo "${ext}" não permitido.`;
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `Extensão .${ext} não suportada. Use PDF, JPG, PNG ou DOC/DOCX.`;
  if (file.size > MAX_FILE_SIZE_BYTES) return `Arquivo "${file.name}" excede o limite de 10 MB.`;
  if (file.size <= 0) return `Arquivo "${file.name}" está vazio.`;
  if (file.type && !ALLOWED_MIME.has(file.type)) return `Tipo MIME "${file.type}" não permitido.`;
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

export async function getSignedAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SWAP_ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
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
