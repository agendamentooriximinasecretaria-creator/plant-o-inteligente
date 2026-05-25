import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { email_teste } = await req.json();
    if (!email_teste) return json(400, { error: "email_teste é obrigatório." });

    // Load SMTP config
    const { data: smtpData } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "gmail_smtp")
      .maybeSingle();

    const smtpCfg = smtpData?.value as any;
    if (!smtpCfg || !smtpCfg.senha || !smtpCfg.email_remetente) {
      return json(400, { error: "Configuração SMTP incompleta ou não encontrada." });
    }

    const servidor = smtpCfg.servidor || "smtp.gmail.com";
    const porta = Number(smtpCfg.porta || 587);
    const remetente = smtpCfg.email_remetente;
    const senha = smtpCfg.senha;

    console.log(`Testando SMTP: ${remetente} via ${servidor}:${porta}`);

    let client: SMTPClient | null = null;
    try {
      const useTls = porta === 465;
      client = new SMTPClient({
        connection: {
          hostname: servidor,
          port: porta,
          tls: useTls,
          auth: { username: remetente, password: senha },
        },
        debug: { log: true, send: true, recv: true }
      });

      await client.send({
        from: `Teste de Sistema <${remetente}>`,
        to: email_teste,
        subject: "Teste de Configuração SMTP",
        content: `Este é um e-mail de teste enviado para validar as configurações de SMTP do sistema.\n\nServidor: ${servidor}\nPorta: ${porta}\nRemetente: ${remetente}\n\nSe você recebeu este e-mail, a configuração está correta!`,
        html: `<h2>Teste de Configuração SMTP</h2><p>Este é um e-mail de teste enviado para validar as configurações de SMTP do sistema.</p><ul><li><b>Servidor:</b> ${servidor}</li><li><b>Porta:</b> ${porta}</li><li><b>Remetente:</b> ${remetente}</li></ul><p>Se você recebeu este e-mail, a configuração está correta!</p>`,
      });

      return json(200, { success: true, message: "E-mail de teste enviado com sucesso!" });
    } catch (e) {
      console.error("Erro no teste SMTP:", e);
      let errorMsg = e instanceof Error ? e.message : String(e);
      
      if (errorMsg.includes("Authentication failed") || errorMsg.includes("Invalid login")) {
        errorMsg = "Falha de autenticação: Usuário ou senha incorretos.";
      } else if (errorMsg.includes("Connection timeout") || errorMsg.includes("ETIMEDOUT")) {
        errorMsg = "Tempo esgotado ao conectar ao servidor SMTP.";
      } else if (errorMsg.includes("ECONNREFUSED")) {
        errorMsg = "Conexão recusada pelo servidor SMTP (verifique host e porta).";
      }

      return json(502, { error: errorMsg });
    } finally {
      try { if (client) await client.close(); } catch { /* ignore */ }
    }
  } catch (error) {
    console.error("testar-smtp error:", error);
    return json(500, { error: error instanceof Error ? error.message : "Erro interno" });
  }
});
