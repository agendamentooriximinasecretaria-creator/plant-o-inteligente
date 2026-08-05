import { useEffect, useState } from "react";
import { KeyRound, Save, ShieldCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SsoProvider {
  id: string;
  nome: string;
  slug: string;
  issuer: string;
  audience: string;
  jwks_url: string | null;
  allowed_algs: string[];
  clock_skew_seconds: number;
  max_token_age_seconds: number;
  require_nonce: boolean;
  require_jti: boolean;
  auto_provision: boolean;
  default_role: string;
  allowed_email_domains: string[];
  logout_url: string | null;
  ativo: boolean;
}

const inputClass =
  "w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";

export function SsoProvidersManager() {
  const [providers, setProviders] = useState<SsoProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sso_providers")
      .select("*")
      .order("nome");
    if (error) toast.error("Não foi possível carregar os provedores de SSO.");
    setProviders((data as SsoProvider[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const update = (id: string, patch: Partial<SsoProvider>) => {
    setProviders((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const save = async (provider: SsoProvider) => {
    setSaving(provider.id);
    const { error } = await supabase
      .from("sso_providers")
      .update({
        nome: provider.nome,
        issuer: provider.issuer.trim(),
        audience: provider.audience.trim(),
        jwks_url: provider.jwks_url?.trim() || null,
        allowed_algs: provider.allowed_algs,
        clock_skew_seconds: provider.clock_skew_seconds,
        max_token_age_seconds: provider.max_token_age_seconds,
        require_nonce: provider.require_nonce,
        require_jti: provider.require_jti,
        auto_provision: provider.auto_provision,
        allowed_email_domains: provider.allowed_email_domains,
        logout_url: provider.logout_url?.trim() || null,
        ativo: provider.ativo,
      })
      .eq("id", provider.id);
    setSaving(null);
    if (error) toast.error("Falha ao salvar provedor de SSO.");
    else toast.success("Provedor de SSO atualizado.");
  };

  const callbackUrl = `${window.location.origin}/auth/sso`;

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground">
            Login Federado (SSO)
          </h3>
          <p className="text-sm text-muted-foreground">
            Autenticação adicional vinda de sistemas autorizados. O login tradicional continua sempre ativo.
          </p>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-muted/40 border border-border/50 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">URL de retorno para o sistema de origem</p>
          <p className="text-sm font-mono text-foreground truncate">{callbackUrl}?token=JWT</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(`${callbackUrl}?token=`);
            toast.success("URL copiada.");
          }}
          className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : providers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum provedor cadastrado.</p>
      ) : (
        <div className="space-y-5">
          {providers.map((p) => (
            <div key={p.id} className="p-4 rounded-lg border border-border/60 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-4 w-4 ${p.ativo ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-medium text-foreground">{p.nome}</span>
                  <span className="text-xs font-mono text-muted-foreground">({p.slug})</span>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={p.ativo}
                    onChange={(e) => update(p.id, { ativo: e.target.checked })}
                    className="rounded"
                  />
                  Ativo
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground">Issuer</label>
                  <input value={p.issuer} onChange={(e) => update(p.id, { issuer: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Audience</label>
                  <input value={p.audience} onChange={(e) => update(p.id, { audience: e.target.value })} className={inputClass} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">URL das chaves públicas (JWKS)</label>
                  <input
                    value={p.jwks_url ?? ""}
                    onChange={(e) => update(p.id, { jwks_url: e.target.value })}
                    className={inputClass}
                    placeholder="https://.../.well-known/jwks.json"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Algoritmos permitidos</label>
                  <input
                    value={p.allowed_algs.join(", ")}
                    onChange={(e) =>
                      update(p.id, {
                        allowed_algs: e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                    className={inputClass}
                    placeholder="RS256"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Domínios de e-mail aceitos</label>
                  <input
                    value={p.allowed_email_domains.join(", ")}
                    onChange={(e) =>
                      update(p.id, {
                        allowed_email_domains: e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                    className={inputClass}
                    placeholder="vazio = todos"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Tolerância de relógio (s)</label>
                  <input
                    type="number"
                    value={p.clock_skew_seconds}
                    onChange={(e) => update(p.id, { clock_skew_seconds: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Validade máxima do token (s)</label>
                  <input
                    type="number"
                    value={p.max_token_age_seconds}
                    onChange={(e) => update(p.id, { max_token_age_seconds: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">URL de logout federado</label>
                  <input
                    value={p.logout_url ?? ""}
                    onChange={(e) => update(p.id, { logout_url: e.target.value })}
                    className={inputClass}
                    placeholder="opcional"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={p.require_nonce} onChange={(e) => update(p.id, { require_nonce: e.target.checked })} className="rounded" />
                  Exigir nonce
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={p.require_jti} onChange={(e) => update(p.id, { require_jti: e.target.checked })} className="rounded" />
                  Exigir jti (anti-replay)
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={p.auto_provision} onChange={(e) => update(p.id, { auto_provision: e.target.checked })} className="rounded" />
                  Criar usuário automaticamente
                </label>
              </div>
              {p.auto_provision && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Usuários novos serão criados com o perfil padrão “{p.default_role}”. Mantenha desativado se o acesso deve ser apenas para usuários já cadastrados.
                </p>
              )}

              <button
                type="button"
                onClick={() => void save(p)}
                disabled={saving === p.id}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving === p.id ? "Salvando…" : "Salvar provedor"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
