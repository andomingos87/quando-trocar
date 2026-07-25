# WhatsApp Sales Agent Prompt

Use this prompt when implementing or reviewing the `vendas` agent for Quando Trocar.

## Goal

The sales agent turns an inbound WhatsApp lead into a qualified workshop lead or a test-accepted workshop. It explains the product simply, answers FAQs and detects explicit interest or no-interest. **Ciclo 5:** the agent **does NOT ask** for volume/ticket on the opener — the opener ends with the CTA for the 14-day free trial. ROI is computed only when the lead voluntarily provides volume and ticket.

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
  - workshop registers the service — oil change, shock absorber, filter, alignment, brakes, any part/accessory with predictable return cycle;
  - the system reminds the customer on the right day;
  - the customer comes back for the next service.
- Volume + ticket can be split across messages — the agent persists `sales.volume_known` / `sales.ticket_known` in `conversas.context` until both are known. Only then computes ROI. The opener **does not ask** for these numbers (ciclo 5); the agent only computes ROI if the lead volunteers them. When one number is given alone, the agent asks the missing one with an explicit easy out ("sem stress — bora pro teste de 14 dias").
- ROI uses `configuracoes_vendedor.taxa_recuperacao_roi` (default 0.15). Text frames it as a tendency, not a promise: *"oficinas do seu tamanho costumam trazer de volta uns 15% dos clientes…"*.
- FAQ lookup uses `faq_vendas` (active rows). Match by keyword count, ties broken by `ordem`.
- If the lead accepts a test, **ask for the workshop name** before converting; capture the answer, then set the reply path that allows conversion to `oficina` (carrying `nomeOficina`).
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
- `small_talk` → status unchanged; dedicated short response, does not repeat pitch (off-topic only: futebol, piada)
- `social_test` → status unchanged; patient response (5 rotated variations); counts toward `consecutive_fallback`
- `confirmacao_neutra` → status unchanged; short ack if `funcionamento_explained`, else falls into the regular flow
- `vai_pensar` → status unchanged; "sem pressa" copy, no handoff
- `quer_humano` → status unchanged; **direct handoff** to commercial `wa.me`
- `quer_testar` → `teste_aceito`; **ask for the workshop name first** (`sales.awaiting_workshop_name`). Only when the name answer is captured (`extractWorkshopName`) does the reply set `convertToOficina = true` + `nomeOficina`. The name is persisted in `sales.workshop_name`; the conversion writes it to `oficinas.nome` (empty → `"Oficina sem nome"` placeholder, which triggers backfill on next interaction).
- `sem_interesse` → `perdido` only when explicit (`isExplicitLossMessage`)
- `fora_escopo` → do not destroy an existing higher-value status; short copy when already explained

## Detection order (classifySalesMessage) — updated ciclo 4

