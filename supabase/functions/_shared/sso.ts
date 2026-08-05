import { createClient } from "npm:@supabase/supabase-js@2";

export const SSO_MODULE = "sso";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function newCorrelationId() {
  return crypto.randomUUID();
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "desconhecido"
  );
}

/** Never log full tokens: only a short salted-ish digest prefix. */
export async function digestPrefix(value?: string | null) {
  if (!value) return null;
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface AuditInput {
  acao: string;
  status: "sucesso" | "erro";
  correlationId: string;
  req: Request;
  origem: string;
  userId?: string | null;
  usuarioNome?: string | null;
  motivo?: string | null;
  detalhes?: Record<string, unknown>;
}

export async function auditSso(input: AuditInput) {
  try {
    const admin = serviceClient();
    const { error } = await admin.from("audit_logs").insert({
      modulo: SSO_MODULE,
      acao: input.acao,
      status: input.status,
      user_id: input.userId ?? null,
      usuario_nome: input.usuarioNome ?? "sso",
      detalhes: {
        correlation_id: input.correlationId,
        origem: input.origem,
        ip: clientIp(input.req),
        user_agent: input.req.headers.get("user-agent")?.slice(0, 200) ?? null,
        motivo: input.motivo ?? null,
        ...(input.detalhes ?? {}),
      },
    });
    if (error) console.error("[sso] auditoria rejeitada", error.message);
  } catch (e) {
    console.error("[sso] falha ao registrar auditoria", e);
  }
}

/** Generic client-facing failure: no internal details leak. */
export function ssoFailure(status: number, correlationId: string) {
  return {
    ok: false,
    error: "Não foi possível concluir a autenticação SSO.",
    correlation_id: correlationId,
    redirect_to: "/login",
    status,
  };
}
