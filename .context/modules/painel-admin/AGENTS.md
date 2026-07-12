# Modulo: painel-admin

Painel operacional interno. UI autenticada + APIs + logica de dominio para gerir oficinas,
leads, clientes, conversas, lembretes, mensagens, FAQ de vendas, tipos de servico, planos,
representantes e auditoria. Uso interno da equipe (nao e o produto do cliente final).

## Fronteiras

**Pertence a este modulo:**
- `app/admin/` — UI (entrar/OTP e area autenticada `(autenticado)`).
- `app/api/admin/**` — APIs do painel.
- `lib/admin/` — logica de dominio + dados do admin, **exceto** os arquivos de cobranca
  (`billing.ts`, `pagamentos.ts`, `comissoes.ts`, `configuracoes-vendedor.ts`) que sao do modulo [[billing]].
- `components/admin/` (inclui `components/admin/ui`).

**NAO pertence:** bot conversacional (modulo [[whatsapp-bot]]), cobranca/comissao (modulo
[[billing]]), site publico e demo (modulo [[site-publico]]), migrations (modulo [[database]]).

## Arquivos-chave
- Auth: `lib/admin/otp.ts`, `session.ts` (JWT `jose`), `api-guard.ts` (`requireAdminApi`), `rate-limit.ts`.
- Dominios: `oficinas.ts`, `leads.ts`, `clientes.ts`, `conversas.ts`, `lembretes.ts`, `mensagens.ts`,
  `faq.ts`, `tipos-servico.ts`, `planos.ts`, `representantes.ts`, `admins.ts`, `inteligencia-mercado.ts`.
- Auditoria: `audit.ts`, `audit-actions.ts`, `audit-queries.ts`, `tool-calls.ts`, `tool-calls-catalog.ts`.
- Utilitarios: `metrics.ts`, `normalize.ts`, `phone.ts`, `format-phone-br.ts`, `pii.ts`, `request-ip.ts`.
- UI: `app/admin/(autenticado)/**` (paginas por dominio, nav, layout).

## Regras/invariantes do modulo
- **Toda rota autenticada passa pelo guard:** `requireAdmin()` em server component (redireciona) /
  `requireAdminApi()` em route handler (401). Nunca expor dado de oficina sem sessao.
- Padrao de camadas: `route.ts` -> guard -> modulo de dominio (`lib/admin/*`) -> `lib/supabase/admin.ts`.
- Respostas de API no envelope `{ ok: boolean, message }` + status HTTP.
- Escopar dado por `oficina_id`. Tratar PII com cuidado (ver `pii.ts`); nao logar telefone cru sem necessidade.
- Acoes sensiveis registradas na auditoria (`audit-actions.ts`).
- Soft delete onde aplicavel (ex.: oficinas) em vez de delete fisico.

## Testes
- `tests/admin-*.test.ts` (admins, clientes, comissoes, faq, leads, lembretes, mensagens, metrics,
  normalize, oficinas, otp, phone, pii, planos, representantes, tipos-servico...).

## Referencias
- Backlog: `docs/backlog-painel-admin/`
- Regras de negocio: `docs/regras-de-negocio.md`
- Convencoes: `.context/conventions.md`
- ADR-0019 (representantes comerciais / comissao)
