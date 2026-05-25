import { supabase } from '@/integrations/supabase/client';

export type SignatureRole = 'profissional' | 'coordenador' | 'gestor_master' | 'institucional';
export type SignatureStatus = 'ativa' | 'revogada' | 'substituida';

export interface SignableDocument {
  document_type: string;          // ex: 'comprovante_plantao'
  document_id: string;            // id externo
  document_version?: number;      // default 1
  document_title?: string;
  /** Conteúdo final (HTML ou texto) usado para gerar o hash */
  content: string;
  metadata?: Record<string, any>;
}

export interface SignatureRecord {
  id: string;
  document_type: string;
  document_id: string;
  document_version: number;
  document_title: string | null;
  content_hash: string;
  validation_code: string;
  signed_by_user_id: string;
  signed_by_professional_id: string | null;
  signer_name: string;
  signer_role: SignatureRole;
  signed_at: string;
  status: SignatureStatus;
  metadata: Record<string, any>;
}

/** SHA-256 hex completo do conteúdo. */
export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Código curto (12 chars) derivado do hash + timestamp. */
export function shortCode(hashHex: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  return (hashHex.slice(0, 8) + ts).toUpperCase().slice(0, 12);
}

/** Best-effort para obter IP público (não bloqueia se falhar). */
async function fetchClientIp(): Promise<string | null> {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ip || null;
  } catch { return null; }
}

/**
 * Reautentica o usuário com a senha e cria a assinatura.
 * Lança erro se a senha estiver incorreta ou se houver violação de regra.
 */
export async function signDocument(
  doc: SignableDocument,
  opts: { password: string; role: SignatureRole; previousSignatureId?: string | null }
): Promise<SignatureRecord> {
  const sb = supabase as any;
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;
  if (!user || !user.email) throw new Error('Sessão inválida. Faça login novamente.');

  // Reautenticação obrigatória
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: opts.password });
  if (signInErr) throw new Error('Senha incorreta. Não foi possível confirmar a assinatura.');

  // Profissional vinculado e Carimbo
  const { data: prof } = await supabase.from('professionals').select('id,nome').eq('user_id', user.id).maybeSingle();
  const { data: profile } = await supabase.from('profiles').select('nome,role').eq('user_id', user.id).maybeSingle();
  const { data: stamp } = await supabase.from('professional_stamps').select('*').eq('profissional_id', (prof as any)?.id).eq('bloqueado', false).maybeSingle();
  
  const signerName = (prof as any)?.nome || (profile as any)?.nome || user.email;
  const metadata = {
    ...(doc.metadata ?? {}),
    nome_profissional: signerName,
    cargo: stamp?.cargo,
    conselho: (stamp?.metadata as any)?.conselho,
    registro: (stamp?.metadata as any)?.registro,
    uf_conselho: stamp?.uf_conselho,
    unidade: (stamp?.metadata as any)?.unidade_principal,
  };

  const hash = await sha256Hex(doc.content);
  const code = shortCode(hash);
  const ip = await fetchClientIp();

  const payload = {
    document_type: doc.document_type,
    document_id: doc.document_id,
    document_version: doc.document_version ?? 1,
    document_title: doc.document_title ?? null,
    content_hash: hash,
    validation_code: code,
    signed_by_user_id: user.id,
    signed_by_professional_id: (prof as any)?.id ?? null,
    signer_name: signerName,
    signer_role: opts.role,
    ip_address: ip,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    previous_signature_id: opts.previousSignatureId ?? null,
    metadata,
    status: 'ativa' as const,
  };

  const { data, error } = await sb.from('document_signatures').insert(payload).select('*').single();
  if (error) {
    if (/unique/i.test(error.message)) {
      // colisão extremamente improvável; tentar novamente com sufixo
      payload.validation_code = shortCode(hash + Math.random().toString(36));
      const retry = await sb.from('document_signatures').insert(payload).select('*').single();
      if (retry.error) throw retry.error;
      return retry.data as SignatureRecord;
    }
    throw error;
  }
  return data as SignatureRecord;
}

/** Lista assinaturas existentes para um documento. */
export async function listSignatures(documentType: string, documentId: string): Promise<SignatureRecord[]> {
  const sb = supabase as any;
  const { data, error } = await sb.from('document_signatures')
    .select('*').eq('document_type', documentType).eq('document_id', documentId)
    .order('signed_at', { ascending: true });
  if (error) throw error;
  return (data || []) as SignatureRecord[];
}

/** Revoga uma assinatura (apenas Gestor Master pela RLS). */
export async function revokeSignature(id: string, motivo: string): Promise<void> {
  const sb = supabase as any;
  const { data: u } = await supabase.auth.getUser();
  const { error } = await sb.from('document_signatures')
    .update({ status: 'revogada', revoked_at: new Date().toISOString(), revoked_by: u?.user?.id, revoke_reason: motivo })
    .eq('id', id);
  if (error) throw error;
}

const ROLE_LABEL: Record<SignatureRole, string> = {
  profissional: 'Profissional de saúde',
  coordenador: 'Coordenador',
  gestor_master: 'Gestor Master',
  institucional: 'Assinatura institucional',
};

/** Bloco visual HTML para inserir no documento (PDF ou impressão). */
export function renderSignatureBlock(sig: SignatureRecord, opts?: { baseUrl?: string }): string {
  const dt = new Date(sig.signed_at).toLocaleString('pt-BR');
  const base = opts?.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const validateUrl = `${base}/validar/${sig.validation_code}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(validateUrl)}`;
  const role = ROLE_LABEL[sig.signer_role];
  const competence = sig.metadata?.competence ? ` · Competência: ${sig.metadata.competence.split('-').reverse().join('/')}` : '';

  return `
  <div style="margin-top:18px;padding:10px 12px;border:1px solid #888;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.45;display:flex;gap:12px;align-items:center">
    <img src="${qr}" alt="QR validação" style="width:90px;height:90px;flex-shrink:0"/>
    <div>
      <div><strong>Documento assinado eletronicamente</strong> por <strong>${sig.signer_name}</strong>, ${role} ${((sig.metadata as any)?.conselho || '')} ${((sig.metadata as any)?.registro || '')}${competence}, em ${dt}.</div>
      <div>Código de validação: <strong>${sig.validation_code}</strong></div>
      <div>Verifique em ${base}/validar/${sig.validation_code}</div>
      <div style="font-size:10px;color:#555;margin-top:2px">Hash SHA-256: ${sig.content_hash.slice(0, 32)}…</div>
      <div style="font-size:10px;color:#777">Assinatura eletrônica interna do GestorPlantão. Não substitui assinatura digital ICP-Brasil.</div>
    </div>
  </div>`;
}
