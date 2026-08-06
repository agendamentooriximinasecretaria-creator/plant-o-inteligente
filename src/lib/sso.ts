import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface SsoExchangeResult {
  ok: boolean;
  error?: string;
  detail?: string;
  stage?: "edge" | "session";
  correlationId?: string;
  provider?: string;
}

/** Aceita apenas caminhos internos relativos (evita open redirect). */
export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/auth/")) return null;
  return value;
}

/**
 * Envia o JWT do provedor SSO para validação no servidor e estabelece a mesma
 * sessão usada pelo login convencional. O token do provedor nunca é persistido.
 */
export async function exchangeSsoToken(
  token: string,
  options?: { provider?: string; nonce?: string },
): Promise<SsoExchangeResult> {
  try {
    const response = await fetch(`${FUNCTIONS_BASE}/auth-sso`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ token, provider: options?.provider, nonce: options?.nonce }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok || !payload?.session_token) {
      const detail =
        payload?.detalhes?.detalhe ??
        payload?.detalhe ??
        (payload ? JSON.stringify(payload) : `HTTP ${response.status}`);
      console.error("[sso] auth-sso falhou", { status: response.status, payload });
      return {
        ok: false,
        stage: "edge",
        error: payload?.error ?? "Não foi possível concluir a autenticação SSO.",
        detail: typeof detail === "string" ? detail : JSON.stringify(detail),
        correlationId: payload?.correlation_id,
      };
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: payload.session_token as string,
      type: "magiclink",
    });

    if (error) {
      console.error("[sso] verifyOtp falhou", error);
      return {
        ok: false,
        stage: "session",
        error: "Não foi possível estabelecer a sessão.",
        detail: `${error.name ?? "AuthError"}: ${error.message}`,
        correlationId: payload.correlation_id,
      };
    }

    return { ok: true, correlationId: payload.correlation_id, provider: payload.provider };
  } catch (e) {
    console.error("[sso] erro de rede", e);
    return {
      ok: false,
      stage: "edge",
      error: "Serviço de SSO indisponível.",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Logout federado: encerra a sessão e registra auditoria no servidor. */
export async function federatedLogout(provider?: string): Promise<string | null> {
  let redirectTo: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const response = await fetch(`${FUNCTIONS_BASE}/auth-sso-logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ provider: provider ?? "app" }),
    });
    const payload = await response.json().catch(() => null);
    if (payload?.redirect_to && typeof payload.redirect_to === "string") {
      redirectTo = payload.redirect_to;
    }
  } catch {
    // falha no logout federado não deve impedir o logout local
  }
  await supabase.auth.signOut();
  return redirectTo;
}
