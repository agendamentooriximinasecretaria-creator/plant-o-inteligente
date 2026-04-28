import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Configurações de anexos em trocas de plantão.
 * Salvas em system_settings.key = 'swap_attachments_rules'.
 */
export type SwapAttachmentTypeConfig = {
  value: string;
  label: string;
  ativo: boolean;
};

export type SwapAttachmentSettings = {
  permitir_anexos: boolean;
  obrigatorio: boolean;
  obrigatorio_apenas_saude: boolean;
  permitir_substituto_visualizar: boolean;
  permitir_remover_pendente: boolean;
  max_arquivos: number;
  max_tamanho_mb: number;
  tipos_permitidos: ("pdf" | "jpg" | "jpeg" | "png" | "doc" | "docx")[];
  exigir_descricao: boolean;
  exigir_analise_coordenador: boolean;
  bloquear_aprovacao_sem_anexo: boolean;
  tipos_documento: SwapAttachmentTypeConfig[];
};

export const DEFAULT_DOC_TYPES: SwapAttachmentTypeConfig[] = [
  { value: "atestado_medico", label: "Atestado médico", ativo: true },
  { value: "declaracao", label: "Declaração", ativo: true },
  { value: "comprovante_consulta", label: "Comprovante de consulta", ativo: true },
  { value: "convocacao", label: "Convocação", ativo: true },
  { value: "documento_institucional", label: "Documento institucional", ativo: true },
  { value: "outro", label: "Outro", ativo: true },
];

export const DEFAULT_SWAP_ATTACHMENT_SETTINGS: SwapAttachmentSettings = {
  permitir_anexos: true,
  obrigatorio: false,
  obrigatorio_apenas_saude: false,
  permitir_substituto_visualizar: true,
  permitir_remover_pendente: true,
  max_arquivos: 5,
  max_tamanho_mb: 10,
  tipos_permitidos: ["pdf", "jpg", "jpeg", "png", "doc", "docx"],
  exigir_descricao: false,
  exigir_analise_coordenador: false,
  bloquear_aprovacao_sem_anexo: false,
  tipos_documento: DEFAULT_DOC_TYPES,
};

/** Tipos considerados "saúde/atestado" — usados quando obrigatorio_apenas_saude=true */
export const HEALTH_DOC_TYPES = new Set(["atestado_medico", "comprovante_consulta"]);

/** Heurística simples: motivo da troca menciona saúde/atestado/médico/consulta */
export function motivoEhSaude(motivo: string | null | undefined): boolean {
  if (!motivo) return false;
  const m = motivo.toLowerCase();
  return /atestado|m[eé]dic|sa[uú]de|consulta|hospital|doen[çc]a|exame|cir[uú]rgi/.test(m);
}

export function mergeSettings(raw: any): SwapAttachmentSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SWAP_ATTACHMENT_SETTINGS;
  const tipos = Array.isArray(raw.tipos_documento) && raw.tipos_documento.length > 0
    ? raw.tipos_documento
    : DEFAULT_DOC_TYPES;
  return {
    ...DEFAULT_SWAP_ATTACHMENT_SETTINGS,
    ...raw,
    tipos_documento: tipos,
    tipos_permitidos: Array.isArray(raw.tipos_permitidos) && raw.tipos_permitidos.length > 0
      ? raw.tipos_permitidos
      : DEFAULT_SWAP_ATTACHMENT_SETTINGS.tipos_permitidos,
  };
}

export function useSwapAttachmentSettings() {
  return useQuery({
    queryKey: ["swap-attachment-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "swap_attachments_rules")
        .maybeSingle();
      return mergeSettings(data?.value);
    },
    staleTime: 60_000,
  });
}

export async function getSwapAttachmentSettings(): Promise<SwapAttachmentSettings> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "swap_attachments_rules")
    .maybeSingle();
  return mergeSettings(data?.value);
}

/** Retorna lista de tipos ativos (para selects no formulário) */
export function activeDocTypes(settings: SwapAttachmentSettings): SwapAttachmentTypeConfig[] {
  const list = settings.tipos_documento.filter((t) => t.ativo);
  return list.length > 0 ? list : DEFAULT_DOC_TYPES;
}
