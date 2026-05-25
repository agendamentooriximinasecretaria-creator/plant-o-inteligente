import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import nodemailer from "https://esm.sh/nodemailer@6.9.13";

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("Iniciando função testar-smtp com Nodemailer");
    
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const { email_teste } = body;
    
    if (!email_teste) return json(400, { error: "O e-mail de teste é obrigatório." });

    const { data: smtpData } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", "gmail_smtp")
      .maybeSingle();

    const smtpCfg = smtpData?.value as any;
    if (!smtpCfg || !smtpCfg.senha || !smtpCfg.email_remetente) {
      return json(400, { error: "Configuração SMTP incompleta." });
    }

    const host = smtpCfg.servidor || "smtp.gmail.com";
    const port = Number(smtpCfg.porta || 587);
    const user = smtpCfg.email_remetente;
    const pass = smtpCfg.senha;

    console.log(`Configurando transportador Nodemailer: ${host}:${port}`);

    // Configuração para Gmail ou SMTP genérico
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true para 465, false para outras portas (usa STARTTLS)
      auth: { user, pass },
      tls: {
        // Não rejeitar certificados não autorizados se necessário, 
        // mas para Gmail é melhor manter padrão ou garantir compatibilidade
        rejectUnauthorized: true 
      }
    });

    console.log("Verificando conexão...");
    try {
      await transporter.verify();
      console.log("Conexão SMTP verificada com sucesso.");
    } catch (verifyError) {
      console.error("Falha na verificação de conexão:", verifyError);
      throw verifyError;
    }

    console.log(`Enviando e-mail de teste para ${email_teste}...`);
    const info = await transporter.sendMail({
      from: `"Teste Sistema" <${user}>`,
      to: email_teste,
      subject: "Teste de Configuração SMTP ✔",
      text: `Este é um e-mail de teste enviado para validar as configurações de SMTP do sistema.\n\nServidor: ${host}\nPorta: ${port}\nRemetente: ${user}\n\nSe você recebeu este e-mail, a configuração está correta!`,
      html: `<h2>Teste de Configuração SMTP</h2><p>Este é um e-mail de teste enviado para validar as configurações de SMTP do sistema.</p><ul><li><b>Servidor:</b> ${host}</li><li><b>Porta:</b> ${port}</li><li><b>Remetente:</b> ${user}</li></ul><p>Se você recebeu este e-mail, a configuração está correta!</p>`,
    });

    console.log("E-mail enviado:", info.messageId);
    return json(200, { success: true, message: `E-mail de teste enviado com sucesso! ID: ${info.messageId}` });

  } catch (error) {
    console.error("Erro na função testar-smtp:", error);
    let errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes("EAUTH") || errorMsg.includes("535")) {
      errorMsg = "Falha de autenticação: Verifique se o e-mail e a senha de aplicativo estão corretos.";
    } else if (errorMsg.includes("ETIMEDOUT")) {
      errorMsg = "Tempo esgotado ao conectar ao servidor SMTP.";
    } else if (errorMsg.includes("ECONNREFUSED")) {
      errorMsg = "Conexão recusada. Verifique o host e a porta.";
    }
    
    return json(502, { error: `Erro SMTP: ${errorMsg}` });
  }
});


