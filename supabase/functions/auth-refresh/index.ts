// Endpoint de renovação (arquitetura preparada, lógica futura).
// Valida a origem e o formato da solicitação, registra auditoria e responde
// explicitamente que a renovação federada ainda não está habilitada.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { auditSso, newCorrelationId, serviceClient } from "../_shared/sso.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const correlationId = newCorrelationId();

  if (req.method !== "POST") {
    return json({ ok: false, error: "Método não permitido.", correlation_id: correlationId }, 405);
  }

  let providerSlug = "";
  try {
    const body = await req.json();
    if (typeof body?.provider === "string") providerSlug = body.provider;
  } catch {
    return json({ ok: false, error: "Corpo inválido.", correlation_id: correlationId }, 400);
  }

  const admin = serviceClient();
  const { data: provider } = await admin
    .from("sso_providers")
    .select("slug, ativo")
    .eq("slug", providerSlug)
    .maybeSingle();

  await auditSso({
    acao: "sso_refresh_solicitado",
    status: "erro",
    correlationId,
    req,
    origem: provider?.slug ?? "desconhecido",
    motivo: "refresh_nao_habilitado",
  });

  return json(
    {
      ok: false,
      error: "Renovação federada ainda não habilitada.",
      correlation_id: correlationId,
      // A sessão do app continua sendo renovada normalmente pelo mecanismo padrão.
      fallback: "sessao_local",
    },
    501,
  );
});
