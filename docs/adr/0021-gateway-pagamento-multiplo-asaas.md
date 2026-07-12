# ADR 0021: Gateway de pagamento pluggável (ASAAS + Mercado Pago), gerenciado no painel admin

- **Status**: accepted
- **Data**: 2026-07-12
- **Decisores**: Anderson Domingos
- **Fonte**: conversa de produto (07/2026) — "deixar o Mercado Pago configurado mas usar o ASAAS, gerido pelo painel admin"

## Contexto

O billing do MVP acoplou o Mercado Pago diretamente ([ADR-0008](./0008-pagamento-no-mvp.md)): `lib/admin/billing.ts` instanciava `MercadoPagoClient`, a tabela `pagamentos` tinha colunas `mp_preference_id`/`mp_payment_id`, e o webhook era exclusivo do MP. O Mercado Pago nunca foi ativado (credencial ausente, crons não agendados).

A decisão de produto passou a ser: **usar o ASAAS** como provedor, mantendo o Mercado Pago configurado porém dormente para uso futuro, e permitir que a **escolha do provedor e as credenciais** sejam gerenciadas pelo **painel admin** (sem depender de deploy para trocar chave ou provedor).

## Decisão

**Introduzir uma camada de abstração de provedor de pagamento (`PaymentGateway`) com duas implementações — Mercado Pago e ASAAS — selecionável em runtime pela configuração do painel admin. Segredos ficam no Supabase Vault.**

### Arquitetura

- **`lib/payments/`** — módulo da abstração:
  - `types.ts` — interface `PaymentGateway` (`createCharge`, `getPaymentStatus`, `verifyWebhook`, `extractWebhookRef`).
  - `mercado-pago-gateway.ts` — adapta o `MercadoPagoClient` existente.
  - `asaas-gateway.ts` — ASAAS REST v3 (customer + payment + webhook).
  - `factory.ts` — `getActiveGateway` (usado por billing) e `getGateway(slug)` (usado pelos webhooks).
  - `process-webhook.ts` — handler de webhook **agnóstico de provedor** (idempotente).
- **`configuracoes_pagamento`** (singleton) — `provedor_ativo` (`mercado_pago | asaas`) e `asaas_ambiente` (`sandbox | producao`). Gerida em `/admin/configuracoes/pagamentos`.
- **Segredos no Vault** — nomes fixos (`asaas_api_key`, `asaas_webhook_token`, `mercado_pago_access_token`, `mercado_pago_webhook_secret`) via funções `SECURITY DEFINER` (`set_payment_secret`/`get_payment_secret`/`payment_secret_exists`), acessíveis só pelo `service_role`. A UI nunca exibe o valor — só se está configurado.
- **`pagamentos`** ganha colunas genéricas: `gateway`, `gateway_charge_id`, `gateway_payment_id`, `payment_url`, `external_reference`. As colunas `mp_*` são mantidas (deprecadas) e backfilladas — mudança aditiva e reversível.
- **`oficinas`** ganha `cpf_cnpj` e `asaas_customer_id` (o ASAAS exige um customer com CPF/CNPJ antes de cobrar).

### Modelo de cobrança

**Cobrança avulsa por ciclo** (igual ao MP): mantém o cron de geração, a idempotência por ciclo e o webhook de confirmação. **Não** usamos ASAAS Subscriptions — coerência com o fluxo existente e simetria entre provedores.

## Alternativas consideradas

- **Trocar MP por ASAAS direto (sem abstração)** — descartado. Jogaria fora a integração MP e repetiria o acoplamento; a decisão foi manter MP configurado.
- **Segredos em env var** — descartado como principal. Não atende "gestão pelo painel" (trocar chave exigiria deploy). Mantido apenas como **fallback** de dev e para o setup antigo do MP.
- **Segredos em coluna texto puro** — descartado. Segredo em claro no banco é risco desnecessário havendo Vault.
- **Segredos no Vault, gerência no painel** — escolhido. Atende "gestão pelo painel" com segredo cifrado em repouso e nunca exibido de volta.
- **ASAAS Subscriptions (recorrência nativa)** — descartado no momento. Mudaria o fluxo e seria específico do ASAAS. Pode ser revisitado.

## Consequências

### Positivas

- Trocar de provedor ou rotacionar credencial é feito no painel, sem deploy.
- Webhook único e idempotente serve os dois provedores.
- ASAAS cobre PIX, boleto e cartão numa cobrança só (`billingType: UNDEFINED`).
- Caminho aberto para novos provedores (basta implementar `PaymentGateway`).

### Negativas / trade-offs

- Mais uma superfície no painel admin e um schema mais largo em `pagamentos` (colunas genéricas + `mp_*` deprecadas convivendo).
- Cada cobrança/webhook faz 1 leitura extra no Vault (RPC). Volume baixo — aceitável.
- ASAAS exige `cpf_cnpj` da oficina; sem ele a cobrança falha com motivo claro (`missing_cpf_cnpj`).
- Segredos passam como parâmetro de RPC (podem aparecer em logs de statement do Postgres). Aceito; ainda superior a coluna em claro.

## Referências

- [ADR-0008](./0008-pagamento-no-mvp.md) — Pagamento via Mercado Pago (complementada por esta ADR; MP permanece configurado porém inativo por padrão).
- [ADR-0012](./0012-politica-de-preco.md) — Plano único, preço por oficina.
- [ADR-0013](./0013-painel-admin-escopo-billing-auditoria.md) — Painel admin, billing, auditoria.
- [ADR-0019](./0019-representantes-e-comissao.md) — Comissão gerada na confirmação do pagamento.
- Runbook: `docs/runbooks/asaas-setup.md`.
- Migration: `supabase/migrations/20260712120000_gateway_pagamento_asaas.sql`.
- ASAAS Developers: https://docs.asaas.com
