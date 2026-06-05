import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Auditoria: Verificando status de disparo automático...");

    // 1. Verificar se existem templates ativos para os principais eventos
    const { data: templates } = await supabase
      .from("message_templates")
      .select("tipo, ativo")
      .in("tipo", ["troca", "lembrete_plantao", "cadastro_profissional"]);

    // 2. Verificar últimas notificações enviadas e seu status_envio
    const { data: recentNotifs } = await supabase
      .from("notifications")
      .select("id, tipo, canal, status_envio, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    // 3. Verificar logs de envio de e-mail (audit_logs)
    const { data: emailLogs } = await supabase
      .from("audit_logs")
      .select("acao, status, detalhes, created_at")
      .ilike("acao", "%envi%")
      .order("created_at", { ascending: false })
      .limit(10);

    return new Response(JSON.stringify({
      templates,
      recentNotifs,
      emailLogs,
      status_auditoria: "completa"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
