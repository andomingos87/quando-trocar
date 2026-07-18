# Modulo: portal-representante

Area de acesso propria do **representante comercial** (publico externo), separada do painel admin.
Login por OTP-no-WhatsApp contra a tabela `representantes` existente, **read-only**, escopada por
`representante_id` da sessao. O representante consulta a propria carteira de oficinas, leads
atribuidos, extrato de comissoes, playbook de vendas e novidades. Fonte: [[ADR-0025]] (estende
[[ADR-0019]]).

## Fronteiras

**Pertence a este modulo:**
- `app/representante/` — UI (login/OTP `entrar` e area autenticada `(autenticado)`).
- `app/api/representante/**` — APIs do portal (hoje so `auth/{request-otp,verify-otp,logout}`).
- `lib/representante/` — sessao, OTP, guard, camada de dados escopada e conteudo estatico
  (`content/playbook.ts`, `content/novidades.ts`).

**NAO pertence:** painel interno da equipe (modulo [[painel-admin]]), cobranca/comissao — motor e
mutacao (modulo [[billing]]: `lib/admin/comissoes.ts`), bot conversacional (modulo [[whatsapp-bot]]),
site publico (modulo [[site-publico]]), migrations (modulo [[database]]).

## Arquivos-chave
- Auth: `lib/representante/session.ts` (JWT `jose`, cookie `qt_rep_session`, `REP_SESSION_SECRET`),
  `otp.ts` (hash HMAC com `REP_SESSION_SECRET`, target `representante`), `api-guard.ts`
  (`requireRepresentante` / `requireRepresentanteApi`, re-checa ativo/deletado).
- Dados (todos `server-only`, todos recebendo `representanteId` da sessao):
  `carteira.ts` (oficinas + agregados sem PII), `leads.ts` (funil atribuido), `comissoes.ts`
  (wrapper sobre `listComissoes` do admin + resumo do mes), `dashboard.ts` (resumo).
- Conteudo: `content/playbook.ts`, `content/novidades.ts` (constantes, publicadas por deploy).
- UI: `app/representante/(autenticado)/**` (paginas + shell mobile-first).

## Regras/invariantes do modulo
- **Escopo imposto no codigo, nunca no request:** toda query recebe `representante_id` da **sessao**.
  Nao ha RLS por tenant hoje (ADR-0003 estado real). Rep A nunca ve dado de rep B.
- **Guard re-verifica `ativo = true` e `deleted_at is null` a cada request** (rep pode ser desativado
  mid-sessao). `requireRepresentante()` em server component (redireciona para `/representante/entrar`);
  `requireRepresentanteApi()` em route handler (401 JSON).
- **Sessao isolada do admin:** cookie e secret proprios (`qt_rep_session`, `REP_SESSION_SECRET`,
  claim `isRepresentante`). Cookie de admin nao acessa `/representante` e vice-versa.
- **LGPD — sem PII de cliente final:** nenhuma tela/endpoint retorna nome ou WhatsApp de cliente
  final. Contato da propria oficina (responsavel, WhatsApp da oficina) e o contato comercial legitimo
  do rep e pode aparecer.
- **Read-only:** portal nunca muda estado (comissao paga/cancelada continua so no admin).
- OTP herda o hardening do admin: rate-limit, hash HMAC-SHA256, expiracao 5 min, max 5 tentativas,
  resposta generica (sem enumeracao de usuario). Reaproveita o template Meta `WHATSAPP_TEMPLATE_OTP_NAME`.

## Testes
- `tests/representante-otp.test.ts`, `tests/representante-session.test.ts`,
  `tests/representante-carteira.test.ts`, `tests/representante-comissoes.test.ts`,
  `tests/representante-dashboard.test.ts` (escopo rep A ≠ rep B, ausencia de PII, agregados corretos).

## Dominio Representantes (mapa entre modulos)

O dominio "representantes" cruza tres modulos por fronteira de responsabilidade — nao ha modulo
unico "representantes" (cada arquivo tem um dono so, regra Aurea). Fio condutor: [[ADR-0019]]
(atribuicao + comissao), [[ADR-0025]] (portal) e `regras-de-negocio.md §18`.

- **Cadastro/CRUD do rep** → [[painel-admin]] (`lib/admin/representantes.ts`, `/admin/representantes`).
- **Motor de comissao** (geracao no webhook, config, payout) → [[billing]] (`lib/admin/comissoes.ts`, `configuracoes-comissao`, `/admin/comissoes`).
- **Portal do rep** (login OTP, dados escopados read-only, telas, conteudo) → **este modulo** [[portal-representante]] (`app/representante/**`, `app/api/representante/**`, `lib/representante/**`).

## Referencias
- Backlog: `docs/backlog-whatsapp-bot/fase-representante-portal.md`
- ADR: [[ADR-0025]] (portal), [[ADR-0019]] (representantes/comissao), [[ADR-0003]] (multi-tenancy)
- Regras de negocio: `docs/regras-de-negocio.md §18.7`
- Runbook: `docs/runbooks/publicar-novidade-representante.md`
- Convencoes: `.context/conventions.md`
