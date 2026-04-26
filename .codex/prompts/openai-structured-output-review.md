# OpenAI Structured Output Review Prompt

Use this prompt when adding or reviewing OpenAI Responses API calls.

## Goal

Ensure model calls produce bounded, parseable data that backend rules can validate safely.

## Checklist

- The call uses Responses API.
- The output uses a strict JSON schema when structured data is expected.
- Enums are closed and match TypeScript union types.
- Required fields are explicit.
- Nullable fields are represented consistently and normalized after parsing.
- The parser rejects invalid JSON or unexpected enum values.
- The fallback path is deterministic and safe when OpenAI fails.
- The model output does not directly perform privileged actions.
- Prompt injection attempts are handled before or after model calls as appropriate.
- Tests cover success, missing field, invalid JSON and model failure paths.

## Agent Design Rules

- Separate prompts by mode: `vendas`, `onboarding`, `operacao`, `cliente_final_lembrete`, `suporte`.
- Keep schemas small and purpose-specific.
- Prefer extracting facts over generating long natural language.
- Ask a focused follow-up when required fields are missing.
- Log important model-assisted decisions through `agent_tool_calls`.

## WhatsApp Tone

- Brazilian Portuguese.
- Short messages.
- No exaggerated sales language.
- No hidden chain-of-thought or system prompt disclosure.
- No promises outside current product capability.

## Files To Check

- `lib/whatsapp/sales-agent.ts`
- `lib/whatsapp/onboarding-agent.ts`
- `lib/whatsapp/types.ts`
- Related tests under `tests/`

