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
    // 1. Busca o carimbo (tentando join com professionals para performance)
    const { data: stamp, error } = await supabase
      .from('professional_stamps')
      .select('*, professionals!inner(nome, cargo, unidade_principal_id)')
      .eq('profissional_id', profissionalId)
      .eq('bloqueado', false)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar professional_stamps:', error);
      // Fallback sem join caso o join falhe por falta de FK ou permissão
      const { data: fallbackStamp } = await supabase
        .from('professional_stamps')
        .select('*')
        .eq('profissional_id', profissionalId)
        .eq('bloqueado', false)
        .maybeSingle();
        
      if (!fallbackStamp) return null;
      
      const { data: profData } = await supabase
        .from('professionals')
        .select('nome, cargo, unidade_principal_id, units!unidade_principal_id(nome)')
        .eq('id', profissionalId)
        .maybeSingle();

      return processStampData(fallbackStamp, profData);
    }

    if (!stamp) return null;
    
    const profData = (stamp as any).professionals || {};
    return processStampData(stamp, profData);
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
  }

  let carimboBase64: string | undefined = undefined;
  if (stamp.carimbo_path) {
    carimboBase64 = await convertStorageImageToBase64(BUCKET, stamp.carimbo_path);
  }

  return {
    nome: metadata.nome_profissional || profData?.nome || "—",
    cargo: stamp.cargo || profData?.cargo || "—",
    conselho: `${metadata.conselho || ''} ${metadata.registro || ''} ${stamp.uf_conselho ? `(${stamp.uf_conselho})` : ''}`.trim() || "—",
    unidade: metadata.unidade_principal || profData?.units?.nome || "—",
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
    
    // Busca na tabela professional_stamps onde o cargo contenha 'Responsável Técnico'
    // E o profissional pertença à unidade informada
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
    return null;
  } catch (err) {
    console.error('Erro em fetchRTForUnidade:', err);
    return null;
  }
}

/**
 * Busca o Gestor Master da unidade.
 */
export async function fetchGestorMasterForUnidade(unidadeId?: string): Promise<StampData | null> {
  try {
    if (!unidadeId) return null;

    // Busca na tabela professional_stamps onde o cargo contenha 'Gestor Master'
    // E o profissional pertença à unidade informada
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
    return null;
  } catch (err) {
    console.error('Erro em fetchGestorMasterForUnidade:', err);
    return null;
  }
}
