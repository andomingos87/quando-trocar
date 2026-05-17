# Admin-1 — Auth admin via OTP WhatsApp

## Objetivo

Login passwordless do painel admin via OTP WhatsApp, sessão separada da sessão da oficina, helper de auditoria pronto para uso pelas próximas sub-fases.

## Dependências

- Admin-0 concluído (tabela `admin_users` com Anderson seed).
- Template Meta categoria "Authentication" aprovado (`WHATSAPP_TEMPLATE_OTP_NAME` configurado).
- Cliente WhatsApp já operacional ([lib/whatsapp/whatsapp-client.ts](../../lib/whatsapp/whatsapp-client.ts)).
- Tabela `auth_otps` já criada (compartilhada com Fase 4A do painel da oficina). Se a Fase 4A ainda não rodou, **criar `auth_otps` aqui** com coluna `target text not null check (target in ('oficina','admin'))` e `target_id uuid`.

## Tarefas

### Backend

- [ ] Definir formato de sessão admin. Escolha recomendada: **JWT próprio** assinado com `ADMIN_SESSION_SECRET`, claims `{ adminId, whatsapp, exp }`, TTL 30 dias.
- [ ] Cookie `qt_admin_session`: HTTP-only, Secure (prod), SameSite=Lax, Path=`/admin`.
- [ ] Distinguir explicitamente do cookie de sessão da oficina (se existir, nomes diferentes).

### Rotas

- [ ] `app/admin/entrar/page.tsx` — formulário em duas etapas (WhatsApp → código).
- [ ] `app/api/admin/auth/request-otp/route.ts` — POST `{ whatsapp }`:
  - Normalizar para E.164.
  - Buscar em `admin_users` com `ativo = true`.
  - Se não encontrar, retornar 200 com mensagem genérica (não vazar enumeração).
  - Se encontrar, gerar código de 6 dígitos, persistir hash em `auth_otps` com `target = 'admin'`, `target_id = admin.id`, `expires_at = now() + 5min`.
  - Aplicar rate limit: 3 envios por WhatsApp por 15 min, 1 por IP por 60s.
  - Enviar via template Meta "Authentication".
- [ ] `app/api/admin/auth/verify-otp/route.ts` — POST `{ whatsapp, code }`:
  - Validar hash, não expirado, não usado, attempts < 5.
  - Marcar OTP como usado.
  - Criar JWT, setar cookie.
  - Atualizar `admin_users.ultimo_acesso_em`.
  - Registrar em `admin_audit_log` ação `admin.login` com `admin_id = self`, payload `{ ip }`.
- [ ] `app/api/admin/auth/logout/route.ts` — POST: limpa cookie, registra `admin.logout` em auditoria.

### Middleware

- [ ] Middleware Next.js (ou layout server) em `app/admin/` que valida `qt_admin_session` antes de renderizar qualquer rota `/admin/*` exceto `/admin/entrar`.
- [ ] Redirect para `/admin/entrar` se ausente/inválido.

### Helper de auditoria

- [ ] `lib/admin/audit.ts` exporta `withAdminAudit(opts, fn)`:
  - `opts = { adminId, acao, entidade, entidadeId, payload, ip }`.
  - Executa `fn()` em transação.
  - Insere entrada em `admin_audit_log` na mesma transação.
  - Em caso de exceção em `fn`, não grava auditoria (rollback total).
- [ ] `lib/admin/session.ts` exporta `getAdminFromRequest()`, `requireAdmin()`.

### UI

- [ ] Layout `app/admin/layout.tsx` (sidebar + header) — header já mostra nome do admin logado e botão "Sair".
- [ ] Página `/admin/entrar` com duas etapas.
- [ ] Estado de erro: mensagens genéricas, sem vazamento de enumeração.

## Critérios de aceite

- Admin com WhatsApp em `admin_users` consegue entrar usando OTP.
- WhatsApp não cadastrado vê mensagem genérica e não recebe código.
- Código expirado (>5min) é rejeitado.
- 6 tentativas erradas bloqueiam aquele OTP.
- 4º envio em 15 min é bloqueado pelo rate limit.
- Acessar `/admin` sem sessão redireciona para `/admin/entrar`.
- Sessão de oficina em `/painel` não dá acesso a `/admin`.
- Logout limpa cookie e exige novo OTP.
- `admin_audit_log` recebe entrada de `admin.login` em cada login bem-sucedido.

## Testes

- [ ] Teste unitário: normalização de telefone para E.164 (cobrir vários formatos).
- [ ] Teste de rota: `request-otp` com WhatsApp existente → OTP persistido e enviado.
- [ ] Teste de rota: `request-otp` com WhatsApp inexistente → 200 sem persistência nem envio.
- [ ] Teste de rota: `verify-otp` com código correto → cookie setado + auditoria gravada.
- [ ] Teste de rate limit (mockar tempo).
- [ ] Teste de middleware: requisição a `/admin` sem cookie → redirect.
- [ ] Teste de middleware: requisição a `/admin` com cookie de oficina (sem claim admin) → redirect.
- [ ] Teste do helper `withAdminAudit`: exceção em `fn` não grava auditoria.

## Riscos

- **Cookie compartilhado entre `/admin` e `/painel`**: ambos no mesmo domínio. Mitigação: nomes diferentes (`qt_admin_session` vs `qt_oficina_session`) e `Path=/admin` no admin.
- **Enumeração de admins**: resposta diferente entre WhatsApp existente e inexistente vaza informação. Mitigação: retorno idêntico em ambos os casos (200 com mensagem genérica), tempo de resposta similar.
- **Template Meta não aprovado**: bloqueia login. Mitigação: solicitar com antecedência; em dev, permitir flag `ADMIN_OTP_DEV_BYPASS_CODE` (só ambiente dev, valor `123456` fixo).
- **Sessão admin reaproveitada como sessão de oficina**: garantir que claim `is_admin` é checado em todo middleware e que cookies têm `Path` diferentes.

## Env vars novas

- `ADMIN_SESSION_SECRET` — chave para assinar JWT admin.
- `ADMIN_OTP_DEV_BYPASS_CODE` — opcional, só dev.
