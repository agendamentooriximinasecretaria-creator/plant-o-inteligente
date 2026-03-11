import { supabase } from '@/integrations/supabase/client';

export async function logAudit(acao: string, modulo: string, detalhes?: Record<string, unknown>, status: string = 'sucesso') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      usuario_nome: user?.email || 'Sistema',
      acao,
      modulo,
      status,
      detalhes: detalhes as any,
    });
  } catch (e) {
    console.error('Erro ao registrar log de auditoria:', e);
  }
}
