import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function substituirVariaveis(texto: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v || ""), texto);
}

function extrairTextoPlano(texto: string): string {
  return texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = getAdmin();
    const { tipo, destinatarios, variaveis } = await req.json();

    if (!tipo || !destinatarios || !Array.isArray(destinatarios) || destinatarios.length === 0) {
      return json(400, { error: "tipo e destinatarios são obrigatórios." });
    }

    // Get template
    const { data: template } = await admin
      .from("message_templates")
      .select("assunto, mensagem")
      .eq("tipo", tipo)
      .eq("ativo", true)
      .maybeSingle();

    const vars = variaveis || {};
    const resultados = [];

    for (const dest of destinatarios) {
      const destVars = { ...vars, nome_profissional: dest.nome || "" };
      const titulo = template
        ? substituirVariaveis(template.assunto, destVars)
        : vars.titulo || tipo;
      const mensagem = template
        ? substituirVariaveis(template.mensagem, destVars)
        : vars.mensagem || tipo;

      // 1. Always create internal notification
      await admin.from("notifications").insert({
        professional_id: dest.professional_id || null,
        user_id: dest.user_id || null,
        tipo,
        titulo,
        mensagem: extrairTextoPlano(mensagem),
        lida: false,
        canal: "sistema",
        status_envio: "enviado",
      });

      resultados.push({ id: dest.professional_id || dest.user_id, status: "notificado" });
    }

    return json(200, { success: true, count: resultados.length, resultados });
  } catch (error) {
    console.error("enviar-notificacao error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return json(500, { error: message });
  }
});
