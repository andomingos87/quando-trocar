# Supabase RLS And Schema Review Prompt

Use this prompt before implementing or reviewing Supabase schema, RLS, migrations, queues or cron.

## Goal

Protect multi-workshop data and keep the WhatsApp bot auditable and idempotent.

## Review Sources

- `docs/whatsapp-bot-technical-plan.md`
- `docs/backlog-whatsapp-bot/README.md`
- `docs/backlog-whatsapp-bot/fase-2-conversao-onboarding.md`
- `lib/supabase/admin.ts`
- `lib/whatsapp/repository.ts`

## Checklist

- Public tables that can be reached by authenticated users have RLS enabled.
- Policies scope workshop data by `oficina_id`.
- `oficina_members` or equivalent membership data is the authorization source.
- Service role is used only in server code and never exposed to browser bundles.
- Views do not accidentally bypass RLS.
- Provider payload audit tables are restricted.
- Unique indexes protect idempotency:
  - WhatsApp event/provider IDs;
  - WhatsApp message IDs;
  - customer phone per workshop;
  - outbound provider IDs when applicable.
- Reminder due queries have indexes on status and schedule time.
- Migrations avoid breaking existing Fase 1 data.
- New status/check constraints include all planned modes needed by the near-term phases.

## Common Risks

- Updating rows without a matching SELECT policy.
- Using user-editable metadata for authorization.
- Creating `security definer` functions in exposed schemas.
- Assuming same customer WhatsApp is globally unique instead of unique per workshop.
- Letting a repeated webhook create duplicate customers, services or reminders.
- Forgetting opt-out or consent fields before reminder work.

## Verification

Run the most relevant checks for the change:

- Unit tests for repository behavior when mocks exist.
- SQL assertions or local Supabase checks for RLS policies.
- Build or typecheck for generated database types if present.
- Manual query for duplicate prevention when changing unique indexes.

