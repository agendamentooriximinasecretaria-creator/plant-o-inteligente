# SSO como cliente do HSM Gestão (Plantão Inteligente)

## Arquitetura atual (análise)

- Autenticação: e-mail/senha via backend gerenciado (Auth). O formulário em `LoginPage` chama `signIn` → `signInWithPassword`.
- Sessão: criada e persistida pelo cliente de auth; `AuthProvider` (`src/hooks/useAuth.tsx`) escuta `onAuthStateChange`, carrega `profiles` (role, profissional_id, ativo) e faz logout automático se não houver perfil ativo.
- Autorização: guardas de rota em `App.tsx` (`ManagerOnly`, `MasterOnly`, `ProfessionalOnly`) + RLS no banco (`has_role`, `is_manager`).
- Auditoria: tabela `audit_logs` (modulo, acao, user_id, usuario_nome, status, detalhes).
- Backend: Edge Functions (ex.: `user-admin`) com privilégio de serviço apenas no servidor.

Ponto de integração: o SSO só precisa produzir uma sessão de auth idêntica à do login por senha. Tudo depois (perfil, guardas, RLS, cálculos) permanece inalterado. Nada do login atual é tocado.

## Fases

### Fase 1 — Base de dados e configuração
- Tabela `sso_providers`: issuer, audience, `jwks_url` (ou chave pública), algoritmos permitidos, `auto_provision` (bool), `default_role`, ativo. Permite outros sistemas no futuro sem reescrever nada.
- Tabela `sso_replay_guard`: `jti`, `nonce`, issuer, `expires_at` (único por issuer+jti) para bloquear replay.
- RLS: leitura/escrita apenas para Gestor Master; Edge Functions usam papel de serviço. GRANTs explícitos.

### Fase 2 — Endpoint `/auth/sso` (Edge Function `auth-sso`)
- Recebe o JWT do HSM (POST body ou query em redirect).
- Valida: assinatura (JWKS com cache e rotação de chaves), `alg` na allowlist (rejeita `none`/HS quando o provedor é RS/ES), `exp`/`iat`/`nbf` com tolerância curta, `iss`, `aud`, `nonce` e `jti` (consumo único).
- Localiza usuário pelo e-mail. Se existe → cria sessão. Se não existe → bloqueia, salvo `auto_provision` habilitado pelo administrador (nunca por padrão).
- Emissão da sessão: gera um link/token de sessão pelo servidor (admin API) e devolve ao cliente para estabelecer exatamente a mesma sessão do login convencional.
- Erros: mensagem genérica ao cliente + motivo detalhado só na auditoria; redireciona para `/login`.

### Fase 3 — Rota de front `/auth/sso`
- Página dedicada (fora das rotas protegidas) que envia o token ao endpoint, estabelece a sessão e redireciona para `/dashboard` (ou `next` validado como caminho relativo interno). Sem exibir a tela de login novamente.
- Token nunca gravado em LocalStorage; fica em memória e é consumido imediatamente.

### Fase 4 — Logout federado e `/auth/refresh`
- `auth-sso-logout`: encerra a sessão, limpa estado/cookies e registra auditoria.
- `auth-refresh`: endpoint criado com contrato e validações mínimas, retornando "não habilitado" — arquitetura pronta, lógica futura.

### Fase 5 — Auditoria e verificação
- Todo evento SSO em `audit_logs` (modulo `sso`): usuário, data, IP, origem (`hsm_gestao`), sucesso/falha, motivo, `correlation_id`. Somente hash/prefixo do `jti` — nunca o token.
- Verificação: login por senha continua funcionando; token inválido/expirado/replay é rejeitado com auditoria; token válido cai direto no dashboard.

## Detalhes técnicos

- HTTPS é garantido pela plataforma; o endpoint recusa chamadas não-HTTPS.
- Sem Service Role no front-end: toda validação e emissão de sessão ocorre na Edge Function.
- Nenhuma alteração em `useAuth`, guardas de rota, RLS, escalas ou permissões — apenas adições.
- Configuração de provedores e `auto_provision` exposta em Configurações (Gestor Master) numa etapa seguinte, se desejado.
