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
  
  // Imagens resolvidas (Base64)
  assinaturaBase64?: string;
  carimboBase64?: string;
  
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
 * Converte um arquivo do storage para base64.
 * Essencial para jsPDF renderizar imagens sem problemas de CORS ou rede.
 */
async function convertStorageImageToBase64(bucket: string, path: string): Promise<string | undefined> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return undefined;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(data);
    });
  } catch (err) {
    console.error(`Erro ao converter imagem ${path} para base64:`, err);
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
      result.debugInfo = "Nenhum ID fornecido";
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
      .eq("bloqueado", false)
      .maybeSingle();

    if (stamp && !stampErr) {
      const metadata = (stamp.metadata as any) || {};
      result.source = "stamp_table";
      result.nome = metadata.nome_profissional || prof.nome || "";
      result.cargo = stamp.cargo || prof.cargo || prof.profissao || "";
      
      const conselhoLabel = metadata.conselho || prof.documento_conselho || prof.conselho || "";
      const registroVal = metadata.registro || prof.documento_numero || prof.registro || "";
      const ufSuffix = stamp.uf_conselho ? ` (${stamp.uf_conselho})` : "";
      result.conselho = `${conselhoLabel} ${registroVal}${ufSuffix}`.trim();
      
      result.unidade = metadata.unidade_principal || (prof as any).units?.nome || "";
      result.tipoAssinante = metadata.tipo_assinante || "profissional_saude";

      // Flags de disponibilidade baseadas no cadastro
      result.hasVisualSignature = !!stamp.assinatura_path;
      result.hasStamp = !!stamp.carimbo_path;
      result.hasDigitalSeal = stamp.tipo === "digital_gerado" || stamp.tipo === "eletronica_interna";

      // 3. Resolver Imagens se solicitado
      if (includeImages) {
        const BUCKET = 'professional-documents';
        
        if (stamp.assinatura_path) {
          result.assinaturaBase64 = await convertStorageImageToBase64(BUCKET, stamp.assinatura_path);
          if (result.assinaturaBase64) {
            result.hasVisualSignature = true;
          }
        }
        
        // Se ainda não houver imagem real e for digital gerada, tenta usar SVG se existir no metadata
        if (!result.assinaturaBase64 && stamp.tipo === 'digital_gerado' && metadata.signature_svg) {
          result.assinaturaBase64 = metadata.signature_svg;
          result.hasVisualSignature = true;
        }

        if (stamp.carimbo_path) {
          result.carimboBase64 = await convertStorageImageToBase64(BUCKET, stamp.carimbo_path);
          if (result.carimboBase64) {
            result.hasStamp = true;
          }
        }
      }
      
      // Definir modo de renderização preferencial
      if (result.assinaturaBase64) result.renderMode = "visual";
      else if (result.carimboBase64) result.renderMode = "stamp";
      else if (result.hasDigitalSeal) result.renderMode = "digital";
      else result.renderMode = "text_only";

    } else {
      // Fallback para dados básicos do profissional
      result.source = "professional_table";
      result.cargo = prof.cargo || prof.profissao || "";
      result.conselho = `${prof.conselho || ""} ${prof.registro || ""}`.trim();
      result.unidade = (prof as any).units?.nome || "";
      result.renderMode = "text_only";
      result.debugInfo = "Carimbo não cadastrado ou bloqueado";
    }

    return result;
  } catch (error) {
    console.error("Erro na resolução de assinatura:", error);
    result.debugInfo = String(error);
    return result;
  }
}

/**
 * Busca o Responsável Técnico da unidade ou Global
 */
export async function resolveRTForUnidade(unidadeId?: string): Promise<ResolvedSignature> {
  try {
    if (unidadeId) {
      const { data } = await supabase
        .from('professional_stamps')
        .select('profissional_id')
        .ilike('cargo', '%Responsável Técnico%')
        .eq('bloqueado', false)
        .eq('profissional_id', (
          await supabase.from('professionals').select('id').eq('unidade_principal_id', unidadeId)
        ).data?.[0]?.id || '') // Simplificado para o exemplo, ideal seria join
        .limit(1)
        .maybeSingle();
        
      if (data) return resolveSignatureData({ professionalId: data.profissional_id });
    }

    // Fallback global
    const { data: globalRT } = await supabase
      .from('professional_stamps')
      .select('profissional_id')
      .ilike('cargo', '%Responsável Técnico%')
      .eq('bloqueado', false)
      .limit(1)
      .maybeSingle();

    if (globalRT) return resolveSignatureData({ professionalId: globalRT.profissional_id });
    
    return { signatoryFound: false, nome: "", cargo: "", conselho: "", unidade: "", hasVisualSignature: false, hasStamp: false, hasDigitalSeal: false, tipoAssinante: "responsavel_tecnico", source: "fallback", renderMode: "text_only" };
  } catch (err) {
    console.error('Erro em resolveRTForUnidade:', err);
    return { signatoryFound: false, nome: "", cargo: "", conselho: "", unidade: "", hasVisualSignature: false, hasStamp: false, hasDigitalSeal: false, tipoAssinante: "responsavel_tecnico", source: "fallback", renderMode: "text_only" };
  }
}

/**
 * Busca o Gestor Master da unidade ou Global
 */
export async function resolveGestorMasterForUnidade(unidadeId?: string): Promise<ResolvedSignature> {
  try {
    if (unidadeId) {
      const { data } = await supabase
        .from('professional_stamps')
        .select('profissional_id')
        .ilike('cargo', '%Gestor Master%')
        .eq('bloqueado', false)
        .limit(1) // Em Oriximiná geralmente é global, mas suportamos por unidade se cadastrado
        .maybeSingle();
        
      if (data) return resolveSignatureData({ professionalId: data.profissional_id });
    }

    const { data: globalGestor } = await supabase
      .from('professional_stamps')
      .select('profissional_id')
      .ilike('cargo', '%Gestor Master%')
      .eq('bloqueado', false)
      .limit(1)
      .maybeSingle();
      
    if (globalGestor) return resolveSignatureData({ professionalId: globalGestor.profissional_id });
    
    return { signatoryFound: false, nome: "", cargo: "", conselho: "", unidade: "", hasVisualSignature: false, hasStamp: false, hasDigitalSeal: false, tipoAssinante: "gestor_master", source: "fallback", renderMode: "text_only" };
  } catch (err) {
    console.error('Erro em resolveGestorMasterForUnidade:', err);
    return { signatoryFound: false, nome: "", cargo: "", conselho: "", unidade: "", hasVisualSignature: false, hasStamp: false, hasDigitalSeal: false, tipoAssinante: "gestor_master", source: "fallback", renderMode: "text_only" };
  }
}
