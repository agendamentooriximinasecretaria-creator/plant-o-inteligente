import { supabase } from "@/integrations/supabase/client";

export type SignatureType = "visual" | "stamp" | "digital" | "text_only";

export interface SignatureDisplayFlags {
  mostrar_profissao?: boolean;
  mostrar_especialidade?: boolean;
  mostrar_conselho?: boolean;
  mostrar_uf_conselho?: boolean;
  mostrar_cbo?: boolean;
  mostrar_cns?: boolean;
  mostrar_unidade?: boolean;
  mostrar_setor?: boolean;
  mostrar_cidade_uf?: boolean;
  mostrar_data_local?: boolean;
  mostrar_codigo_validacao?: boolean;
  mostrar_hash?: boolean;
  mostrar_qr_code?: boolean;
}

export interface ResolvedSignature {
  signatoryFound: boolean;
  professionalId?: string;
  userId?: string;
  nome: string;
  cargo: string;
  conselho: string;
  unidade: string;

  // Campos detalhados para "Exibição no Documento"
  profissao?: string;
  especialidade?: string;
  conselhoSigla?: string;
  registroNumero?: string;
  ufConselho?: string;
  cbo?: string;
  cns?: string;
  setor?: string;
  cidadeUf?: string;
  textoPersonalizado?: string;

  display?: SignatureDisplayFlags;
  tipo?: string;

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
      
      const conselhoLabel = metadata.conselho_manual || metadata.conselho || prof.documento_conselho || prof.conselho || "";
      const registroVal = metadata.registro_manual || metadata.registro || prof.documento_numero || prof.registro || "";
      const ufSuffix = stamp.uf_conselho ? ` (${stamp.uf_conselho})` : "";
      result.conselho = `${conselhoLabel} ${registroVal}${ufSuffix}`.trim();
      
      result.unidade = metadata.unidade_principal || (prof as any).units?.nome || "";
      result.tipoAssinante = metadata.tipo_assinante || "profissional_saude";

      // Campos detalhados para "Exibição no Documento"
      result.profissao = (prof as any).profissao || "";
      result.especialidade = stamp.especialidade || (prof as any).especialidade || "";
      result.conselhoSigla = conselhoLabel;
      result.registroNumero = registroVal;
      result.ufConselho = stamp.uf_conselho || "";
      result.cbo = stamp.cbo || metadata.cbo || "";
      result.cns = stamp.cns || metadata.cns || "";
      result.setor = metadata.setor_principal || "";
      result.cidadeUf = stamp.cidade_uf || metadata.cidade_uf || "";
      result.textoPersonalizado = stamp.texto_personalizado || "";
      result.tipo = stamp.tipo;

