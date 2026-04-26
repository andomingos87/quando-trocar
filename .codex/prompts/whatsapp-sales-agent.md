# WhatsApp Sales Agent Prompt

Use this prompt when implementing or reviewing the `vendas` agent for Quando Trocar.

## Goal

The sales agent turns an inbound WhatsApp lead into a qualified workshop lead or a test-accepted workshop. It explains the product simply, qualifies volume and average ticket, estimates recovered revenue and detects explicit interest or no-interest.

## Runtime Files

- `lib/whatsapp/sales-agent.ts`
- `lib/whatsapp/conversation-router.ts`
- `lib/whatsapp/webhook-handler.ts`
- `lib/whatsapp/types.ts`
- `docs/backlog-whatsapp-bot/fase-1-bot-vendedor.md`
- `docs/backlog-whatsapp-bot/fase-2-conversao-onboarding.md`

## Required Behavior

- Lead origin from the landing phrase should remain `landing_page`.
- Deterministic classification should handle obvious messages before OpenAI.
- OpenAI classification should use strict structured output with closed intent enums.
- The agent may suggest intent and extracted values, but backend rules decide final `lead.status`.
- If the user asks how it works, the reply must mention:
  - workshop registers the service or oil change;
  - the system sends an automatic reminder;
  - the customer is nudged to return to the workshop.
- If volume and ticket are known, calculate estimated recovered revenue using the current project rule: 10 percent recovery.
- If the lead accepts a test, set the reply path that allows conversion to `oficina`.
- If the lead explicitly says no, mark the lead as lost only for clear negative intent.

## Status Rules

- `pergunta_funcionamento` -> `em_conversa`
- `informa_volume_ticket` -> `qualificado`
- `quer_testar` -> `teste_aceito` and conversion path
- `sem_interesse` -> `perdido` only when explicit
- `fora_escopo` -> do not destroy an existing higher-value status

## Safety Rules

- Do not let OpenAI alone mark a lead as `perdido`, `convertido` or `teste_aceito` unless deterministic business rules validate it.
- Do not ask for sensitive credentials.
- Do not promise integrations, pricing or contract terms that are not in the PRD or current docs.
- Keep replies short enough for WhatsApp.

## Test Ideas

- "Como funciona?" explains the three required product mechanics.
- "Faco 80 trocas por mes e ticket medio de 180" returns qualified status and ROI tool call.
- "Quero testar" returns `teste_aceito` and conversion flag.
- "Nao tenho interesse" returns `perdido`.
- Ambiguous text does not downgrade an interested lead.

