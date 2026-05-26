import { supabase } from "@/integrations/supabase/client";

export type SignatureType = "visual" | "stamp" | "digital" | "text_only";

export interface ResolvedSignature {
  signatoryFound: boolean;
  professionalId?: string;
  userId?: string;
  nome: string;
  cargo: string;
  conselho: string;
  unidade: string;
  
  // Imagens resolvidas (Base64 ou Signed URL)
  assinaturaUrl?: string;
  carimboUrl?: string;
  
  // Flags de disponibilidade
  hasVisualSignature: boolean;
  hasStamp: boolean;
  hasDigitalSeal: boolean;
  
  // Metadados
  tipoAssinante: string;
  source: "stamp_table" | "professional_table" | "fallback";
  renderMode: SignatureType;
  
  // Para diagnósticos
  debugInfo?: string;
}

/**
 * Converte uma URL ou path para Base64 para garantir que funcione em PDF e Print
 */
async function toBase64(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Erro ao converter imagem para base64:", e);
    return undefined;
  }
}

/**
 * Engine central de resolução de assinatura e carimbo
 */
export async function resolveSignatureData(params: {
  professionalId?: string;
  userId?: string;
  context?: string;
  includeImages?: boolean;
}): Promise<ResolvedSignature> {
  const { professionalId, userId, includeImages = true } = params;
  
  let result: ResolvedSignature = {
    signatoryFound: false,
    nome: "",
    cargo: "",
    conselho: "",
    unidade: "",
    hasVisualSignature: false,
    hasStamp: false,
    hasDigitalSeal: false,
    tipoAssinante: "profissional_saude",
    source: "fallback",
    renderMode: "text_only",
    debugInfo: ""
  };

  try {
    // 1. Localizar o profissional e o carimbo
    let profQuery = supabase.from("professionals").select(`
      id, nome, profissao, cargo, especialidade, conselho, registro, 
      documento_conselho, documento_numero, user_id,
      units (nome)
    `);

    if (professionalId) {
      profQuery = profQuery.eq("id", professionalId);
    } else if (userId) {
      profQuery = profQuery.eq("user_id", userId);
    } else {
      return result;
    }

    const { data: prof, error: profErr } = await profQuery.maybeSingle();
    
    if (profErr || !prof) {
      result.debugInfo = "Profissional não encontrado";
      return result;
    }

    result.professionalId = prof.id;
    result.userId = prof.user_id;
    result.nome = prof.nome;
    result.signatoryFound = true;
    
    // 2. Buscar na tabela de carimbos (Fonte de verdade oficial)
    const { data: stamp, error: stampErr } = await supabase
      .from("professional_stamps")
      .select("*")
      .eq("profissional_id", prof.id)
      .maybeSingle();

    if (stamp && !stampErr) {
      result.source = "stamp_table";
      result.cargo = stamp.cargo || prof.cargo || prof.profissao || "";
      const conselho = (stamp.metadata as any)?.conselho_manual || prof.documento_conselho || prof.conselho || "";
      const registro = prof.documento_numero || prof.registro || "";
      result.conselho = `${conselho} ${registro}`.trim();
      result.unidade = (prof as any).units?.nome || "";
      result.tipoAssinante = (stamp.metadata as any)?.tipo_assinante || "profissional_saude";

      // Flags de disponibilidade baseadas no cadastro
      result.hasVisualSignature = !!stamp.assinatura_path;
      result.hasStamp = !!stamp.carimbo_path;
      result.hasDigitalSeal = stamp.tipo === "digital_gerado" || stamp.tipo === "eletronica_interna";

      // 3. Resolver Imagens se solicitado
      if (includeImages) {
        if (stamp.assinatura_path) {
          const { data: urlData } = await supabase.storage
            .from("professional-documents")
            .createSignedUrl(stamp.assinatura_path, 3600);
          if (urlData?.signedUrl) {
            result.assinaturaUrl = await toBase64(urlData.signedUrl);
          }
        }
        
        if (stamp.carimbo_path) {
          const { data: urlData } = await supabase.storage
            .from("professional-documents")
            .createSignedUrl(stamp.carimbo_path, 3600);
          if (urlData?.signedUrl) {
            result.carimboUrl = await toBase64(urlData.signedUrl);
          }
        }
      }
      
      // Definir modo de renderização preferencial
      if (result.hasVisualSignature) result.renderMode = "visual";
      else if (result.hasStamp) result.renderMode = "stamp";
      else if (result.hasDigitalSeal) result.renderMode = "digital";
      else result.renderMode = "text_only";

    } else {
      // Fallback para dados básicos do profissional
      result.source = "professional_table";
      result.cargo = prof.cargo || prof.profissao || "";
      result.conselho = `${prof.conselho || ""} ${prof.registro || ""}`.trim();
      result.unidade = (prof as any).units?.nome || "";
      result.renderMode = "text_only";
    }

    return result;
  } catch (error) {
    console.error("Erro na resolução de assinatura:", error);
    result.debugInfo = String(error);
    return result;
  }
}
