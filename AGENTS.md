# AGENTS.md

## Project Overview

Quando Trocar is a Next.js 15, React 19 and TypeScript product for automotive workshops. The public site sells a WhatsApp-based retention tool, and the product backlog adds a real WhatsApp agent that sells to workshops, converts leads, registers services, schedules reminders and later supports an operational dashboard.

Core stack:

- Web app: Next.js App Router, React 19, TypeScript and Vercel.
- Styling: Tailwind CSS 4 with local UI components.
- Database and auth: Supabase Postgres, Auth and RLS.
- Jobs: Supabase Queues and Supabase Cron in the target architecture.
- AI: OpenAI Responses API with Structured Outputs.
- Messaging: Meta WhatsApp Business Cloud API.

Important project docs:

- Product scope: `PRD.md` and `PRD_WHATSAPP_BOT_REAL.md`.
- Bot architecture: `docs/whatsapp-bot-technical-plan.md`.
- Bot backlog: `docs/backlog-whatsapp-bot/README.md`.
- Meta setup: `docs/meta-whatsapp-configuracao.md`.
- Web screens: `docs/telas-web.md`.

## Setup Commands

- Install dependencies: `npm install`.
- Start development server: `npm run dev`.
- Build production bundle: `npm run build`.
- Run tests: `npm test`.
- Run lint: `npm run lint`.

Use npm unless the repository is explicitly migrated to another package manager.

## Environment

Server-only secrets must stay out of client code:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`

Any variable prefixed with `NEXT_PUBLIC_` is browser-exposed. Never move service role, OpenAI or WhatsApp secrets into a public variable.

Use `.env.local.example` as the public reference for environment names. Treat `.env` and `.env.local` as local secret files.

## Architecture Rules

The WhatsApp bot is stateful and audited. Preserve these boundaries:

- `lib/whatsapp/webhook-handler.ts` receives webhook events, coordinates persistence, agent execution and outbound messages.
- `lib/whatsapp/conversation-router.ts` resolves participant identity and `agent_mode`.
- `lib/whatsapp/sales-agent.ts` handles lead sales classification and reply rules.
- `lib/whatsapp/onboarding-agent.ts` extracts service registration data for onboarding and operation.
- `lib/whatsapp/repository.ts` contains Supabase persistence.
- `lib/whatsapp/whatsapp-client.ts` sends messages through WhatsApp Cloud API.

The LLM must not directly control critical state. OpenAI can classify intent or extract structured data, but deterministic backend rules must validate status transitions, database writes, WhatsApp sends and agent mode changes.

Keep agent modes explicit:

- `vendas`: lead education, qualification and test acceptance.
- `onboarding`: first service registration after a workshop converts.
- `operacao`: ongoing service registration by an active workshop.
- `cliente_final_lembrete`: customer reminder replies, planned for later phases.
- `suporte`: support and handoff, planned for later phases.

## OpenAI Agent Rules

- Prefer deterministic parsing first when the message format is predictable.
- Use OpenAI only when free text interpretation is needed.
- Use Structured Outputs with strict JSON schemas and closed enums.
- Treat low confidence or missing fields as a reason to ask one focused follow-up question.
- Never let model output alone change `lead.status`, `participant_type`, `agent_mode`, payment state, opt-out state or reminder status.
- Log meaningful decisions in `agent_tool_calls` when they affect business state.
- Keep WhatsApp replies short, concrete and in Brazilian Portuguese.

Prompt assets live in `.codex/prompts/`. When changing agent behavior, update the relevant prompt note and tests together.

## Supabase Rules

- Enable RLS on public tables that are exposed to authenticated users.
- Keep `SUPABASE_SERVICE_ROLE_KEY` usage server-side only.
- Scope workshop data by `oficina_id`.
- Store raw provider payloads for audit, but do not expose them to workshop users by default.
- Preserve idempotency for WhatsApp events and messages. Repeated provider events must not duplicate leads, messages, services or reminders.
- Prefer unique indexes for provider IDs and business keys over application-only duplicate checks.

For schema, RLS or performance work, consult the Supabase project docs and the Supabase skills before implementing.

## WhatsApp Rules

- Validate Meta webhook verification and signatures.
- Persist inbound events before processing.
- Store WhatsApp provider message IDs when available.
- Respect the 24-hour support window for free-form replies.
- Use approved templates for reminders outside the support window.
- Record outbound success and failure details.
- Preserve opt-out and negative consent handling.

## Development Workflow

- Inspect nearby code and docs before editing; this project already has PRD and phase docs.
- Keep changes scoped to the requested phase.
- Do not refactor unrelated UI or bot code while changing agent behavior.
- Add or update tests when changing parsing, routing, status transitions, repository writes or webhook behavior.
- Do not overwrite unrelated local modifications. Check `git status --short` before and after work.

## Testing Instructions

- Run all tests with `npm test`.
- Use focused Vitest runs when iterating on a specific behavior if available through the local test setup.
- Run `npm run build` for changes that touch Next.js routes, server/client boundaries or environment usage.
- Run `npm run lint` before handing off if lint is configured and available.

Test priority for bot work:

- Deterministic parser behavior.
- OpenAI fallback parsing shape and null handling.
- Prompt-injection rejection.
- Idempotent inbound event handling.
- Conversation mode transitions.
- Service registration and reminder creation.
- RLS/security-sensitive database changes.

## Code Style

- Use TypeScript types from `lib/whatsapp/types.ts` for bot contracts.
- Keep server-only integrations out of React client components.
- Prefer clear small functions over large mixed orchestration blocks.
- Keep reply strings stable enough for tests, but avoid overfitting tests to incidental phrasing.
- Follow existing component and utility patterns before adding abstractions.

## Prompt And Agent Assets

Useful local prompts:

- `.codex/prompts/whatsapp-sales-agent.md`
- `.codex/prompts/whatsapp-onboarding-agent.md`
- `.codex/prompts/whatsapp-reminder-agent.md`
- `.codex/prompts/supabase-rls-review.md`
- `.codex/prompts/openai-structured-output-review.md`
- `.codex/prompts/phase-implementation.md`

Use these as task briefs for future agent sessions. They are project-specific guidance, not runtime prompt files unless explicitly wired into the application.

