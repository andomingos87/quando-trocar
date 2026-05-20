# WhatsApp Sales Agent Prompt

Use this prompt when implementing or reviewing the `vendas` agent for Quando Trocar.

## Goal

The sales agent turns an inbound WhatsApp lead into a qualified workshop lead or a test-accepted workshop. It explains the product simply, qualifies volume and average ticket, estimates recovered revenue, answers FAQs and detects explicit interest or no-interest.

It **does not quote a final price**. It may say "a partir de R$ X" (starting from), where X comes from `planos.preco_base`. Anything beyond that goes to a human (ADR-0012).

## Voice / tone

- Brazilian Portuguese, informal, "fala chefe" style — the user is an oficina owner.
- Use "chefe" naturally, not every sentence (avoid sounding robotic).
- Short messages (WhatsApp friendly).
- No "perfeito.", no "obrigado." formal closings.
- Mirror pain when detected — but only once per conversation (`context.sales.pain_detected`).

## Runtime Files

- `lib/whatsapp/sales-agent.ts`
- `lib/whatsapp/conversation-router.ts`
- `lib/whatsapp/webhook-handler.ts`
- `lib/whatsapp/types.ts`
- `lib/whatsapp/repository.ts` (FAQ + configuracoes_vendedor reads, 60s cache)
- `lib/admin/faq.ts`
- `lib/admin/configuracoes-vendedor.ts`
- `docs/regras-de-negocio.md` (sections 1.1–1.6)
- `docs/adr/0012-politica-de-preco.md`
- `docs/adr/0001-llm-como-conselheiro-nao-decisor.md`

## Required Behavior

- Lead origin from a configured `frases_landing` should remain `landing_page`.
- Deterministic classification handles obvious messages before OpenAI.
- OpenAI classification uses strict structured output with the closed `SalesIntent` enum.
- The agent may suggest intent and extracted values, but backend rules decide final `lead.status`.
- If the user asks how it works, the reply must mention:
  - workshop registers the service or oil change;
  - the system reminds the customer on the right day;
  - the customer comes back for the next service.
- Volume + ticket can be split across messages — the agent persists `sales.volume_known` / `sales.ticket_known` in `conversas.context` until both are known. Only then computes ROI.
- ROI uses `configuracoes_vendedor.taxa_recuperacao_roi` (default 0.15). Text frames it as a tendency, not a promise: *"oficinas do seu tamanho costumam trazer de volta uns 15% dos clientes…"*.
- FAQ lookup uses `faq_vendas` (active rows). Match by keyword count, ties broken by `ordem`.
- If the lead accepts a test, set the reply path that allows conversion to `oficina`.
- If the lead explicitly says no, mark the lead as lost only for clear negative intent.

## Pricing rule (ADR-0012)

The bot **does not quote a final numeric price**. It may quote a starting price.

When the lead asks about price:

1. **First mention** — say "a partir de R$ X" and redirect to free trial:

   ```text
   Olha chefe, parte de R$ 59/mes. O valor final a gente fecha olhando o tamanho da sua oficina, mas antes de combinar preco, bora ativar 14 dias gratis pra voce ver rodando?
   ```

   (R$ 59 = `planos.preco_base`. Increment `sales.price_mentions`.)

2. **Lead insists** (second `pergunta_preco` in same conversation) — hand off to a human via `wa.me`. Number from `configuracoes_vendedor.whatsapp_handoff_comercial`.

The bot does not invent ranges, does not say "depende", does not commit to a final number even if pressured.

## Status / Intent Rules

- `pergunta_funcionamento` → `em_conversa`; long copy on 1st, short on 2nd (`funcionamento_explained` flag)
- `informa_volume_ticket` → `qualificado` **once both volume and ticket are known**
- `pergunta_preco` → status unchanged; soft redirect on 1st (connects with known ROI if memory has it), handoff on 2nd
- `pergunta_faq` → status unchanged; response from `faq_vendas`
- `small_talk` → status unchanged; dedicated short response, does not repeat pitch
- `quer_testar` → `teste_aceito` and conversion path
- `sem_interesse` → `perdido` only when explicit (`isExplicitLossMessage`)
- `fora_escopo` → do not destroy an existing higher-value status; short copy when already explained

