import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jwtVerify, type JWTPayload } from "npm:jose@5";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const correlationId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const registrarAudit = async (acao: string, status: string, motivo?: string, extra?: Record<string, unknown>) => {
    try {
      await admin.from("audit_logs").insert({
        acao,
        status,
        modulo: "sso",
        detalhes: {
          correlation_id: correlationId,
          motivo: motivo || "desconhecido",
          ...extra,
        },
      });
    } catch {
      // Não trava a requisição se a gravação de audit falhar
    }
  };

  const fail = async (status: number, motivo: string, extra?: Record<string, unknown>) => {
    await registrarAudit("sso_login_falha", "erro", motivo, extra);
    return json({ ok: false, correlation_id: correlationId, error: motivo, detalhes: extra ?? null }, status);
  };

  try {
    if (req.method !== "POST") return await fail(405, "metodo_nao_permitido");

    let body: { token?: string; provider?: string } = {};
    try {
      body = await req.json();
    } catch {
      return await fail(400, "corpo_invalido");
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.split(".").length !== 3) return await fail(400, "token_ausente_ou_malformado");

    // 1. Consultar Provedor no Banco
    const { data: providerRow, error: providerError } = await admin
      .from("sso_providers")
      .select("*")
      .eq("ativo", true)
      .eq("slug", body.provider || "hsm")
      .maybeSingle();

    if (providerError || !providerRow) {
      return await fail(401, "provedor_desconhecido_ou_inativo", { erro_banco: providerError?.message });
    }

    // 2. Definir Chave HS256 (Ambiente, Banco ou Contingência Estática)
    const jwtSecret =
      Deno.env.get("SSO_JWT_SECRET") ||
      providerRow.public_key ||
      "sms_oriximina_sso_secret_key_2026_prod";

    const secretKey = new TextEncoder().encode(jwtSecret);

    // 3. Validar Token JWT
    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, secretKey, {
        algorithms: providerRow.allowed_algs || ["HS256"],
        issuer: providerRow.issuer,
        audience: providerRow.audience,
        clockTolerance: providerRow.clock_skew_seconds || 60,
      });
      payload = verified.payload;
    } catch (e: any) {
      return await fail(401, "verificacao_jwt_falhou", { detalhe: e?.message || String(e) });
    }

    const email = String(payload.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return await fail(401, "email_ausente_no_token");

    // 4. Localizar ou Criar Usuário (Auto-Provisioning)
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, nome, ativo")
      .ilike("email", email)
      .maybeSingle();

    let userId = profile?.user_id;
    let userName = profile?.nome || (payload.nome as string) || email;

    if (!userId) {
      if (!providerRow.auto_provision) {
        return await fail(403, "provisionamento_desabilitado", { email });
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nome: userName, sso_provider: providerRow.slug },
      });

      if (createError || !created?.user) {
        return await fail(500, "falha_criacao_usuario_auth", { detalhe: createError?.message });
      }

      userId = created.user.id;

      await admin.from("profiles").insert({
        user_id: userId,
        nome: userName,
        email,
        role: providerRow.default_role || "profissional",
        ativo: true,
      });

      await admin.from("user_roles").insert({
        user_id: userId,
        role: providerRow.default_role || "profissional",
      });
    }

    // 5. Garantir E-mail Confirmado
    await admin.auth.admin.updateUserById(userId, { email_confirm: true });

    // 6. Gerar Link de Autenticação Automática
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !link?.properties?.hashed_token) {
      return await fail(500, "falha_geracao_link_sessao", { detalhe: linkError?.message });
    }

    await registrarAudit("sso_login_sucesso", "sucesso", "sucesso", { email, userId });

    return json({
      ok: true,
      correlation_id: correlationId,
      provider: providerRow.slug,
      email,
      session_token: link.properties.hashed_token,
      token_type: "magiclink",
    });
  } catch (err: any) {
    return await fail(500, "erro_fatal_edge_function", { mensagem: err?.message || String(err) });
  }
});
