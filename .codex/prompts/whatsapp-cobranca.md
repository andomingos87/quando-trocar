# WhatsApp Cobranca Agent Prompt

Use este prompt ao implementar ou evoluir o cobranca-agent (`agent_mode='cobranca'`).

## Goal

Conversar com oficinas pausadas — por inadimplência ou por pausa voluntária (winback) — de forma reativa: a oficina manda mensagem, o agente classifica a intenção e responde com dados factuais (valor, vencimento, link MP) ou escala para humano. Nunca toma decisão comercial nem altera estado de billing.

## Entry/Exit

- **Entrada**: webhook detecta `oficinas.status='pausada'` para a oficina-cliente e:
  - `motivo_pausa='inadimplencia'` → submode `cobranca_inadimplente`
  - `motivo_pausa='voluntaria'` → submode `cobranca_winback`
  - `motivo_pausa='admin'` ou conversa não é oficina-cliente → **não entra em cobrança**, responde mensagem fixa e termina (sem agente).
- **Saída**: quando `oficinas.status='ativa'` (reativação via webhook MP), a próxima mensagem volta naturalmente pro modo `operacao` / `onboarding` resolvido pelo router. O `agent_mode='cobranca'` é um **override de runtime no webhook**, não é persistido em `conversas.agent_mode`.

## Submodes

### `cobranca_inadimplente`
Foco em pagamento. Reusa `mp_preference_id` do pagamento `status='pendente'` mais recente. Agente nunca gera link novo.

### `cobranca_winback`
Foco em entender por que pausou e oferecer ponte com humano para reativar. Sem link, sem oferta comercial.

## Intents (closed set)

- `pediu_link` — pediu o link de pagamento. Responde com link MP se disponível, senão handoff.
- `vai_pagar` — disse que vai pagar agora/hoje. Mesma resposta de pediu_link.
- `ja_paguei` — afirma já ter pago. **Sempre handoff** (humano verifica e reativa).
- `negocia_prazo` — pede prazo, parcelamento, desconto. **Sempre handoff**, sem exceção.
- `quer_voltar` — winback: quer reativar. Handoff para humano conduzir.
- `nao_quer_voltar` — winback: não tem interesse em voltar. Resposta cordial, sem handoff.
- `disputa` — tom hostil, contesta a cobrança. Handoff.
- `outro` — ambíguo ou genérico. Reply varia por submode (inadimplente: manda valor+link; winback: pergunta o que faltou).

## MP link format

```
https://www.mercadopago.com.br/checkout/v1/redirect?pref_id={mp_preference_id}
```

Mesmo padrão usado em `app/api/admin/pagamentos/[id]/reenviar/route.ts`.

## Required Behavior

- Determinístico primeiro: padrões em `cobranca-agent.ts` cobrem os casos comuns (link, negociação, ja_paguei, disputa).
- Fallback OpenAI (`gpt-4o-mini`, structured output) só quando confidence determinística < 0.85.
- Persistir `tool_calls` no padrão dos outros agentes. `markConversationHandoff` quando `handoffRequired=true`.

## Safety Rules

- **Nunca prometer prazo**. "Posso pagar dia 25?" → handoff. Sem "ok, pode pagar dia 25".
- **Nunca prometer desconto, parcelamento ou condição comercial**.
- **Nunca gerar link de pagamento novo**. Só reusa `mp_preference_id` do banco.
- **Nunca mudar `oficinas.status`, `oficinas.motivo_pausa` ou qualquer campo de `pagamentos`**. Reativação acontece via webhook do MP (`app/api/webhooks/mercado-pago/route.ts`).
- **Nunca prometer reativar acesso**. Mesmo em "já paguei" o agente apenas escala.
- **Nunca confirmar valor/vencimento de cabeça** — só lê do banco via `getLatestPendingPagamento`.
- Se `mp_preference_id` estiver ausente quando o cliente pediu link → handoff "link_indisponivel" (humano gera).

## Test Ideas

### Submode `cobranca_inadimplente`

- `"me manda o link"` com `pendingPayment` válido → resposta tem `mp_preference_id`, sem handoff.
- `"manda o link"` sem `pendingPayment` → handoff `link_indisponivel`.
- `"posso pagar dia 25?"` → intent `negocia_prazo` + handoff.
- `"já paguei ontem"` → intent `ja_paguei` + handoff `verificar_pagamento`.
- `"por que vocês me pausaram?"` → intent `disputa` + handoff.
- `"oi"` (ambíguo) → resposta com link + valor + vencimento, sem handoff.

### Submode `cobranca_winback`

- `"oi"` → mensagem curiosa, sem link, sem handoff.
- `"quero voltar a usar"` → intent `quer_voltar` + handoff `reativacao_voluntaria`.
- `"não tenho mais interesse"` → intent `nao_quer_voltar`, resposta cordial, sem handoff.
- `"dá pra negociar?"` → handoff (negociação).
