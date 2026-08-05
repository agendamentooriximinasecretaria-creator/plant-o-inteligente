// Logout federado — recebe a solicitação de logout do provedor SSO (ou do próprio app),
// encerra a sessão do usuário, registra auditoria e devolve a URL de retorno.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { auditSso, newCorrelationId, serviceClient } from "../_shared/sso.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const correlationId = newCorrelationId();

  try {
    if (req.method !== "POST") {
      return json({ ok: false, error: "Método não permitido.", correlation_id: correlationId }, 405);
    }

    let providerSlug = "app";
    try {
      const body = await req.json();
      if (typeof body?.provider === "string") providerSlug = body.provider;
    } catch {
      // corpo opcional
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    let userId: string | null = null;
    let userName: string | null = null;

    if (authHeader.startsWith("Bearer ")) {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data } = await anon.auth.getClaims(token);
      userId = (data?.claims?.sub as string | undefined) ?? null;
      userName = (data?.claims?.email as string | undefined) ?? null;

      if (userId) {
        // Encerra todas as sessões do usuário (logout federado).
        const admin = serviceClient();
        await admin.auth.admin.signOut(token, "global").catch(() => undefined);
      }
    }

    const admin = serviceClient();
    const { data: provider } = await admin
      .from("sso_providers")
      .select("logout_url")
      .eq("slug", providerSlug)
      .maybeSingle();

    await auditSso({
      acao: "sso_logout",
      status: "sucesso",
      correlationId,
      req,
      origem: providerSlug,
      userId,
      usuarioNome: userName,
      detalhes: { federado: providerSlug !== "app" },
    });

    return json({
      ok: true,
      correlation_id: correlationId,
      redirect_to: provider?.logout_url ?? "/login",
    });
  } catch (_e) {
    await auditSso({
      acao: "sso_logout_falha",
      status: "erro",
      correlationId,
      req,
      origem: "sso",
      motivo: "erro_inesperado",
    });
    return json(
      { ok: false, error: "Não foi possível concluir o logout.", correlation_id: correlationId },
      500,
    );
  }
});
