import { supabase } from "@/integrations/supabase/client";

interface NotifyParams {
  professionalId?: string | null;
  userId?: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
}

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
