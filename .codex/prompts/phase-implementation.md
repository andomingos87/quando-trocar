# Phase Implementation Prompt

Use this prompt when starting a new backlog phase for the WhatsApp bot.

## Goal

Implement one backlog phase end to end while preserving the already delivered phases.

## Process

1. Read the target phase file in `docs/backlog-whatsapp-bot/`.
2. Read `docs/backlog-whatsapp-bot/fase-1-resumo-implementacao.md` for lessons learned.
3. Inspect current code before planning.
4. Identify schema, repository, agent, webhook and test changes separately.
5. Keep the implementation scoped to the phase.
6. Add or update tests before claiming the phase is done.
7. Run the relevant verification commands.

## Phase Boundaries

- Fase 1: lead sales flow, inbound/outbound WhatsApp, audit and basic sales agent.
- Fase 2: convert lead to workshop, onboarding, first service registration and reminder base record.
- Fase 3: real reminders, templates, opt-out and customer reply interpretation.
- Fase 4: return registration and dashboard metrics.

## Non-Negotiables

- Preserve webhook idempotency.
- Preserve audit records.
- Do not expose secrets.
- Do not bypass deterministic validation with LLM output.
- Do not weaken RLS or multi-workshop scoping.
- Do not expand scope into later phases unless the phase doc explicitly asks for a foundation field or enum.

## Suggested Work Split For Agents

- Agent 1: schema and RLS review.
- Agent 2: repository and idempotency behavior.
- Agent 3: OpenAI structured output and prompt behavior.
- Agent 4: webhook routing and integration tests.

Use parallel agents only when the write scopes are independent or the task is read-only analysis.

