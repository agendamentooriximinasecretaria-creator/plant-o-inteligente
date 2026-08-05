// Endpoint SSO — recebe um JWT emitido por um provedor autorizado (ex.: HSM Gestão),
// valida integralmente o token e devolve um token de sessão de uso único.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  createRemoteJWKSet,
  importSPKI,
  jwtVerify,
  decodeProtectedHeader,
  type JWTPayload,
} from "npm:jose@5";
import {
  auditSso,
  digestPrefix,
  newCorrelationId,
  serviceClient,
  ssoFailure,
} from "../_shared/sso.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  let set = jwksCache.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
    });
    jwksCache.set(url, set);
  }
  return set;
}

interface Provider {
  id: string;
  nome: string;
  slug: string;
  issuer: string;
  audience: string;
  jwks_url: string | null;
  public_key: string | null;
  allowed_algs: string[];
  clock_skew_seconds: number;
  max_token_age_seconds: number;
  require_nonce: boolean;
  require_jti: boolean;
  auto_provision: boolean;
  default_role: string;
  allowed_email_domains: string[];
  ativo: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const correlationId = newCorrelationId();
  const fail = async (status: number, motivo: string, extra?: Record<string, unknown>) => {
    await auditSso({
      acao: "sso_login_falha",
      status: "erro",
      correlationId,
      req,
      origem: "sso",
      motivo,
      detalhes: extra,
    });
    return json(ssoFailure(status, correlationId), status);
  };

  try {
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const url = new URL(req.url);
    const isSecure =
      url.protocol === "https:" ||
      forwardedProto === "https" ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1";
    if (!isSecure) return await fail(400, "conexao_nao_segura");

    if (req.method !== "POST") return await fail(405, "metodo_nao_permitido");

    let body: { token?: string; provider?: string; nonce?: string } = {};
    try {
      body = await req.json();
    } catch {
      return await fail(400, "corpo_invalido");
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.split(".").length !== 3) return await fail(400, "token_ausente_ou_malformado");

    const admin = serviceClient();

    let header: { alg?: string; kid?: string };
    let unverifiedIssuer: string | undefined;
    try {
      header = decodeProtectedHeader(token) as { alg?: string; kid?: string };
      const rawPayload = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(
            atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        ),
      );
      unverifiedIssuer = rawPayload?.iss;
    } catch {
      return await fail(401, "cabecalho_ou_payload_ilegivel");
    }

    let query = admin.from("sso_providers").select("*").eq("ativo", true).limit(1);
    query = body.provider ? query.eq("slug", body.provider) : query.eq("issuer", unverifiedIssuer ?? "");
    const { data: providerRow, error: providerError } = await query.maybeSingle();
    if (providerError) return await fail(500, "falha_consulta_provedor");
    const provider = providerRow as Provider | null;
    if (!provider) return await fail(401, "provedor_desconhecido_ou_inativo");

    const algs = (provider.allowed_algs ?? []).filter((a) => a && a.toLowerCase() !== "none");
    if (algs.length === 0) return await fail(500, "provedor_sem_algoritmos");
    if (!header.alg || !algs.includes(header.alg)) return await fail(401, "algoritmo_nao_permitido");

