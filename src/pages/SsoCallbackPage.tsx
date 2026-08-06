import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { exchangeSsoToken, sanitizeNextPath } from "@/lib/sso";
import { useAuth } from "@/hooks/useAuth";

/**
 * Rota de retorno do SSO (/auth/sso). Recebe o token do provedor, troca por sessão
 * via Edge Function e redireciona. Nada é gravado em LocalStorage.
 */
export default function SsoCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isReady, user, isProfessional } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const nextPath = sanitizeNextPath(params.get("next"));

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token") || params.get("id_token") || hash.get("token") || hash.get("id_token");
    const provider = params.get("provider") || hash.get("provider") || undefined;
    const nonce = params.get("nonce") || hash.get("nonce") || undefined;

    // Remove imediatamente o token da URL visível.
    window.history.replaceState({}, "", `/auth/sso${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);

    if (!token) {
      setError("Token de autenticação não informado.");
      return;
    }

    void (async () => {
      const result = await exchangeSsoToken(token, { provider, nonce });
      if (!result.ok) {
        setError(result.error ?? "Falha na autenticação SSO.");
        setCorrelationId(result.correlationId ?? null);
        return;
      }
      setDone(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!done || !isReady) return;
    if (!user) return;
    navigate(nextPath ?? (isProfessional ? "/meu-painel" : "/dashboard"), { replace: true });
  }, [done, isReady, user, isProfessional, nextPath, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 text-center shadow-[var(--shadow-elevated)] space-y-3">
        {error ? (
          <>
            <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="font-display text-lg font-semibold text-foreground">
              Não foi possível entrar via SSO
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            {correlationId && (
              <p className="text-xs font-mono text-muted-foreground">Ref: {correlationId}</p>
            )}
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Entrar com login do sistema
            </button>
          </>
        ) : (
          <>
            <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
            <h1 className="font-display text-lg font-semibold text-foreground">
              Autenticando com segurança
            </h1>
            <p className="text-sm text-muted-foreground">Validando credenciais do sistema de origem…</p>
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </>
        )}
      </div>
    </div>
  );
}
