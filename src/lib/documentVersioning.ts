import { supabase } from "@/integrations/supabase/client";

export type GeneratedDocumentType =
  | "escala_mensal"
  | "comprovante_plantao"
  | "troca_plantao"
  | "relatorio_oficial"
  | "documento_personalizado"
  | "outro";

export type GeneratedDocumentStatus =
  | "rascunho"
  | "gerado"
  | "assinado"
  | "publicado"
  | "retificado"
  | "cancelado"
  | "arquivado";

export interface GeneratedDocument {
  id: string;
  tipo_documento: GeneratedDocumentType;
  titulo: string;
  modelo_id: string | null;
  modelo_nome: string | null;
  versao: number;
  status: GeneratedDocumentStatus;
  conteudo_html: string;
  dados_geracao: Record<string, any>;
  hash: string;
  codigo_validacao: string;
  unidade_id: string | null;
  setor_id: string | null;
  profissional_id: string | null;
  previous_document_id: string | null;
  root_document_id: string | null;
  motivo_retificacao: string | null;
  signature_id: string | null;
  assinado_por: string | null;
  assinado_em: string | null;
  criado_por: string | null;
  created_at: string;
  atualizado_por: string | null;
  updated_at: string;
}

/** SHA-256 do conteúdo */
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Código de validação curto (12 chars alfanuméricos uppercase) */
export function gerarCodigoValidacao(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export interface CriarDocumentoInput {
  tipo: GeneratedDocumentType;
  titulo: string;
  conteudoHtml: string;
  dadosGeracao?: Record<string, any>;
  modeloId?: string | null;
  modeloNome?: string | null;
  unidadeId?: string | null;
  setorId?: string | null;
  profissionalId?: string | null;
  status?: GeneratedDocumentStatus;
}

/** Cria um documento versionado (versão 1) */
export async function criarDocumentoVersionado(
  input: CriarDocumentoInput
): Promise<GeneratedDocument> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const hash = await sha256(input.conteudoHtml);
  const codigo = gerarCodigoValidacao();

  const { data, error } = await supabase
    .from("generated_documents")
    .insert({
      tipo_documento: input.tipo,
      titulo: input.titulo,
      modelo_id: input.modeloId ?? null,
      modelo_nome: input.modeloNome ?? null,
      versao: 1,
      status: input.status ?? "gerado",
      conteudo_html: input.conteudoHtml,
      dados_geracao: input.dadosGeracao ?? {},
      hash,
      codigo_validacao: codigo,
      unidade_id: input.unidadeId ?? null,
      setor_id: input.setorId ?? null,
      profissional_id: input.profissionalId ?? null,
      criado_por: uid,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as GeneratedDocument;
}

/**
 * Cria uma RETIFICAÇÃO (nova versão) a partir de um documento existente.
 * - Marca o anterior como 'retificado'
 * - Nova versão referencia o anterior via previous_document_id
 * - root_document_id é definido pelo trigger
 */
export async function criarRetificacao(params: {
  documentoAnteriorId: string;
  novoConteudoHtml: string;
  motivo: string;
  novosDados?: Record<string, any>;
  novoTitulo?: string;
}): Promise<GeneratedDocument> {
  const { data: anterior, error: errPrev } = await supabase
    .from("generated_documents")
    .select("*")
    .eq("id", params.documentoAnteriorId)
    .maybeSingle();

  if (errPrev || !anterior) throw errPrev ?? new Error("Documento anterior não encontrado");

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const hash = await sha256(params.novoConteudoHtml);
  const codigo = gerarCodigoValidacao();

  // Insere nova versão
  const { data: nova, error: errNew } = await supabase
    .from("generated_documents")
    .insert({
      tipo_documento: anterior.tipo_documento,
      titulo: params.novoTitulo ?? anterior.titulo,
      modelo_id: anterior.modelo_id,
      modelo_nome: anterior.modelo_nome,
      versao: (anterior.versao ?? 1) + 1,
      status: "gerado",
      conteudo_html: params.novoConteudoHtml,
      dados_geracao: params.novosDados ?? anterior.dados_geracao,
      hash,
      codigo_validacao: codigo,
      unidade_id: anterior.unidade_id,
      setor_id: anterior.setor_id,
      profissional_id: anterior.profissional_id,
      previous_document_id: anterior.id,
      motivo_retificacao: params.motivo,
      criado_por: uid,
    })
    .select("*")
    .single();

  if (errNew) throw errNew;

  // Marca anterior como retificado (se possível)
  await supabase
    .from("generated_documents")
    .update({ status: "retificado", atualizado_por: uid })
    .eq("id", anterior.id);

  return nova as GeneratedDocument;
}

/** Marca documento como assinado vinculando uma signature */
export async function marcarComoAssinado(
  documentoId: string,
  signatureId: string
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const { error } = await supabase
    .from("generated_documents")
    .update({
      status: "assinado",
      signature_id: signatureId,
      assinado_por: uid,
      assinado_em: new Date().toISOString(),
    })
    .eq("id", documentoId);

  if (error) throw error;
}

/** Carrega histórico (todas as versões) de uma cadeia de documento */
export async function listarHistorico(
  rootOrAnyId: string
): Promise<GeneratedDocument[]> {
  // Busca o doc para descobrir o root
  const { data: base } = await supabase
    .from("generated_documents")
    .select("id, root_document_id")
    .eq("id", rootOrAnyId)
    .maybeSingle();

  const root = base?.root_document_id || rootOrAnyId;

  const { data, error } = await supabase
    .from("generated_documents")
    .select("*")
    .or(`root_document_id.eq.${root},id.eq.${root}`)
    .order("versao", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GeneratedDocument[];
}

export async function listarDocumentos(filtros?: {
  tipo?: GeneratedDocumentType;
  profissionalId?: string;
  status?: GeneratedDocumentStatus;
  limit?: number;
}): Promise<GeneratedDocument[]> {
  let q = supabase
    .from("generated_documents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtros?.limit ?? 100);

  if (filtros?.tipo) q = q.eq("tipo_documento", filtros.tipo);
  if (filtros?.profissionalId) q = q.eq("profissional_id", filtros.profissionalId);
  if (filtros?.status) q = q.eq("status", filtros.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as GeneratedDocument[];
}

export async function alterarStatus(
  documentoId: string,
  status: GeneratedDocumentStatus
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;
  const { error } = await supabase
    .from("generated_documents")
    .update({ status, atualizado_por: uid })
    .eq("id", documentoId);
  if (error) throw error;
}

export const STATUS_LABELS: Record<GeneratedDocumentStatus, string> = {
  rascunho: "Rascunho",
  gerado: "Gerado",
  assinado: "Assinado",
  publicado: "Publicado",
  retificado: "Retificado",
  cancelado: "Cancelado",
  arquivado: "Arquivado",
};

export const TIPO_LABELS: Record<GeneratedDocumentType, string> = {
  escala_mensal: "Escala Mensal Oficial",
  comprovante_plantao: "Comprovante de Plantão",
  troca_plantao: "Troca de Plantão",
  relatorio_oficial: "Relatório Oficial",
  documento_personalizado: "Documento Personalizado",
  outro: "Outro",
};