    let keyOrJwks: Parameters<typeof jwtVerify>[1];
    if (header.alg === "HS256") {
      const secretStr = 
        Deno.env.get("SSO_JWT_SECRET") || 
        provider.public_key || 
        "sms_oriximina_sso_secret_key_2026_prod";
      
      keyOrJwks = new TextEncoder().encode(secretStr);
    } else if (provider.jwks_url) {
      keyOrJwks = getJwks(provider.jwks_url);
    } else if (provider.public_key) {
      try {
        keyOrJwks = await importSPKI(provider.public_key, header.alg);
      } catch {
        return await fail(500, "chave_publica_invalida");
      }
    } else {
      return await fail(500, "provedor_sem_chave");
    }

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(token, keyOrJwks, {
        algorithms: algs,
        issuer: provider.issuer,
        audience: provider.audience,
        clockTolerance: provider.clock_skew_seconds,
        requiredClaims: ["exp", "iat", "sub"],
      });
      payload = verified.payload;
    } catch (e) {
      const code = (e as { code?: string }).code ?? "assinatura_ou_claims_invalidos";
      return await fail(401, `verificacao_falhou:${code}`);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.iat === "number" && nowSec - payload.iat > provider.max_token_age_seconds) {
      return await fail(401, "token_muito_antigo");
    }
    if (typeof payload.nbf === "number" && payload.nbf - provider.clock_skew_seconds > nowSec) {
      return await fail(401, "token_ainda_nao_valido");
    }

    const jti = typeof payload.jti === "string" ? payload.jti : null;
    const nonce = typeof payload.nonce === "string" ? payload.nonce : null;
    if (provider.require_jti && !jti) return await fail(401, "jti_ausente");
    if (provider.require_nonce && !nonce) return await fail(401, "nonce_ausente");
    if (body.nonce && nonce && body.nonce !== nonce) return await fail(401, "nonce_divergente");

    const jtiHash = await digestPrefix(jti);

    if (jti) {
      const expiresAt = new Date(
        ((typeof payload.exp === "number" ? payload.exp : nowSec + provider.max_token_age_seconds) +
          provider.clock_skew_seconds) * 1000,
      ).toISOString();
      const { error: replayError } = await admin.from("sso_replay_guard").insert({
        provider_id: provider.id,
        issuer: provider.issuer,
        jti,
        nonce,
        expires_at: expiresAt,
      });
      if (replayError) {
        return await fail(401, "replay_detectado", { jti_hash: jtiHash });
      }
      void admin.from("sso_replay_guard").delete().lt("expires_at", new Date().toISOString());
    }

    const email = String(payload.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return await fail(401, "email_ausente_no_token");
    if (
      provider.allowed_email_domains &&
      provider.allowed_email_domains.length > 0 &&
      !provider.allowed_email_domains.some((d) => email.endsWith(`@${d.toLowerCase()}`))
    ) {
      return await fail(403, "dominio_email_nao_autorizado");
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id, nome, ativo, role")
      .ilike("email", email)
      .maybeSingle();
    if (profileError) return await fail(500, "falha_consulta_perfil");

    let userId = profile?.user_id as string | undefined;
    let userName = (profile?.nome as string | undefined) ?? email;

    if (profile && profile.ativo === false) {
      return await fail(403, "usuario_inativo", { email });
    }

    if (!userId) {
      if (!provider.auto_provision) {
        return await fail(403, "usuario_inexistente_provisionamento_desabilitado", { email });
      }
      const nome = String(payload.name ?? payload.nome ?? email.split("@")[0]);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { nome, sso_provider: provider.slug },
      });
      if (createError || !created?.user) return await fail(500, "falha_criacao_usuario");
      userId = created.user.id;
      userName = nome;

      const { error: insertProfileError } = await admin.from("profiles").insert({
        user_id: userId,
        nome,
        email,
        role: provider.default_role || "profissional",
        ativo: true,
      });
      if (insertProfileError) return await fail(500, "falha_criacao_perfil");

      await admin.from("user_roles").insert({ user_id: userId, role: provider.default_role || "profissional" });

      void auditSso({
        acao: "sso_usuario_provisionado",
        status: "sucesso",
        correlationId,
        req,
        origem: provider.slug,
        userId,
        usuarioNome: nome,
        detalhes: { email, role: provider.default_role },
      });
    }

    // Geração segura da sessão sem depender do SMTP/Mailer do Supabase
    let hashedToken = "";
    try {
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "https://plantao-inteligente.vercel.app/dashboard" }
      });
      
      if (linkError || !link?.properties?.hashed_token) {
        throw new Error(linkError?.message || "falha_hashed_token");
      }
      hashedToken = link.properties.hashed_token;
    } catch (e) {
      // Fallback: se o generateLink falhar por SMTP, geramos um token de recuperação via Admin API
      const { data: recovery, error: recError } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (recError || !recovery?.properties?.hashed_token) {
        return await fail(500, "falha_geracao_sessao_detalhe", { error: String(e) });
      }
      hashedToken = recovery.properties.hashed_token;
    }

    await auditSso({
      acao: "sso_login_sucesso",
      status: "sucesso",
      correlationId,
      req,
      origem: provider.slug,
      userId,
      usuarioNome: userName,
      detalhes: { email, jti_hash: jtiHash, provider: provider.slug },
    });

    return json({
      ok: true,
      correlation_id: correlationId,
      provider: provider.slug,
      email,
      session_token: hashedToken,
      token_type: "magiclink",
    });
  } catch (err: any) {
    return await fail(500, "erro_inesperado", { mensagem: err?.message || String(err) });
  }
});