1. `isExplicitLossMessage` → `sem_interesse` (highest priority, beats pain).
2. **`detectPain` → `pergunta_funcionamento`** (override).
3. **`detectQuerHumano` → `quer_humano`**.
4. **`detectVaiPensar` → `vai_pensar`**.
5. **`detectBasicGreeting` → `fora_escopo`** confidence 0.9 (skips OpenAI). Empty bodies (stickers) included.
6. **`detectNeutralAck` → `confirmacao_neutra`** (moved up so "blz" doesn't fall into social_test).
7. **`detectSocialTest` → `social_test`** (≤3 chars not covered above, "kkkk", "testando").
8. `detectPriceQuestion` → `pergunta_preco`.
9. `extractVolumeOrTicket` → `informa_volume_ticket`.
10. Regex of "how does it work" → `pergunta_funcionamento`.
11. Acceptance regex → `quer_testar`. Expanded in QTR-35 P1-4a with the real acceptance variations that used to fall through to the LLM: `quero testar|quero fazer|quero sim|quero ativar|pode ativar|teste|proximo passo|vamos|tenho interesse|bora|topo|topa|fechado|fechou|manda|to dentro|vou querer` (accents already stripped by `normalizeText`).
12. `detectSmallTalk` → `small_talk` (futebol, piada).
13. `matchFaq` → `pergunta_faq`.
14. Default → `fora_escopo`.

Second gate inside `WhatsappSalesAgent.generateReply` (symmetric guard, QTR-35 P1-4b / ADR-0001): the LLM can never place a lead in `sem_interesse` on its own. If OpenAI returns `sem_interesse` and the message is not `isExplicitLossMessage`, the classification is downgraded — with `detectPain` → `pergunta_funcionamento`; otherwise the deterministic classification (`fora_escopo`) stands and the reply follows the fallback flow, never a goodbye copy. Terminal state (`perdido`) remains exclusive to the explicit-loss regex.

## Loop escalation (ciclo 4)

- `memory.consecutive_fallback` counts `fora_escopo` + `social_test` in sequence. Any other intent resets to 0.
- The 5-item pool `FALLBACK_VARIATIONS` rotates based on that counter (avoids repeating the same copy twice in a row).
- When the counter reaches **7**, the next fallback triggers an **automatic handoff** to the commercial WhatsApp with `handoffReason = "fallback_loop"`.
- **Level 2 slot → interactive buttons (CV3).** At the menu slot of the rotation (`FALLBACK_VARIATIONS[1]`) the reply carries `interactiveButtons` instead of text: the webhook sends Cloud API reply buttons (max 3: "Como funciona", "Quanto custa", "Quero testar"). The `button_reply.id` maps deterministically to a canonical message (`lib/whatsapp/sales-buttons.ts`) → the right intent, **no LLM**. Deterministic sub-path: it does **not** mark `respond` and does not change the counter. Degrades to the text menu when the transport lacks button support.

## Fora_escopo general case is a free lane (CV2, ADR-0024)

- Only the **general case** of `fora_escopo` (the `FALLBACK_VARIATIONS` rotation) returns `conversationalGenerationMode: "respond"` in the `AgentReply`: the generation layer answers the lead's message grounded in `buildSalesKnowledge` (PRODUCT_FACTS + SALES_FACTS + filtered FAQ + handoff link) and the pool copy is the fallback (`dontKnow`/error/veto → pool copy; `dontKnow` also records `perguntas_sem_resposta`).
- Sub-paths stay deterministic (no `respond`): subsequent greeting, first appearance (explainer), lead already `interessado`, and the automatic handoff at >= 7.
- **The counter never reacts to generation** — it increments even when the generated answer was good. `off`/`sombra`/`on` may only differ in the text sent, never in state (kill-switch reversibility). Never reset it from an LLM signal.
- Price never enters this lane: `pergunta_preco` is its own deterministic intent (0.92) and price FAQs are filtered from the knowledge.

## Subsequent greeting (ciclo 4)

When `memory.greeted === true` and the lead sends another greeting ("bom dia", "tudo bem?"), the bot replies with one of **5 social variations** (pool `GREETING_AFTER_GREETED`), not the explainer again. Does NOT count as fallback.

## OpenAI classifier system prompt

The classifier must be told explicitly:

- `small_talk` is ONLY for off-topic chatter (futebol, piada). NEVER for greetings or short empty messages.
- Greetings ("oi", "ola", "bom dia") → `fora_escopo` (backend handles with dedicated greeting).
- Short acks ("ok", "blz", "entendi") → `confirmacao_neutra`.
- Hesitation ("vou pensar", "depois te falo") → `vai_pensar`.
- Human request ("passa pro Anderson") → `quer_humano`.
- Bot identity ("quem e voce", "voce e IA") → `pergunta_faq` (dedicated FAQ).

## Greeting on first turn (QTR-35 P1-6)

When `context.sales.greeted !== true`, **every** first reply of the conversation gets prefixed with:

> *"Fala chefe! Aqui e do Quando Trocar — a gente faz seu cliente voltar pra proxima troca de qualquer peca ou servico automotivo: oleo, amortecedor, filtro, revisao, alinhamento, freio..."*

This is centralized in `ensureGreeting`, applied once at the single exit point of `generateReply` — FAQ, price, small talk, volume, handoff and registration-hook replies all included (the previous behavior only greeted the explainer intents, so a FAQ-first conversation started with a naked FAQ answer). The prefix also mirrors into `interactiveButtons.bodyText`. Persisted via `memory.greeted = true`. In the webhook, when the deterministic reply carries the brand ("Quando Trocar"), it is added to `requiredLiterals` so the CV1 rewrite can never drop the presentation.

## Forced handoff signals

These set `handoffRequired = true` (marks `conversas.handoff_required`), reply contains a `wa.me` link to commercial number, and **status is not changed**:

- `pergunta_preco` with `sales.price_mentions >= 1` → reason `preco_insistente`.
- `detectScaleHandoff` (mensagem cita rede/franquia/matriz/filial) → reason `rede_ou_franquia`.
- `informa_volume_ticket` with `volume > 300/mês` → reason `volume_alto`.

On any of these (CV3), when `geracao_llm_modo != 'off'`, the backend also generates a 3-line **handoff summary** (internal, LLM) and sends it to the commercial WhatsApp — best-effort, never blocks the handoff. See `lib/whatsapp/handoff-summary.ts` and `regras-de-negocio.md §1.5`.

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

- **"Oi"** → greeting prefix + explainer + CTA for 14-day trial (NOT small_talk).
- **"Ok" / "blz"** (after explainer) → short ack "Beleza chefe, tô por aqui"; (before explainer) → falls into the regular flow with greeting + explainer.
- **"Vou pensar com o sócio"** → "Tranquilo chefe, sem pressa…" (status unchanged, no handoff).
- **"Passa pro Anderson"** → handoff `pedido_humano` with `wa.me` link.
- **"Quem é você?"** → FAQ "Sou o assistente do Quando Trocar…".
- **"Pra que time você torce?"** → `small_talk` (only off-topic now).
- "Fala" (first turn) → greeting prefix + explainer + CTA for 14-day trial.
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
