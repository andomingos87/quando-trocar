# ADR 0010: Painel web no MVP ou só WhatsApp

- **Status**: proposed
- **Data**: pendente
- **Decisores**: pendente
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §19, §24`, `docs/product/telas-web.md`

## Contexto

A oficina interage com o produto via dois canais possíveis:

- **Somente WhatsApp** — Cadastra cliente, registra serviço, marca retorno, consulta lembretes — tudo pelo bot. Mais simples, fricção menor (oficina já vive no WhatsApp).
- **WhatsApp + painel web** — Operação dia-a-dia via WhatsApp, visão consolidada (métricas, lista de clientes, conversas, retornos) via painel web.

PRD §19 descreve "Dashboard MVP" com 6 telas mínimas. `docs/product/telas-web.md` detalha uma proposta de painel. Fase 4 do backlog inclui dashboard.

Pergunta: o painel web está no MVP ou é fase posterior?

## Decisão

**Pendente — recomendação inicial é dashboard mínimo na Fase 4, sem ser bloqueante para Fases 1-3.**

## Alternativas consideradas

- **Sem painel no MVP** — Acelera lançamento, força disciplina de "tudo no WhatsApp". Contra: oficina sem visão consolidada, dificulta debug e suporte.
- **Painel completo no MVP** — Atrasa lançamento significativamente. Descartado.
- **Painel mínimo na Fase 4** — Métricas básicas + lista de clientes/lembretes/retornos. Suficiente para validação. Recomendado.

## Consequências

A decidir após escolha.

## Referências

- `docs/product/PRD-whatsapp-bot.md §19` (Dashboard MVP), §24 (Decisões em Aberto)
- `docs/product/telas-web.md` (proposta detalhada)
- `docs/backlog-whatsapp-bot/fase-4-retorno-dashboard.md`
