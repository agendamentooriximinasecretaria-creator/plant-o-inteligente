import { supabase } from "@/integrations/supabase/client";

export interface StampData {
  nome: string;
  cargo: string;
  conselho: string;
  unidade: string;
  assinaturaBase64?: string;
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
  } catch {
    return undefined;
  }
}

/** 
 * Busca os dados de carimbo e converte a assinatura para base64.
 */
export async function fetchStampData(profissionalId: string): Promise<StampData | null> {
  const { data: stamp, error } = await supabase
    .from('professional_stamps')
    .select('*, professionals_safe(nome, unidade_principal:unidade_principal_id(nome))')
    .eq('profissional_id', profissionalId)
    .eq('bloqueado', false)
    .maybeSingle();

  if (error || !stamp) return null;

  const metadata = (stamp.metadata as any) || {};
  const profData = (stamp as any).professionals_safe || {};
  
  let assinaturaBase64: string | undefined = undefined;
  if (stamp.assinatura_path) {
    assinaturaBase64 = await convertStorageImageToBase64('signatures', stamp.assinatura_path);
  }

  return {
    nome: metadata.nome_profissional || profData.nome || "—",
    cargo: stamp.cargo || "—",
    conselho: `${metadata.conselho || ''} ${metadata.registro || ''} ${stamp.uf_conselho ? `(${stamp.uf_conselho})` : ''}`.trim() || "—",
    unidade: metadata.unidade_principal || profData.unidade_principal?.nome || "—",
    assinaturaBase64
  };
}

/**
 * Busca o Responsável Técnico da unidade.
 * Critério: profissional com cargo que contenha "Responsável Técnico" e esteja na mesma unidade.
 */
export async function fetchRTForUnidade(unidadeId?: string): Promise<StampData | null> {
  try {
    let query = supabase
      .from('professional_stamps')
      .select('*, professionals_safe!inner(id, unidade_principal_id)')
      .ilike('cargo', '%Responsável Técnico%')
      .eq('bloqueado', false);
      
    if (unidadeId) {
      query = query.eq('professionals_safe.unidade_principal_id', unidadeId);
    }

    const { data } = await query.limit(1).maybeSingle();
    
    if (data) {
      return fetchStampData(data.profissional_id);
    }
    return null;
  } catch {
    return null;
  }
}
