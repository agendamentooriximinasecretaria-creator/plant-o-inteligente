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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the caller and verify manager role
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Não autenticado." });
    }
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Sessão inválida." });

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isManager = (roles || []).some(
      (r: { role: string }) => r.role === "gestor_master" || r.role === "coordenador",
    );
    if (!isManager) return json(403, { error: "Apenas gestores podem enviar dados de acesso." });

    const body = await req.json();
    const professionalId = body?.professional_id as string | undefined;
    if (!professionalId) return json(400, { error: "professional_id é obrigatório." });

    const { data: prof, error: pErr } = await admin
      .from("professionals")
      .select("id, nome, email")
      .eq("id", professionalId)
      .maybeSingle();
    if (pErr || !prof) return json(404, { error: "Profissional não encontrado." });
    if (!prof.email) return json(400, { error: "Profissional não possui e-mail cadastrado." });

    const siteUrl = body?.site_url || "https://gestorplantaosmsoriximina.lovable.app";

    const subject = "Acesso ao sistema de plantões";
    const empresa = "Gestão de Plantões - SMS Oriximiná";
    const greeting = `Olá, ${prof.nome}.`;
    const textBody = `${greeting}\n\nSeu acesso ao sistema de plantões está disponível.\n\nLink de acesso:\n${siteUrl}\n\nLogin / usuário:\n${prof.email}\n\nCaso ainda não tenha senha (ou tenha esquecido), acesse o link acima e utilize a opção "Esqueci minha senha" para definir uma nova.\n\nAtenciosamente,\n${empresa}`;

    const htmlBody = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;background:#ffffff;padding:24px">
  <div style="max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
    <h2 style="margin:0 0 16px;color:#2563EB">Acesso ao sistema de plantões</h2>
    <p>${escapeHtml(greeting)}</p>
    <p>Seu acesso ao sistema de plantões está disponível.</p>
    <p><strong>Link de acesso:</strong><br/>
       <a href="${escapeHtml(siteUrl)}" style="color:#2563EB">${escapeHtml(siteUrl)}</a></p>
    <p><strong>Login / usuário:</strong><br/>${escapeHtml(prof.email)}</p>
    <p style="color:#475569;font-size:14px">Caso ainda não tenha senha (ou tenha esquecido), acesse o link acima e utilize a opção <em>"Esqueci minha senha"</em> para definir uma nova.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="color:#64748b;font-size:12px;margin:0">${escapeHtml(empresa)}</p>
  </div>
