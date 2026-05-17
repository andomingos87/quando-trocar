# ADR 0008: Pagamento dentro do fluxo ou manual no MVP

- **Status**: proposed
- **Data**: pendente
- **Decisores**: pendente
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §24`

## Contexto

Quando uma oficina decide contratar, há um momento de cobrança. Caminhos possíveis:

- **Pagamento manual** — Representante ou o próprio Anderson envia link/PIX/boleto fora do fluxo do bot. Bot só registra a oficina como ativa após confirmação manual.
- **Pagamento integrado no bot** — Bot gera link de pagamento (Stripe, Iugu, Asaas, Pagar.me) e atualiza status automaticamente via webhook do provedor.
- **Período de teste sem pagamento** — Oficina entra direto em `plano = teste`, sem cobrança no início. Cobrança depois (manual ou integrada).

O PRD prevê estado `cliente_ativo` e `plano = teste` mas não define a forma de cobrança.

## Decisão

**Pendente — depende de validação comercial. Definir antes de operar com oficinas reais pagantes.**

Recomendação inicial: começar com **período de teste gratuito + cobrança manual** no MVP. Migrar para pagamento integrado quando volume justificar (provavelmente após 10+ oficinas ativas).

## Alternativas consideradas

- **Manual no MVP** — Simples, controlado, permite negociar caso a caso. Contra: não escala, atrito comercial.
- **Stripe / Iugu / Asaas integrado** — Escala, mas adiciona ~1-2 semanas de implementação e mais um provedor. Faz sentido só com volume.
- **Test grátis + cobrança manual** — Atalho razoável para validação. Recomendado para o MVP.

## Consequências

A decidir após escolha.

## Referências

- `docs/product/PRD-whatsapp-bot.md §24` (Decisões em Aberto), §8 (Conversão da Oficina), §22 (Critérios de Aceite — Conversão)
- Relacionado: [ADR-0012](./0012-politica-de-preco.md)