## Detection order (classifySalesMessage)

1. `isExplicitLossMessage` → `sem_interesse` (highest priority).
2. **`detectPain` → `pergunta_funcionamento`** (override: pain always wins unless explicit loss).
3. `detectPriceQuestion` → `pergunta_preco`.
4. `extractVolumeOrTicket` → `informa_volume_ticket`.
5. Regex of "how does it work" → `pergunta_funcionamento`.
6. Regex of "I want to try" → `quer_testar`.
7. **`detectSmallTalk` → `small_talk`** (human chatter — team, robô, etc.).
8. `matchFaq` → `pergunta_faq`.
9. Default → `fora_escopo`.

Second gate inside `WhatsappSalesAgent.generateReply`: if OpenAI returns `sem_interesse` but `detectPain` matches and message is not explicit loss → override to `pergunta_funcionamento`.

## Greeting on first turn

When `context.sales.greeted !== true`, the "explainer" intents (`pergunta_funcionamento`, `fora_escopo`) get prefixed with:

> *"Fala chefe! Aqui e do Quando Trocar — a gente faz o cliente que troca oleo (ou faz revisao) voltar pro proximo servico."*

Persisted via `memory.greeted = true`. Other intents (`pergunta_preco`, `informa_volume_ticket`, `quer_testar`, etc.) do **not** get the greeting — they have their own purposeful copy.

## Forced handoff signals

These set `handoffRequired = true` (marks `conversas.handoff_required`), reply contains a `wa.me` link to commercial number, and **status is not changed**:

- `pergunta_preco` with `sales.price_mentions >= 1` → reason `preco_insistente`.
- `detectScaleHandoff` (mensagem cita rede/franquia/matriz/filial) → reason `rede_ou_franquia`.
- `informa_volume_ticket` with `volume > 300/mês` → reason `volume_alto`.

## Pain mirroring

When the lead's message contains a typical workshop pain ("cliente some", "ninguem volta", "anoto no caderno", "esqueco de chamar", "perco cliente"), prefix the regular reply with:

> *"Pois e chefe, e isso que a gente resolve aqui."*

Persist `sales.pain_detected = true` so the prefix isn't repeated.

## Safety Rules

- Do not let OpenAI alone mark a lead as `perdido`, `convertido` or `teste_aceito` unless deterministic business rules validate it.
- Do not ask for sensitive credentials.
- Do not promise integrations, pricing or contract terms that are not in the PRD or current docs.
- **Do not quote a final numeric price**. Starting price is OK; final price → handoff.
- Keep replies short enough for WhatsApp.

## Test Ideas

- "Fala" (first turn) → greeting prefix + explainer + qualification ask.
- "Como funciona?" (after greeting) → no greeting prefix; explainer (long the 1st time, short the 2nd).
- "Cliente some" → pain override → explainer with pain prefix *"Pois e chefe, e isso que a gente resolve aqui."* (NOT `sem_interesse`, even if LLM thinks so).
- "Faco 80 trocas" → bot persists volume and asks for ticket.
- "Ticket 180" (next message) → bot joins with memorized volume and returns ROI 15%.
- "Quanto custa?" after ROI was shown → reply connects price with recovered revenue: *"R$ 59/mes, pra voce que ta recuperando uns R$ X/mes sai praticamente de graca…"*
- "Mas preciso saber o preco" (after first ask) → handoff `preco_insistente` with `wa.me` link.
- "Faco 500 trocas" → handoff `volume_alto`.
- "Tenho uma rede" → handoff `rede_ou_franquia`.
- "Pra que time voce torce?" → `small_talk` short redirect, status unchanged, no pitch repeated.
- "Preciso integrar com meu ERP" → FAQ response from `faq_vendas`.
- "Quero testar" → `teste_aceito` and conversion flag.
- "Nao tenho interesse" → `perdido`.
- "Ok" / "Blz" (after explainer already shown) → short fallback, does not repeat full pitch.
- Ambiguous text does not downgrade an interested lead.
