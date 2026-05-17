# ADR 0004: Webhook valida → persiste → enfileira → worker processa

- **Status**: accepted
- **Data**: 2026-04-25
- **Decisores**: time Quando Trocar
- **Fonte**: `docs/architecture/whatsapp-bot-technical-plan.md`, `docs/product/PRD-whatsapp-bot.md §15, §20`

## Contexto

A Meta envia webhooks de mensagens WhatsApp para o nosso endpoint. Requisitos da plataforma:

- Resposta HTTP em até 2 segundos. Se demorar, a Meta retenta e pode pausar entregas.
- Nenhuma mensagem pode ser perdida.
- Processamento envolve: validar assinatura, identificar contato, decidir modo, eventualmente chamar LLM (segundos), aplicar regras, gravar estado, enviar resposta. Não cabe em 2s.

A pergunta: como atender o SLA do webhook sem perder mensagem?

## Decisão

Padrão **webhook fino → fila durável → worker assíncrono**:

1. **Webhook** (`/api/webhooks/whatsapp`) — valida assinatura `X-Hub-Signature-256`, persiste o payload bruto em `whatsapp_events`, enfileira o evento em Supabase Queues (`pgmq`), responde 200 OK.
2. **Worker** — consome a fila, identifica contato (via `conversation-router`), define `agent_mode`, chama agente, aplica regras determinísticas, escreve estado, enfileira envio de resposta.
3. **Outbox sender** — consome fila de envio, chama Cloud API, persiste `whatsapp_message_id`, atualiza status.

Webhook nunca processa síncrono. Worker nunca pega evento sem antes estar persistido.

## Alternativas consideradas

- **Processamento síncrono no webhook** — Mais simples, mas viola SLA da Meta e perde mensagens em pico ou falha de LLM.
- **Webhook → invocar Edge Function diretamente sem fila** — Pula a fila mas perde a garantia de retry. Descartado: queremos retry durável.
- **Redis/Upstash como fila** — Funciona mas adiciona provedor extra. Descartado: Supabase Queues (`pgmq`) já está no stack e é durável o suficiente.
- **Webhook → persistir → fila → worker** — Escolhido. Padrão "outbox" adaptado para inbound.

## Consequências

### Positivas

- SLA da Meta respeitado (webhook responde em ~100ms).
- Mensagem nunca perdida — está em `whatsapp_events` antes de qualquer processamento.
- Retry natural via fila com backoff.
- Falha no LLM ou Cloud API não bloqueia recebimento.

### Negativas / trade-offs

- Latência percebida pelo usuário aumenta (webhook → fila → worker → envio). Aceitável: resposta em até 15s no cenário normal (PRD §20).
- Mais componentes para monitorar (fila, worker, outbox).
- Idempotência precisa ser explícita ([ADR-0006](./0006-idempotencia-via-provider-ids.md)) — mesma mensagem pode ser processada mais de uma vez.

## Referências

- `docs/architecture/whatsapp-bot-technical-plan.md`
- `docs/product/PRD-whatsapp-bot.md §15` (Arquitetura Técnica) e §20 (Não Funcionais — Confiabilidade)
- `AGENTS.md §WhatsApp Rules`
- `lib/whatsapp/webhook-handler.ts`
- `app/api/webhooks/whatsapp/route.ts`
