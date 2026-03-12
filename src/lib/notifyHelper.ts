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
  } catch {
    // silent — notifications are non-critical
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
