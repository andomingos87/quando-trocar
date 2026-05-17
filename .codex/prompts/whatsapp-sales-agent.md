# WhatsApp Sales Agent Prompt

Use this prompt when implementing or reviewing the `vendas` agent for Quando Trocar.

## Goal

The sales agent turns an inbound WhatsApp lead into a qualified workshop lead or a test-accepted workshop. It explains the product simply, qualifies volume and average ticket, estimates recovered revenue and detects explicit interest or no-interest.

It **does not quote price**. Pricing is negotiated per workshop and stored in the DB (ADR-0012). When asked about price, the agent conducts toward the free trial or hands off to a human.

## Runtime Files

- `lib/whatsapp/sales-agent.ts`
- `lib/whatsapp/conversation-router.ts`
- `lib/whatsapp/webhook-handler.ts`
- `lib/whatsapp/types.ts`
- `docs/backlog-whatsapp-bot/fase-1-bot-vendedor.md`
- `docs/backlog-whatsapp-bot/fase-2-conversao-onboarding.md`
- `docs/adr/0012-politica-de-preco.md`
- `docs/adr/0001-llm-como-conselheiro-nao-decisor.md`

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

## Pricing rule (ADR-0012)

The bot **does not quote a numeric price**. Price varies per workshop and is configured by admins (the bot has no source of truth at conversation time).

When the lead asks about price, the bot follows this sequence:

1. **First mention** — soft redirect to free trial:

   ```text
   O valor a gente combina durante o teste, depois que voce ver o produto rodando. Posso ativar 14 dias gratis pra sua oficina agora?
   ```

2. **Lead insists** ("mas quanto custa?", "preciso saber o preco antes") — hand off to a human via `wa.me` (same pattern as ADR-0009 in the reminder agent, but pointing to a commercial WhatsApp number — configurable, fallback to Anderson's own).

The bot does not invent ranges ("entre R$ 50 e R$ 200"), does not say "depende", does not commit to a number even if the lead pressures.

## Status Rules

- `pergunta_funcionamento` -> `em_conversa`
- `informa_volume_ticket` -> `qualificado`
- `pergunta_preco` -> stays in current status; trigger soft redirect on first ask, handoff on insistence.
- `quer_testar` -> `teste_aceito` and conversion path
- `sem_interesse` -> `perdido` only when explicit
- `fora_escopo` -> do not destroy an existing higher-value status

## Safety Rules

- Do not let OpenAI alone mark a lead as `perdido`, `convertido` or `teste_aceito` unless deterministic business rules validate it.
- Do not ask for sensitive credentials.
- Do not promise integrations, pricing or contract terms that are not in the PRD or current docs.
- **Do not quote a numeric price**. Redirect or hand off.
- Keep replies short enough for WhatsApp.

## Test Ideas

- "Como funciona?" explains the three required product mechanics.
- "Faco 80 trocas por mes e ticket medio de 180" returns qualified status and ROI tool call.
- "Quanto custa?" returns soft redirect to free trial; does **not** include any value in the reply.
- "Mas preciso saber o preco" (insistence after the soft redirect) triggers handoff to commercial WhatsApp via `wa.me`.
- "Quero testar" returns `teste_aceito` and conversion flag.
- "Nao tenho interesse" returns `perdido`.
- Ambiguous text does not downgrade an interested lead.
