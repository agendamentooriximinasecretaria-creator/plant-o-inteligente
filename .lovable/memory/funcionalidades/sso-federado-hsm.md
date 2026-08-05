---
name: SSO federado (cliente do HSM Gestão)
description: Login federado adicional via JWT/OIDC — endpoint auth-sso, provedores configuráveis, anti-replay e auditoria; login tradicional intocado
type: feature
---

- O login tradicional (e-mail/senha) é a fonte principal de autenticação e nunca pode ser removido ou alterado. SSO é sempre um método adicional; qualquer falha de SSO cai no login convencional.
- Tabelas: `sso_providers` (issuer, audience, jwks_url/public_key, allowed_algs, clock_skew, max_token_age, require_nonce, require_jti, auto_provision, default_role, allowed_email_domains, logout_url, ativo — só Gestor Master gerencia) e `sso_replay_guard` (único por issuer+jti, acesso apenas service_role).
- Edge Functions: `auth-sso` (valida assinatura via JWKS com rotação, alg allowlist sem "none", exp/iat/nbf, iss, aud, nonce, jti único, idade máxima; localiza usuário por e-mail em `profiles`; provisiona apenas se `auto_provision`; devolve `session_token` de uso único), `auth-sso-logout` (logout federado) e `auth-refresh` (arquitetura pronta, retorna 501).
- Front: rota pública `/auth/sso` (`SsoCallbackPage`) troca o token por sessão via `src/lib/sso.ts` e redireciona para `next` (só caminhos internos) ou `/dashboard`/`/meu-painel`. Token do provedor nunca vai para LocalStorage.
- Auditoria em `audit_logs` modulo `sso` — status aceito pela constraint é apenas 'sucesso' ou 'erro'. Registrar correlation_id, ip, origem, motivo e hash curto do jti; nunca o token.
- Configuração administrativa em Configurações → Login Federado (`SsoProvidersManager`).
