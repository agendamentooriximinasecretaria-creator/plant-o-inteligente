import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
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

    // Site URL (preferir custom domain do app)
    const siteUrl =
      body?.site_url ||
      "https://gestorplantaosmsoriximina.lovable.app";

    const subject = "Acesso ao sistema de plantões";
    const empresa = "Gestão de Plantões - SMS Oriximiná";
    const greeting = `Olá, ${prof.nome}.`;
    const textBody = `${greeting}

Seu acesso ao sistema de plantões está disponível.

Link de acesso:
${siteUrl}

Login / usuário:
${prof.email}

Caso ainda não tenha senha (ou tenha esquecido), acesse o link acima e utilize a opção "Esqueci minha senha" para definir uma nova.

Atenciosamente,
${empresa}`;

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

    // 1) Webhook Make.com (se ativo)
    const webhookUrl = cfg.webhook?.url;
    const webhookAtivo = cfg.webhook?.ativo === true;
    if (webhookAtivo && webhookUrl) {
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
        if (resp.ok) canal = "webhook";
        else lastError = `Webhook respondeu ${resp.status}`;
      } catch (e) {
        lastError = `Webhook falhou: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // 2) SMTP Gmail
    if (!canal) {
      const smtpCfg = cfg.gmail_smtp;
      const remetente = smtpCfg?.email_remetente;
      const senha = smtpCfg?.senha;
      const servidor = smtpCfg?.servidor || "smtp.gmail.com";
      const porta = Number(smtpCfg?.porta || 587);

      console.log(`Tentando envio via SMTP: ${remetente} em ${servidor}:${porta} (Status: ${smtpCfg?.status})`);

      if (senha && remetente && smtpCfg?.status === "ativo") {
        let client: SMTPClient | null = null;
        try {
          const useTls = porta === 465;
          
          console.log(`Conectando ao SMTP... (TLS: ${useTls})`);
          
          client = new SMTPClient({
            connection: {
              hostname: servidor,
              port: porta,
              tls: useTls,
              auth: { username: remetente, password: senha },
            },
            debug: {
              log: true,
              send: true,
              recv: true,
            }
          });
          
          console.log("Enviando mensagem...");
          
          await client.send({
            from: `${empresa} <${remetente}>`,
            to: prof.email,
            subject,
            content: textBody,
            html: htmlBody,
          });
          canal = "smtp";
          console.log(`E-mail enviado com sucesso via SMTP para ${prof.email}`);
        } catch (e) {
          lastError = `Falha na autenticação ou envio SMTP: ${e instanceof Error ? e.message : String(e)}`;
          console.error("Erro detalhado SMTP:", e);
        } finally {
          try { await client?.close(); } catch { /* ignore */ }
        }
      } else {
        if (smtpCfg?.status !== "ativo") {
          lastError = "O serviço de e-mail SMTP está desativado nas configurações.";
        } else if (!remetente || !senha) {
          lastError = "Credenciais SMTP não configuradas ou incompletas.";
        } else {
          lastError = "Configuração SMTP inválida.";
        }
      }
    }

    if (!canal) {
      console.error("enviar-acesso-profissional falhou:", lastError);
      return json(502, { error: lastError || "Falha ao enviar e-mail." });
    }

    // Update timestamp + audit
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
      detalhes: { professional_id: professionalId, canal, destino: prof.email },
    });

    return json(200, { success: true, canal });
  } catch (e) {
    console.error("enviar-acesso-profissional erro:", e);
    return json(500, { error: e instanceof Error ? e.message : "Erro interno" });
  }
});