      result.display = {
        mostrar_profissao: stamp.mostrar_profissao,
        mostrar_especialidade: stamp.mostrar_especialidade,
        mostrar_conselho: stamp.mostrar_conselho,
        mostrar_uf_conselho: stamp.mostrar_uf_conselho,
        mostrar_cbo: stamp.mostrar_cbo,
        mostrar_cns: stamp.mostrar_cns,
        mostrar_unidade: stamp.mostrar_unidade,
        mostrar_setor: stamp.mostrar_setor,
        mostrar_cidade_uf: stamp.mostrar_cidade_uf,
        mostrar_data_local: stamp.mostrar_data_local,
        mostrar_codigo_validacao: stamp.mostrar_codigo_validacao,
        mostrar_hash: stamp.mostrar_hash,
        mostrar_qr_code: stamp.mostrar_qr_code,
      };

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
 * Busca o Responsável Técnico — prioriza cadastro em "Assinaturas e Carimbos"
 * (metadata.tipo_assinante = 'responsavel_tecnico'), escopado por unidade quando possível.
 * Fallback: qualquer carimbo cadastrado como RT no sistema.
 */
export async function resolveRTForUnidade(unidadeId?: string): Promise<ResolvedSignature> {
  const empty = (): ResolvedSignature => ({
    signatoryFound: false, nome: "", cargo: "", conselho: "", unidade: "",
    hasVisualSignature: false, hasStamp: false, hasDigitalSeal: false,
    tipoAssinante: "responsavel_tecnico", source: "fallback", renderMode: "text_only"
  });

  try {
    // 1) Procurar carimbos marcados como RT no metadata, opcionalmente filtrando por unidade
    let query = supabase
      .from('professional_stamps')
      .select('profissional_id, professionals!inner(unidade_principal_id)')
      .eq('bloqueado', false)
      .filter('metadata->>tipo_assinante', 'eq', 'responsavel_tecnico');

    if (unidadeId) {
      query = query.eq('professionals.unidade_principal_id', unidadeId);
    }

    const { data: rtList } = await query.limit(1);
    if (rtList && rtList.length > 0) {
      return resolveSignatureData({ professionalId: rtList[0].profissional_id });
    }

    // 2) Fallback global sem filtro de unidade
    if (unidadeId) {
      const { data: globalRT } = await supabase
        .from('professional_stamps')
        .select('profissional_id')
        .eq('bloqueado', false)
        .filter('metadata->>tipo_assinante', 'eq', 'responsavel_tecnico')
        .limit(1);
      if (globalRT && globalRT.length > 0) {
        return resolveSignatureData({ professionalId: globalRT[0].profissional_id });
      }
    }

    // 3) Último fallback: cargo contendo "Responsável Técnico"
    const { data: byCargo } = await supabase
      .from('professional_stamps')
      .select('profissional_id')
      .eq('bloqueado', false)
      .ilike('cargo', '%Responsável Técnico%')
      .limit(1);
    if (byCargo && byCargo.length > 0) {
      return resolveSignatureData({ professionalId: byCargo[0].profissional_id });
    }

    return empty();
  } catch (err) {
    console.error('Erro em resolveRTForUnidade:', err);
    return empty();
  }
}

/**
 * Busca o Gestor Master — via user_roles ('gestor_master') → professional →
 * "Assinaturas e Carimbos". Fallback: metadata.tipo_assinante = 'gestor_master'.
 */
export async function resolveGestorMasterForUnidade(unidadeId?: string): Promise<ResolvedSignature> {
  const empty = (): ResolvedSignature => ({
    signatoryFound: false, nome: "", cargo: "", conselho: "", unidade: "",
    hasVisualSignature: false, hasStamp: false, hasDigitalSeal: false,
    tipoAssinante: "gestor_master", source: "fallback", renderMode: "text_only"
  });

  try {
    // 1) Buscar user_ids com role gestor_master
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'gestor_master');

    const userIds = (roles || []).map(r => r.user_id).filter(Boolean);

    if (userIds.length > 0) {
      // 2) Encontrar o profissional vinculado (preferir o da unidade)
      let profQ = supabase
        .from('professionals')
        .select('id, unidade_principal_id')
        .in('user_id', userIds);

      const { data: profs } = await profQ;
      if (profs && profs.length > 0) {
        const preferido = unidadeId
          ? profs.find(p => p.unidade_principal_id === unidadeId)
          : null;
        const escolhido = preferido || profs[0];
        const resolved = await resolveSignatureData({ professionalId: escolhido.id });
        if (resolved.signatoryFound) return resolved;
      }
    }

    // 3) Fallback: carimbo marcado como gestor_master no metadata
    const { data: byMeta } = await supabase
      .from('professional_stamps')
      .select('profissional_id')
      .eq('bloqueado', false)
      .filter('metadata->>tipo_assinante', 'eq', 'gestor_master')
      .limit(1);
    if (byMeta && byMeta.length > 0) {
      return resolveSignatureData({ professionalId: byMeta[0].profissional_id });
    }

    return empty();
  } catch (err) {
    console.error('Erro em resolveGestorMasterForUnidade:', err);
    return empty();
  }
}

