# Modulo: billing

Cobranca, pagamentos, comissao e inadimplencia. E um dominio **transversal**: integra Mercado
Pago, gera cobrancas via cron, trata webhooks de pagamento, aplica guarda de inadimplencia no
bot e calcula comissao de representantes. Por isso vive em varios diretorios, mas e um modulo so.

## Fronteiras

**Pertence a este modulo (mesmo cruzando diretorios):**
- `lib/mercado-pago/client.ts` — cliente do provedor.
- `app/api/webhooks/mercado-pago/route.ts` — webhook de pagamento.
- `app/api/internal/admin-billing/gerar-cobrancas/route.ts` e `.../auto-pausa-inadimplencia/route.ts` — crons.
- `app/api/admin/oficinas/[id]/cobrar/route.ts`, `app/api/admin/pagamentos/**`, `app/api/admin/comissoes/**`,
  `app/api/admin/configuracoes-comissao/route.ts`, `app/api/admin/configuracoes-vendedor/route.ts`.
- `lib/admin/billing.ts`, `pagamentos.ts`, `comissoes.ts`, `configuracoes-vendedor.ts`.
- `lib/whatsapp/cobranca-agent.ts`, `inadimplencia-guard.ts`.
- Paginas: `app/admin/(autenticado)/{comissoes,pagamentos}/`.

**NAO pertence:** demais agentes do bot (modulo [[whatsapp-bot]]), CRUD nao-financeiro do painel
(modulo [[painel-admin]]), schema (modulo [[database]]).

## Regras/invariantes do modulo
- **LLM nao muda estado de pagamento nem opt-out** (ADR-0001): estado financeiro so muda por regra
  deterministica / confirmacao de provider.
- Webhook Mercado Pago: validar origem, ser idempotente (nao processar o mesmo evento duas vezes).
- Inadimplencia: a guarda (`inadimplencia-guard.ts`) decide bloqueio/pausa no fluxo do bot; o cron
  `auto-pausa-inadimplencia` aplica a pausa. Comportamento e regra de negocio — manter em `regras-de-negocio.md`.
- Segredos do Mercado Pago sao server-side; nunca em `NEXT_PUBLIC_`.
- Cobranca fala com o cliente pelo bot em portugues, curto e concreto.
- Comissao de representante: config em `configuracoes-comissao` / `configuracoes-vendedor` (ADR-0019).

## Testes
- `tests/admin-billing.test.ts`, `tests/admin-comissoes.test.ts`,
  `tests/admin-configuracoes-vendedor.test.ts`, `tests/whatsapp-cobranca-agent.test.ts`.

## Referencias
- Regras de negocio: `docs/regras-de-negocio.md` (secao de cobranca/inadimplencia/comissao)
- Runbooks: `docs/runbooks/` (se houver setup de Mercado Pago)
- ADR-0019 (representantes comerciais / comissao configuravel)
- Convencoes: `.context/conventions.md`
