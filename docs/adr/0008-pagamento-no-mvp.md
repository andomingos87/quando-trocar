# ADR 0008: Pagamento via Mercado Pago

- **Status**: accepted
- **Data**: 2026-05-17
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §24`

## Contexto

Quando uma oficina decide contratar, há um momento de cobrança. Caminhos possíveis eram:

- **Pagamento manual** — Cobrança fora do fluxo (PIX, boleto enviado manualmente).
- **Pagamento integrado** — Bot gera link de pagamento e o sistema atualiza status via webhook do provedor.
- **Período de teste sem cobrança inicial** — Oficina entra em `plano = teste`, cobrança vem depois.

A pergunta era qual abordagem usar e, se integrada, qual provedor.

## Decisão

**Pagamento integrado via Mercado Pago.**

Quando a oficina aceita contratar, o bot gera link de pagamento Mercado Pago (preferência de pagamento ou checkout transparente). Webhook do Mercado Pago atualiza `oficinas.status` para `cliente_ativo` e `oficinas.plano` quando o pagamento é confirmado.

Período de teste grátis ainda é compatível — a oficina entra em `plano = teste` sem cobrança; cobrança só dispara ao final do teste ou quando a oficina pedir explicitamente.

## Alternativas consideradas

- **Mercado Pago** — Escolhido. Penetração alta no Brasil, suporta PIX, cartão, boleto. API documentada e estável. Webhooks confiáveis.
- **Stripe** — Excelente DX, mas menos popular no Brasil para PMEs. Conversão menor para oficinas em geral.
- **Iugu / Asaas / Pagar.me** — Alternativas válidas no Brasil, sem motivo forte para escolher sobre Mercado Pago no MVP.
- **Manual no MVP** — Descartado: gera atrito comercial e não escala além de meia dúzia de oficinas.

## Consequências

### Positivas

- Mercado Pago é familiar para a maioria das oficinas brasileiras (PIX/boleto/cartão num só lugar).
- Webhook automático elimina trabalho manual de reconciliação.
- Suporta cobrança recorrente nativamente.

### Negativas / trade-offs

- Taxa do Mercado Pago no fluxo (~4-5% em cartão, menor em PIX). Aceitável.
- Acoplamento com o provedor — migrar para outro envolve refazer integração e remapear webhooks.
- Webhook do Mercado Pago precisa de endpoint próprio (`/api/webhooks/mercado-pago` ou similar) com validação de assinatura.
- Precisa decidir: cobrança recorrente automática (preferência) ou cobrança avulsa renovada? Decidir na implementação.

## Implementação

A implementação do pagamento integrado ainda não foi feita — entra no escopo da Fase 4 ou de uma fase específica de billing.

Tarefas futuras (não fazer agora):

1. Cadastrar app no Mercado Pago, gerar `MERCADO_PAGO_ACCESS_TOKEN`.
2. Criar endpoint `/api/webhooks/mercado-pago` com validação.
3. Definir produto/preço no painel ou via API (depende de [ADR-0012](./0012-politica-de-preco.md)).
4. Adicionar ao fluxo de conversão da oficina: bot envia link de pagamento ao detectar `teste_aceito` ou `cliente_ativo` desejado.
5. Persistir `pagamentos` (status, valor, data, ID externo, `oficina_id`).

## Referências

- `docs/product/PRD-whatsapp-bot.md §8` (Conversão da Oficina), §24 (Decisões em Aberto)
- Relacionado: [ADR-0012](./0012-politica-de-preco.md) (preço a definir)
- [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
