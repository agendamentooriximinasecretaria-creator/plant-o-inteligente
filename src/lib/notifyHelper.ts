import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  professionalId?: string | null;
  userId?: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
}

/**
 * Dispatch a notification directly to the notifications table.
 * Fast, client-side, non-blocking.
 */
export async function dispatchNotification({ professionalId, userId, tipo, titulo, mensagem }: NotifyParams) {
  try {
    // 1. Internal notification
    await supabase.from("notifications").insert({
      professional_id: professionalId || null,
      user_id: userId || null,
      tipo,
      titulo,
      mensagem,
      lida: false,
      canal: "sistema",
      status_envio: "enviado",
    });

    // 2. Email notification (Automatic trigger via Edge Function)
    // We call the edge function for all notifications to ensure SMTP dispatch if configured
    await supabase.functions.invoke("enviar-notificacao", {
      body: { 
        tipo, 
        destinatarios: [{ professional_id: professionalId, user_id: userId }],
        variaveis: { titulo, mensagem } 
      },
    });
  } catch (err) {
    console.error("Erro ao despachar notificação:", err);
  }
}

interface DispatchViaEdgeParams {
  tipo: string;
  destinatarios: Array<{
    professional_id?: string | null;
    user_id?: string | null;
    nome?: string;
    email?: string;
  }>;
  variaveis?: Record<string, string>;
}

/**
 * Dispatch notification via the enviar-notificacao edge function.
 * Uses templates from message_templates table. Non-blocking.
 */
export async function dispatchNotificationViaEdge({ tipo, destinatarios, variaveis }: DispatchViaEdgeParams) {
  try {
    await supabase.functions.invoke("enviar-notificacao", {
      body: { tipo, destinatarios, variaveis },
    });
  } catch {
    // silent fallback
  }
}
