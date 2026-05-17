# CLAUDE.md

Project-specific guidance for Claude Code when working on Quando Trocar.

## Primary context

Read `AGENTS.md` first. It is the canonical, prescriptive guide for any agent (Claude, Codex, others) on stack, boundaries, agent modes, OpenAI rules, Supabase rules, WhatsApp rules and code style. This file complements but does not replace it.

## Where to find context

- **Project overview, stack and architectural rules**: `AGENTS.md`
- **Navigable doc index**: `docs/README.md`
- **Domain vocabulary**: `docs/glossary.md`
- **Architectural decisions and open questions**: `docs/adr/`
- **Operational procedures (env, deploy, Meta setup, migrations)**: `docs/runbooks/`
- **Product specs**: `docs/product/`
- **Bot architecture**: `docs/architecture/whatsapp-bot-technical-plan.md`
- **Active execution / phase tracking**: `docs/backlog-whatsapp-bot/`
- **Decision history**: `docs/CONTEXT_CHANGELOG.md`

## Language convention

- `AGENTS.md` and `CLAUDE.md` are in **English** (concise, prescriptive, agent-facing — low maintenance).
- Product specs, ADRs, glossary, runbooks, backlog and context changelog are in **Brazilian Portuguese** (the team and stakeholders speak Portuguese; domain terms — `oficina`, `lembrete`, `retorno`, `agent_mode`, `participant_type` — are native Portuguese).
- WhatsApp replies sent by the bot must be Brazilian Portuguese (see `AGENTS.md §OpenAI Agent Rules`).

## Before implementing

1. Open the active phase in `docs/backlog-whatsapp-bot/` and confirm the requested change fits its scope.
2. Skim relevant ADRs in `docs/adr/` to avoid violating an accepted decision.
3. If touching a domain term you do not recognise, check `docs/glossary.md`.
4. If touching env, deploy, Meta or migrations, follow the matching runbook in `docs/runbooks/`.

## Quick commands

```bash
npm install        # install dependencies
npm run dev        # start dev server (Turbopack)
npm run build      # production build
npm test           # vitest run
npm run lint       # next lint
```

## Behavioural reminders

- Do not refactor unrelated code while changing agent behaviour.
- Keep changes scoped to the requested phase.
- Add or update tests when changing parsing, routing, status transitions, repository writes or webhook behaviour.
- Never let LLM output alone change `lead.status`, `participant_type`, `agent_mode`, payment state, opt-out state or reminder status (see ADR-0001).
- Run `git status --short` before and after work to avoid overwriting local edits.