</body></html>`;

    // Load config (webhook + smtp)
    const { data: settings } = await admin
      .from("system_settings")
      .select("key, value")
      .in("key", ["webhook", "gmail_smtp"]);
    const cfg: Record<string, any> = {};
    for (const row of settings || []) cfg[(row as any).key] = (row as any).value || {};

    let canal = "";
    let lastError = "";
    const tentativas: Array<{ canal: string; ok: boolean; erro?: string; detalhe?: string }> = [];

    // 1) SMTP (prioritário — envio real garantido)
    const smtpCfg = cfg.gmail_smtp;
    const remetente = smtpCfg?.email_remetente;
    const senha = smtpCfg?.senha;
    const servidor = smtpCfg?.servidor || "smtp.gmail.com";
    const porta = Number(smtpCfg?.porta || 587);

    if (senha && remetente && smtpCfg?.status === "ativo") {
      console.log(`[SMTP] Tentando ${servidor}:${porta} como ${remetente} -> ${prof.email}`);
      try {
        const transporter = nodemailer.createTransport({
          host: servidor,
          port: porta,
          secure: porta === 465,
          auth: { user: remetente, pass: senha },
          tls: { rejectUnauthorized: true },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        });
        await transporter.verify();
        const info = await transporter.sendMail({
          from: `"${empresa}" <${remetente}>`,
          to: prof.email,
          subject,
          text: textBody,
          html: htmlBody,
        });
        console.log("[SMTP] OK", { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
        if (info.accepted && info.accepted.length > 0) {
          canal = "smtp";
          tentativas.push({ canal: "smtp", ok: true, detalhe: `messageId=${info.messageId}` });
        } else {
          lastError = `SMTP rejeitou o destinatário: ${JSON.stringify(info.rejected || [])}`;
          tentativas.push({ canal: "smtp", ok: false, erro: lastError });
        }
      } catch (e) {
        let msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("EAUTH") || msg.includes("535")) msg = "Falha de autenticação SMTP (verifique e-mail/senha de app).";
        else if (msg.includes("ETIMEDOUT")) msg = "Timeout ao conectar no servidor SMTP.";
        else if (msg.includes("ECONNREFUSED")) msg = "Servidor SMTP recusou a conexão (host/porta).";
        else if (msg.includes("ENOTFOUND")) msg = "Servidor SMTP não encontrado (host inválido).";
        lastError = `SMTP: ${msg}`;
        tentativas.push({ canal: "smtp", ok: false, erro: lastError });
        console.error("[SMTP] Erro:", e);
      }
    } else {
      const motivo = !smtpCfg ? "sem configuração" : smtpCfg?.status !== "ativo" ? "desativado" : "credenciais ausentes";
      tentativas.push({ canal: "smtp", ok: false, erro: `SMTP não utilizado (${motivo}).` });
      console.log(`[SMTP] Pulado: ${motivo}`);
    }

    // 2) Webhook Make.com (fallback)
    if (!canal) {
      const webhookUrl = cfg.webhook?.url;
      const webhookAtivo = cfg.webhook?.ativo === true;
      if (webhookAtivo && webhookUrl) {
        console.log(`[Webhook] Tentando ${webhookUrl}`);
        try {
          const resp = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: "acesso_profissional",
              destinatario: { nome: prof.nome, email: prof.email },
              assunto: subject,
              mensagem: textBody,
              html: htmlBody,
              link: siteUrl,
              login: prof.email,
            }),
          });
          const respText = await resp.text().catch(() => "");
          if (resp.ok) {
            canal = "webhook";
            tentativas.push({ canal: "webhook", ok: true, detalhe: `status=${resp.status}` });
            console.log("[Webhook] OK status:", resp.status, "body:", respText.slice(0, 200));
          } else {
            lastError = `Webhook respondeu status ${resp.status}: ${respText.slice(0, 200)}`;
            tentativas.push({ canal: "webhook", ok: false, erro: lastError });
            console.error("[Webhook] Erro:", lastError);
          }
        } catch (e) {
          lastError = `Webhook falhou: ${e instanceof Error ? e.message : String(e)}`;
          tentativas.push({ canal: "webhook", ok: false, erro: lastError });
          console.error("[Webhook] Exceção:", e);
        }
      } else {
        tentativas.push({ canal: "webhook", ok: false, erro: "Webhook não configurado/ativo." });
      }
    }

    if (!canal) {
      await admin.from("audit_logs").insert({
        modulo: "profissionais",
        acao: "envio_dados_acesso_falhou",
        user_id: userData.user.id,
        usuario_nome: userData.user.email || "sistema",
        status: "erro",
        detalhes: { professional_id: professionalId, destino: prof.email, tentativas, lastError },
      });
      return json(502, { error: lastError || "Falha ao enviar.", tentativas });
    }

    // Audit + timestamp
    await admin
      .from("professionals")
      .update({ acesso_email_enviado_em: new Date().toISOString() })
      .eq("id", professionalId);

    await admin.from("audit_logs").insert({
      modulo: "profissionais",
      acao: "enviou_dados_acesso",
      user_id: userData.user.id,
      usuario_nome: userData.user.email || "sistema",
      status: "sucesso",
      detalhes: { professional_id: professionalId, canal, destino: prof.email, tentativas },
    });

    return json(200, { success: true, canal, destino: prof.email, tentativas });
  } catch (e) {
    console.error("enviar-acesso-profissional erro:", e);
    return json(500, { error: e instanceof Error ? e.message : "Erro interno" });
  }
});
