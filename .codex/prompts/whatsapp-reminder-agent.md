# WhatsApp Reminder Agent Prompt

Use this prompt when implementing Fase 3 and later work around reminders and customer replies.

## Goal

The reminder agent handles outbound service reminders to final customers and classifies simple customer replies. When the customer wants to schedule, ask about price, availability or anything that needs a human, the agent **does not** try to answer — it makes a `wa.me` handoff bridge between the customer and the workshop attendant.

The agent never promises a schedule, never quotes a price, never confirms a time.

## Planned Runtime Areas

- Scheduler for due reminders.
- Outbox sender for WhatsApp templates.
- Reply classifier for `cliente_final_lembrete`.
- Tables around `lembretes`, `mensagens`, `retornos` and opt-out.
- `docs/backlog-whatsapp-bot/fase-3-lembretes-reais.md`
- `docs/backlog-whatsapp-bot/fase-4-retorno-dashboard.md`
- `docs/adr/0009-confirmacao-vs-pre-agendamento.md`
- `docs/adr/0005-templates-meta-vs-mensagem-livre.md`

## Required Behavior

### Outbound (sending reminders)

- Send reminders only when consent exists and the customer has not opted out.
- Use approved WhatsApp templates outside the 24-hour window.
- Avoid promotional language in utility reminders.
- Store rendered template text and provider message ID.

### Reply classification

Closed set of intents:

- `quer_agendar` — wants to schedule.
- `quer_reagendar` — wants to reschedule.
- `pergunta_preco` — asks about price.
- `pergunta_horario` — asks about workshop hours.
- `pergunta_disponibilidade` — asks if there's availability.
- `nao_tem_interesse` — declines.
- `ja_fez_servico` — says the service was already done elsewhere.
- `numero_errado` — wrong number.
- `mensagem_indefinida` — unclear.
- `opt_out` — wants to stop receiving messages.

### Reply actions

- `quer_agendar`, `quer_reagendar`, `pergunta_preco`, `pergunta_horario`, `pergunta_disponibilidade`, `mensagem_indefinida` → trigger `handoff_wame` (see below). Mark reminder as `handoff_iniciado`.
- `nao_tem_interesse` → mark reminder `sem_resposta` or `cancelado`. Reply cordially, then end.
- `ja_fez_servico` → mark reminder `respondido`. Reply with thanks. Do not register revenue (workshop logs it manually if applicable).
- `numero_errado` → mark customer `numero_errado`, cancel future reminders, reply briefly.
- `opt_out` → mark customer `opt_out`, set `opt_out_at`, cancel future reminders, confirm removal.

## The `wa.me` handoff (ADR-0009)

When an intent triggers handoff, send **two messages**:

**1. To the customer** (in the existing conversation):

```text
Pra agendar, fale direto com a oficina:
https://wa.me/{whatsapp_atendente}?text={mensagem_para_cliente_url_encoded}
```

`whatsapp_atendente` comes from `oficinas.whatsapp_atendente` (E.164, no `+`). If null, fall back to `whatsapp_principal`.

Pre-filled message tailored to intent. Examples:

- `quer_agendar` → "Quero agendar a troca de oleo do meu {veiculo}"
- `quer_reagendar` → "Preciso reagendar a troca do meu {veiculo}"
- `pergunta_preco` → "Queria saber o valor da troca"
- `pergunta_horario` → "Queria saber o horario de atendimento"

**2. To the workshop attendant** (separate outbound message to `whatsapp_atendente`):

```text
{nome_cliente} ({veiculo}) {intencao_descrita}. Chame agora:
https://wa.me/{whatsapp_cliente}?text={mensagem_para_atendente_url_encoded}
```

Pre-filled message tailored to intent. Example:

```text
Oi {nome_cliente}, da {nome_oficina}, vamos agendar a troca do seu {veiculo}?
```

After both messages are sent:

- `lembretes.status = 'handoff_iniciado'` (or `'respondido'`).
- `agent_tool_calls` records `tool = 'handoff_wame'` with input/output.
- Bot exits the conversation. Future messages from the customer in this conversation are still received and persisted, but no agent reply unless a new clear intent arrives.

## Safety Rules

- Never confirm an appointment. The bot has no real schedule source.
- Never quote a price (ADR-0012). Hand off when asked.
- Never offer a discount or promotion not in the docs.
- Do not send reminders outside configured workshop sending hours.
- Do not message customers without consent.
- Do not reuse free-form sales copy as reminder templates.
- Do not leak workshop data between `oficina_id` scopes.
- `wa.me` URLs must be properly URL-encoded.
- `whatsapp_atendente` must be validated as E.164 before generating the link.

## Test Ideas

- Due reminder creates a single outbound job.
- Repeated scheduler run does not duplicate reminder.
- Opt-out reply cancels future reminders.
- Customer says "pode ser quinta 14h?" → classified as `quer_agendar` → two `wa.me` messages sent (one to customer, one to attendant), reminder transitions to `handoff_iniciado`, no `agendado` status anywhere.
- Customer asks "quanto custa?" → classified as `pergunta_preco` → handoff, bot does not quote any value.
- `oficinas.whatsapp_atendente` is null → falls back to `whatsapp_principal`.
- `wa.me` URL is URL-encoded correctly (spaces → `%20`, accents → percent-encoded).
- Provider failure records the error and keeps retry state explicit.
