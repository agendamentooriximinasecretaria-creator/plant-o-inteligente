CREATE TABLE public.sso_providers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  issuer text NOT NULL,
  audience text NOT NULL,
  jwks_url text,
  public_key text,
  allowed_algs text[] NOT NULL DEFAULT ARRAY['RS256'],
  clock_skew_seconds integer NOT NULL DEFAULT 60,
  max_token_age_seconds integer NOT NULL DEFAULT 300,
  require_nonce boolean NOT NULL DEFAULT true,
  require_jti boolean NOT NULL DEFAULT true,
  auto_provision boolean NOT NULL DEFAULT false,
  default_role app_role NOT NULL DEFAULT 'profissional',
  allowed_email_domains text[] NOT NULL DEFAULT ARRAY[]::text[],
  logout_url text,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sso_providers TO authenticated;
GRANT ALL ON public.sso_providers TO service_role;

ALTER TABLE public.sso_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor master gerencia provedores SSO"
ON public.sso_providers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'gestor_master'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'gestor_master'::app_role));

CREATE TRIGGER trg_sso_providers_updated_at
BEFORE UPDATE ON public.sso_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sso_replay_guard (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id uuid REFERENCES public.sso_providers(id) ON DELETE CASCADE,
  issuer text NOT NULL,
  jti text NOT NULL,
  nonce text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sso_replay_guard_issuer_jti_key ON public.sso_replay_guard (issuer, jti);
CREATE INDEX sso_replay_guard_expires_idx ON public.sso_replay_guard (expires_at);

GRANT ALL ON public.sso_replay_guard TO service_role;

ALTER TABLE public.sso_replay_guard ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sso_providers (nome, slug, issuer, audience, jwks_url, ativo)
VALUES ('HSM Gestão', 'hsm', 'https://hsm.example.com', 'plantao-inteligente', 'https://hsm.example.com/.well-known/jwks.json', false);