import { supabase } from "@/integrations/supabase/client";

export interface StampData {
  nome: string;
  cargo: string;
  conselho: string;
  unidade: string;
  assinaturaBase64?: string;
  carimboBase64?: string;
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
 * Busca os dados de carimbo e converte a assinatura para base64.
 */
export async function fetchStampData(profissionalId: string): Promise<StampData | null> {
  try {
    // 1. Busca o carimbo
    const { data: stamp, error } = await supabase
      .from('professional_stamps')
      .select('*')
      .eq('profissional_id', profissionalId)
      .eq('bloqueado', false)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar professional_stamps:', error);
      return null;
    }

    if (!stamp) {
      console.warn(`[pdfStampUtils] Nenhum carimbo ativo encontrado para o profissional_id: ${profissionalId}`);
      return null;
    }

    // 2. Busca dados do profissional
    const { data: profData } = await supabase
      .from('professionals')
      .select('nome, cargo, unidade_principal_id')
      .eq('id', profissionalId)
      .maybeSingle();

    // 3. Busca nome da unidade se houver ID
    let unidadeNome = "";
    if (profData?.unidade_principal_id) {
      const { data: unitData } = await supabase
        .from('units')
        .select('nome')
        .eq('id', profData.unidade_principal_id)
        .maybeSingle();
      unidadeNome = unitData?.nome || "";
    }

    return processStampData(stamp, { ...profData, unidadeNome });
  } catch (err) {
    console.error('Erro inesperado em fetchStampData:', err);
    return null;
  }
}

async function processStampData(stamp: any, profData: any): Promise<StampData> {
  const metadata = (stamp.metadata as any) || {};
  const BUCKET = 'professional-documents';
  
  let assinaturaBase64: string | undefined = undefined;
  if (stamp.assinatura_path) {
    assinaturaBase64 = await convertStorageImageToBase64(BUCKET, stamp.assinatura_path);
  } else if (stamp.tipo === 'digital_gerado' && stamp.metadata?.signature_svg) {
    // Se for assinatura digital gerada, a assinatura pode estar no metadata como SVG ou dataURL
    // Note: buildSignatureHtml espera uma URL ou Base64.
    assinaturaBase64 = stamp.metadata.signature_svg;
  }

  let carimboBase64: string | undefined = undefined;
  if (stamp.carimbo_path) {
    carimboBase64 = await convertStorageImageToBase64(BUCKET, stamp.carimbo_path);
  }

  return {
    nome: metadata.nome_profissional || profData?.nome || "—",
    cargo: stamp.cargo || profData?.cargo || "—",
    conselho: `${metadata.conselho || ''} ${metadata.registro || ''} ${stamp.uf_conselho ? `(${stamp.uf_conselho})` : ''}`.trim() || "—",
    unidade: metadata.unidade_principal || profData?.unidadeNome || "—",
    assinaturaBase64,
    carimboBase64
  };
}

/**
 * Busca o Responsável Técnico da unidade.
 */
export async function fetchRTForUnidade(unidadeId?: string): Promise<StampData | null> {
  try {
    if (!unidadeId) return null;
    
    // 1. Tenta buscar o RT vinculado especificamente a esta unidade
    const { data } = await supabase
      .from('professional_stamps')
      .select('*, professionals!inner(id, unidade_principal_id)')
      .ilike('cargo', '%Responsável Técnico%')
      .eq('professionals.unidade_principal_id', unidadeId)
      .eq('bloqueado', false)
      .limit(1)
      .maybeSingle();
      
    if (data) {
      return fetchStampData(data.profissional_id);
    }

    // 2. Se não encontrou na unidade, busca o primeiro RT ativo no sistema (Global)
    const { data: globalRT } = await supabase
      .from('professional_stamps')
      .select('profissional_id')
      .ilike('cargo', '%Responsável Técnico%')
      .eq('bloqueado', false)
      .limit(1)
      .maybeSingle();

    if (globalRT) {
      return fetchStampData(globalRT.profissional_id);
    }

    return null;
  } catch (err) {
    console.error('Erro em fetchRTForUnidade:', err);
    return null;
  }
}

/**
 * Busca o Gestor Master da unidade ou do sistema.
 */
export async function fetchGestorMasterForUnidade(unidadeId?: string): Promise<StampData | null> {
  try {
    // 1. Se informada unidade, tenta buscar o Gestor Master vinculado a ela
    if (unidadeId) {
      const { data } = await supabase
        .from('professional_stamps')
        .select('*, professionals!inner(id, unidade_principal_id)')
        .ilike('cargo', '%Gestor Master%')
        .eq('professionals.unidade_principal_id', unidadeId)
        .eq('bloqueado', false)
        .limit(1)
        .maybeSingle();
        
      if (data) {
        return fetchStampData(data.profissional_id);
      }
    }

    // 2. Se não encontrou na unidade (ou não informada), busca qualquer Gestor Master ativo (Global)
    const { data: globalGestor } = await supabase
      .from('professional_stamps')
      .select('profissional_id')
      .ilike('cargo', '%Gestor Master%')
      .eq('bloqueado', false)
      .limit(1)
      .maybeSingle();
      
    if (globalGestor) {
      return fetchStampData(globalGestor.profissional_id);
    }
    return null;
  } catch (err) {
    console.error('Erro em fetchGestorMasterForUnidade:', err);
    return null;
  }
}
