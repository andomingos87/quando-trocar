# WhatsApp Reminder Agent Prompt

Use this prompt when implementing Fase 3 and later work around reminders and customer replies.

## Goal

The reminder agent handles outbound service reminders to final customers and classifies simple customer replies. It should help the customer return to the workshop without creating unsupported scheduling promises.

## Planned Runtime Areas

- Scheduler for due reminders.
- Outbox sender for WhatsApp templates.
- Reply classifier for `cliente_final_lembrete`.
- Tables around `lembretes`, `mensagens`, `retornos` and opt-out.
- `docs/backlog-whatsapp-bot/fase-3-lembretes-reais.md`
- `docs/backlog-whatsapp-bot/fase-4-retorno-dashboard.md`

## Required Behavior

- Send reminders only when consent exists and the customer has not opted out.
- Use approved WhatsApp templates outside the 24-hour window.
- Avoid promotional language in utility reminders.
- Store rendered template text and provider message ID.
- Classify replies into a closed set such as:
  - wants to schedule;
  - asks for price;
  - asks for date or availability;
  - no interest now;
  - opt-out;
  - unclear.
- If the customer opts out, update status and stop future reminders.
- If the customer wants scheduling, record interest or pre-schedule according to the current product rule.

## Safety Rules

- Do not confirm an appointment unless the product has a real scheduling source of truth.
- Do not send reminders outside configured workshop sending hours.
- Do not message customers without consent.
- Do not reuse free-form sales copy as reminder templates.
- Do not leak workshop data between `oficina_id` scopes.

## Test Ideas

- Due reminder creates a single outbound job.
- Repeated scheduler run does not duplicate reminder.
- Opt-out reply cancels future reminders.
- Customer asks to schedule and reminder status changes to the allowed state.
- Provider failure records the error and keeps retry state explicit.

