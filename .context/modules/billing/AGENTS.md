# Modulo: billing

Cobranca, pagamentos, comissao e inadimplencia. E um dominio **transversal**: integra Mercado
Pago, gera cobrancas via cron, trata webhooks de pagamento, aplica guarda de inadimplencia no
bot e calcula comissao de representantes. Por isso vive em varios diretorios, mas e um modulo so.

## Fronteiras

**Pertence a este modulo (mesmo cruzando diretorios):**
- `lib/payments/**` — abstracao de gateway (ADR-0021): `types.ts` (interface `PaymentGateway`),
  `mercado-pago-gateway.ts`, `asaas-gateway.ts`, `factory.ts` (`getActiveGateway`/`getGateway`),
  `process-webhook.ts` (handler de webhook agnostico de provedor).
- `lib/mercado-pago/client.ts` — cliente REST do Mercado Pago (usado pelo gateway MP).
- `app/api/webhooks/mercado-pago/route.ts` e `app/api/webhooks/asaas/route.ts` — webhooks (thin; delegam ao handler compartilhado).
- `app/api/internal/admin-billing/gerar-cobrancas/route.ts` e `.../auto-pausa-inadimplencia/route.ts` — crons.
- `app/api/admin/oficinas/[id]/cobrar/route.ts`, `app/api/admin/pagamentos/**`, `app/api/admin/comissoes/**`,
  `app/api/admin/configuracoes-comissao/route.ts`, `app/api/admin/configuracoes-vendedor/route.ts`,
  `app/api/admin/configuracoes-pagamento/route.ts`.
- `lib/admin/billing.ts`, `pagamentos.ts`, `comissoes.ts`, `configuracoes-vendedor.ts`, `configuracoes-pagamento.ts`.
- `lib/whatsapp/cobranca-agent.ts`, `inadimplencia-guard.ts`.
- Paginas: `app/admin/(autenticado)/{comissoes,pagamentos}/`, `app/admin/(autenticado)/configuracoes/pagamentos/`.

**NAO pertence:** demais agentes do bot (modulo [[whatsapp-bot]]), CRUD nao-financeiro do painel
(modulo [[painel-admin]]), schema (modulo [[database]]).

## Regras/invariantes do modulo
- **LLM nao muda estado de pagamento nem opt-out** (ADR-0001): estado financeiro so muda por regra
  deterministica / confirmacao de provider.
- **Provedor pluggavel (ADR-0021):** billing fala com `getActiveGateway`, nunca com um provedor fixo.
  Provedor ativo e credenciais sao geridos em `/admin/configuracoes/pagamentos`. Adicionar provedor =
  implementar `PaymentGateway`, sem tocar em billing.ts.
- Webhooks (MP e ASAAS): validar origem, ser idempotentes (indice unico `pagamentos(gateway, gateway_payment_id)`).
- Inadimplencia: a guarda (`inadimplencia-guard.ts`) decide bloqueio/pausa no fluxo do bot; o cron
  `auto-pausa-inadimplencia` aplica a pausa. Comportamento e regra de negocio — manter em `regras-de-negocio.md`.
- **Segredos dos gateways ficam no Supabase Vault** (funcoes `set/get/payment_secret_exists`, so `service_role`);
  nunca em `NEXT_PUBLIC_`, nunca em coluna texto, nunca em log de auditoria. Env so como fallback dev.
- ASAAS exige `oficinas.cpf_cnpj` (customer) antes de cobrar; id em `oficinas.asaas_customer_id`.
- Cobranca fala com o cliente pelo bot em portugues, curto e concreto.
- Comissao de representante: config em `configuracoes-comissao` / `configuracoes-vendedor` (ADR-0019).

## Testes
- `tests/admin-billing.test.ts`, `tests/admin-comissoes.test.ts`,
  `tests/admin-configuracoes-vendedor.test.ts`, `tests/whatsapp-cobranca-agent.test.ts`,
  `tests/payments-asaas-gateway.test.ts`, `tests/admin-configuracoes-pagamento.test.ts`.

## Dominio Representantes (mapa entre modulos)

O dominio "representantes" cruza tres modulos por fronteira de responsabilidade — nao ha modulo
unico "representantes" (cada arquivo tem um dono so, regra Aurea). Fio condutor: [[ADR-0019]]
(atribuicao + comissao), [[ADR-0025]] (portal) e `regras-de-negocio.md §18`.

- **Cadastro/CRUD do rep** → [[painel-admin]] (`lib/admin/representantes.ts`, `/admin/representantes`).
- **Motor de comissao** (geracao no webhook, config, payout) → **este modulo** [[billing]] (`lib/admin/comissoes.ts`, `configuracoes-comissao`, `/admin/comissoes`).
- **Portal do rep** (login OTP, dados escopados read-only, telas, conteudo) → [[portal-representante]] (`app/representante/**`, `app/api/representante/**`, `lib/representante/**`).

O wrapper read-only `lib/representante/comissoes.ts` (portal) chama `listComissoes` deste modulo; a
mutacao de comissao (marcar paga/cancelar) permanece exclusiva daqui.

## Referencias
- Regras de negocio: `docs/regras-de-negocio.md` §9 (preco/planos/billing/gateway), §10 (inadimplencia).
- Runbooks: `docs/runbooks/asaas-setup.md`.
- ADR-0008 (Mercado Pago), ADR-0012 (preco), ADR-0013 (painel/billing), ADR-0019 (comissao),
  ADR-0021 (gateway pluggavel ASAAS + MP, segredos no Vault).
- Migration: `supabase/migrations/20260712120000_gateway_pagamento_asaas.sql`.
- Convencoes: `.context/conventions.md`
