import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Iniciando função testar-smtp");
    
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const { email_teste } = body;
    
    if (!email_teste) {
      console.error("Erro: email_teste não fornecido");
      return json(400, { error: "O e-mail de teste é obrigatório." });
    }

    console.log(`Buscando configurações para e-mail de teste: ${email_teste}`);

    // Load SMTP config
    const { data: smtpData, error: dbError } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "gmail_smtp")
      .maybeSingle();

    if (dbError) {
      console.error("Erro ao buscar configurações no banco:", dbError);
      return json(500, { error: `Erro ao buscar configurações: ${dbError.message}` });
    }

    const smtpCfg = smtpData?.value as any;
    if (!smtpCfg || !smtpCfg.senha || !smtpCfg.email_remetente) {
      console.error("Configuração SMTP incompleta:", smtpCfg);
      return json(400, { error: "Configuração SMTP incompleta. Verifique se o e-mail remetente e a senha de aplicativo foram informados." });
    }

    const servidor = smtpCfg.servidor || "smtp.gmail.com";
    const porta = Number(smtpCfg.porta || 587);
    const remetente = smtpCfg.email_remetente;
    const senha = smtpCfg.senha;

    console.log(`Tentando conexão SMTP: ${servidor}:${porta} como ${remetente}`);

    let client: SMTPClient | null = null;
    try {
      // Porta 465 geralmente usa TLS direto (Implicit TLS)
      // Porta 587 usa STARTTLS (Explicit TLS)
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

      console.log("Enviando e-mail de teste...");
      
      await client.send({
        from: `Teste Sistema <${remetente}>`,
        to: email_teste,
        subject: "Teste de Configuração SMTP",
        content: `Este é um e-mail de teste enviado para validar as configurações de SMTP do sistema.\n\nServidor: ${servidor}\nPorta: ${porta}\nRemetente: ${remetente}\n\nSe você recebeu este e-mail, a configuração está correta!`,
        html: `<h2>Teste de Configuração SMTP</h2><p>Este é um e-mail de teste enviado para validar as configurações de SMTP do sistema.</p><ul><li><b>Servidor:</b> ${servidor}</li><li><b>Porta:</b> ${porta}</li><li><b>Remetente:</b> ${remetente}</li></ul><p>Se você recebeu este e-mail, a configuração está correta!</p>`,
      });

      console.log("E-mail de teste enviado com sucesso!");
      return json(200, { success: true, message: "E-mail de teste enviado com sucesso! Verifique sua caixa de entrada." });
    } catch (e) {
      console.error("Erro detalhado no envio SMTP:", e);
      let errorMsg = e instanceof Error ? e.message : String(e);
      
      // Mapeamento de erros comuns para mensagens amigáveis
      if (errorMsg.includes("Authentication failed") || errorMsg.includes("Invalid login") || errorMsg.includes("535")) {
        errorMsg = "Falha de autenticação SMTP: O e-mail ou a senha de aplicativo estão incorretos. No Gmail, verifique se usou uma 'Senha de Aplicativo'.";
      } else if (errorMsg.includes("Connection timeout") || errorMsg.includes("ETIMEDOUT")) {
        errorMsg = "Tempo esgotado ao conectar ao servidor SMTP. Verifique o host e a porta.";
      } else if (errorMsg.includes("ECONNREFUSED")) {
        errorMsg = "Conexão recusada pelo servidor SMTP. Verifique se o servidor e a porta estão corretos.";
      } else if (errorMsg.includes("BadResource") || errorMsg.includes("invalid cmd")) {
        errorMsg = "Erro de protocolo (TLS/STARTTLS). Tente mudar a porta (465 para TLS ou 587 para STARTTLS).";
      }

      return json(502, { error: `Erro SMTP: ${errorMsg}` });
    } finally {
      if (client) {
        try {
          await client.close();
          console.log("Conexão SMTP encerrada.");
        } catch (err) {
          console.warn("Erro ao fechar cliente SMTP:", err);
        }
      }
    }
  } catch (error) {
    console.error("Erro crítico na função testar-smtp:", error);
    return json(500, { error: `Erro interno: ${error instanceof Error ? error.message : String(error)}` });
  }
});

