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
- **Business rules index**: `docs/regras-de-negocio.md`
- **Context layer (modules, conventions)**: `.context/` — see `.context/modules/<module>/AGENTS.md` and `.context/conventions.md`

## Language convention

- `AGENTS.md` and `CLAUDE.md` (including the `AUREA:SYNC` block) are in **English** (concise, prescriptive, agent-facing — low maintenance).
- Everything else that is documentation is in **Brazilian Portuguese**: product specs, ADRs, glossary, runbooks, backlog, context changelog **and the `.context/` layer** (module docs, conventions, decisions, lessons). The team and stakeholders speak Portuguese, and domain terms — `oficina`, `lembrete`, `retorno`, `agent_mode`, `participant_type` — are native Portuguese.
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
- **Do not create or switch git branches unless the user explicitly asks.** The owner works solo and commits directly to `main`. Commit to the current branch; never open a feature branch on your own initiative.
- **Keep `docs/regras-de-negocio.md` in sync with code.** Any change that alters product behaviour — new/changed status, intent, enum, guardrail, flow, threshold, agent rule, billing logic, opt-out trigger — must update the matching entry in the same change. When uncertain whether a change qualifies, ask the user before implementing. Pure refactors, renames, or fixes that do not change behaviour do not require an update.

<!-- AUREA:SYNC:START -->
## Aurea Rules (invariants)

1. Code only lives inside a module declared under `.context/modules/<module>/`.
2. Every feature assesses its documentation impact (stale docs are a bug).
3. Mandatory quality gates: correctness (with tests), performance, security, consistency, professional completeness, reversibility. Nothing is "done" until it passes all of them.
4. An information gap becomes a question, never a guess. But proposing the complete professional scope is not a guess — it is expected (senior-level completeness).
5. MCP: use only the project-local `.mcp.json`. No global MCP.

## Execution Mode

How any agent/AI should work in this project:

- **Autonomy** — work autonomously; do not narrate every step or send progress messages; fix your own errors when possible; deliver the complete professional product, not the literal minimum requested (anticipate states, validation, security, recovery, edge cases); run lint and tests before finishing.
- **When to interrupt** — only when the decision is the user's: architecture, library or implementation choice; ambiguous requirement; destructive change (data deletion, irreversible migration) or an outward action (deploy, publish, PR, touching a secret). In those cases, explain the options and wait.
- **Final response** — on completion: implementation summary, files changed, test results, open items (if any).
<!-- AUREA:SYNC:END -->
