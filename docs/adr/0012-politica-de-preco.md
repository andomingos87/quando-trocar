# ADR 0012: Política de preço/plano usada pelo agente vendedor

- **Status**: proposed
- **Data**: pendente
- **Decisores**: pendente
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §16, §24`

## Contexto

O agente vendedor (modo `vendas`) precisa explicar valor e, em algum momento, falar de preço. Hoje o PRD diz explicitamente que o agente **não deve** "inventar preços, planos ou promessas não configuradas" (§16).

Sem política definida, há duas possibilidades:

- Agente nunca cita preço, apenas conduz para teste grátis e deixa cobrança/discussão de preço para humano.
- Agente cita preço com base numa tabela definida.

Pergunta: qual a política de preço? Existe tabela pública? Plano único? Tiers por volume? Trial gratuito por quanto tempo?

## Decisão

**Pendente — depende da decisão comercial.**

Recomendação inicial: enquanto não houver tabela definida, agente conduz para `teste grátis` (sem cobrança no MVP), e remete dúvida de preço para humano via handoff (`agent_mode = suporte`).

## Alternativas consideradas

- **Sem preço público, agente sempre puxa para teste/handoff** — Funciona para MVP de validação. Permite negociar caso a caso. Recomendado enquanto preço não estiver fechado.
- **Tabela pública com 1 plano (ex: R$ X por mês)** — Simples, transparente. Exige decisão comercial firme.
- **Tabela pública com tiers (ex: Starter / Pro / Business)** — Justifica diferenciação. Adiciona complexidade no agente (qual recomendar?).
- **Preço por volume (ex: R$ X por cliente cadastrado)** — Alinha custo com valor entregue. Modelo SaaS comum mas exige métrica de billing confiável.

## Consequências

A decidir após escolha.

## Referências

- `docs/product/PRD-whatsapp-bot.md §16` (Requisitos do Agente IA), §24 (Decisões em Aberto)
- Relacionado: [ADR-0008](./0008-pagamento-no-mvp.md)
- `.codex/prompts/whatsapp-sales-agent.md` (atualizar quando decidir)
