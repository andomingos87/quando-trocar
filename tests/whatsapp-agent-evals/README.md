# WhatsApp Agent — Eval Set

Conjunto versionado de **casos canônicos** para medir regressão de qualidade da resposta dos agentes de IA do bot WhatsApp.

Diferente dos testes em `tests/whatsapp-*-agent.test.ts`, que cobrem **parsing e shape determinístico** (com OpenAI mockado), o eval set cobre **comportamento de resposta**, rodando pelo caminho real do webhook. Roda menos vezes, mas pega regressão que o mock não pega.

## Como rodar

```bash
npm run eval:whatsapp                          # todos, modo determinístico
npm run eval:whatsapp -- --agente vendas       # vendas | onboarding | lembrete
npm run eval:whatsapp -- --caso sales-003 --verbose
npm run eval:whatsapp -- --openai real         # com LLM (custa, não-determinístico)
npm run eval:whatsapp -- --json relatorio.json # para diffar entre execuções
```

O runner (`scripts/whatsapp/eval.ts`) roda cada caso pelo **webhook completo** via harness (`tests/harness/whatsapp/`): repositório em memória, sender que só grava, nenhuma chamada à Meta ou ao Supabase. Isso é proposital — o texto que o cliente lê não é `reply.body`: entre o agente e o envio passam a camada de geração, o validador com poder de veto, o split de mensagem e o caminho de botões. E `status`, conversão e cadastro são decididos no webhook, não no agente (ADR-0001).

**Fora do `npm test` de propósito.** Com `--openai real` o runner gasta OpenAI e é não-determinístico; um `npm test` caro e piscante ensina o time a ignorar vermelho.

## Estrutura

Um arquivo JSON por agente: [`sales.json`](./sales.json) (`vendas`), [`onboarding.json`](./onboarding.json) (`onboarding` e `operacao`), [`reminder.json`](./reminder.json) (`cliente_final_lembrete`).

O formato é tipado em [`schema.ts`](./schema.ts) — essa é a fonte da verdade; esta seção é o resumo legível. Fixture malformado falha na carga, com o `id`, antes de gastar LLM.

```json
{
  "id": "sales-004",
  "critical": true,
  "status": "active",
  "agent_mode": "vendas",
  "context": {
    "lead_status": "em_conversa",
    "previous_messages": ["Quanto custa?"]
  },
  "input": "Mas preciso saber o preço antes de testar",
  "expected": {
    "intent": "pergunta_preco",
    "status_after": "em_conversa",
    "reply_must_contain": ["wa.me"],
    "signals": { "handoff_required": true },
    "tool_calls": []
  },
  "notes": "Por que este caso existe. Cite ADR/incidente."
}
```

### Campos

| Campo | Obrigatório | O que é |
|---|---|---|
| `id` | sim | Slug estável, `<agente>-<NNN>`. |
| `critical` | sim | `true` = regressão bloqueia. `false` = warning. |
| `status` | sim | `active` \| `quarantine` \| `pending_decision` — ver abaixo. |
| `agent_mode` | sim | Modo esperado. Casa com o union em `lib/whatsapp/types.ts`. |
| `context` | sim | Estado inicial + histórico. Ver **Replay vs seed**. |
| `input` | sim | Mensagem literal do usuário (PT-BR, anonimizada). |
| `source_media_type` | não | `text` (default), `audio`, `image`, `document`. Em `audio`, `input` É a transcrição. |
| `today` | não | Data de referência (`YYYY-MM-DD`) para data relativa. |
| `requires_llm` | não | O caso só é julgável com `--openai real`. Em modo determinístico o runner **pula** em vez de reprovar. |
| `notes` | recomendado | Por que o caso existe. **Obrigatório** quando `status` não é `active`. |

### `expected`

| Campo | O que valida | De onde sai |
|---|---|---|
| `intent` | Intent aplicado | `AgentReply.intent` / `ReminderAgentReply.intent` |
| `status_after` | `lead.status` após o turno | estado do repositório |
| `lembrete_status_after` | status do lembrete | estado do repositório |
| `reply_must_contain` / `reply_must_not_contain` | substrings no texto entregue (ignora acento e caixa) | mensagens que o sender recebeu |
| `delivered_contains` | substring literal (sem normalizar) — use para número em link | idem |
| `tool_calls` | `[{ tool_name, input_contains? }]` | `agent_tool_calls` |
| `signals` | o que **não** é tool call: `handoff_required`, `cliente_status`, `should_cancel_future_reminders`, `register_service_called` | reply do agente + estado |
| `convert_to_oficina` | conversão de lead | `AgentReply.convertToOficina` |
| `service_draft` | match **parcial** do rascunho | `conversas.context.service_draft` |
| `register_service_input` | match parcial (`null` = não gravou) | `OnboardingAgentReply.registerServiceInput` |

Use o mínimo necessário em `reply_must_contain` — over-fit em frase incidental é regressão futura. (`sales-001` já quebrou por exigir a palavra literal "lembrete" numa copy que comunica o conceito com outras palavras.)

**`signals` não é açúcar sintático.** `handoff_wame`, `mark_opt_out` e `mark_numero_errado` nunca existiram como tool call — modelá-los assim era erro de contrato. O handoff é `AgentReply.handoffRequired`; o opt-out é `clienteStatus` + `shouldCancelFutureReminders`, aplicados pelo webhook.

**snake_case no fixture, camelCase no código.** `register_service_input` é escrito em snake_case; o runner converte por um mapa único (`REGISTER_SERVICE_FIELD_MAP`).

## Replay vs seed

`previous_messages` é **replay**: cada turno do usuário é enviado de verdade pelo webhook, na ordem, antes do turno julgado. O estado acumula sozinho — `sales-004` só reproduz o handoff porque o turno "Quanto custa?" realmente incrementou `sales.price_mentions`. Nada de semear contador à mão.

Um item pode ser `"texto"` (fala do usuário) ou `{ "role": "user" | "bot", "text": "..." }`. Fala do bot é documental e **não** é reenviada.

`context.lead_status` é o estado **antes** do primeiro turno de replay, não no momento do turno julgado.

Quando o replay não alcança o estado (rascunho específico, lembrete pré-existente):

- **`context.seed`** — `Partial<ConversationContext>`: `service_draft`, `missing_field`, `awaiting_confirmation`, `sales`.
- **`context.world`** — linhas de banco: `lembrete_id`, `veiculo`, `whatsapp_atendente`, `whatsapp_principal`, `oficina_nome`. **Não** é `ConversationContext` (que só tem `lastReminderId`); antes esses campos ficavam soltos no `context` fingindo ser contexto de conversa.

Replay é o default. Todo `seed` novo exige justificativa em `notes`.

## Status e critério de aprovação

- **`active`** — julgado normalmente. Regressão em `critical: true` → exit 1.
- **`quarantine`** — comportamento descrito em docs e **não implementado**. Reportado, não bloqueia.
- **`pending_decision`** — fixture e código discordam e a decisão é do dono. Reportado, não bloqueia. `notes` precisa dizer o que está bloqueando.

**Se um caso `quarantine` ou `pending_decision` PASSA, o runner falha com `STALE_QUARANTINE`.** Isso força o caso a voltar para `active` no commit que consertar o comportamento — sem isso, quarentena é sinônimo de "deletado com passos extras".

Caso novo entra como `critical: false` por uma rodada e é promovido quando estável.

### Decisões abertas hoje

| Casos | Bloqueio |
|---|---|
| `sales-002`, `sales-003` | ADR-0012 diz que o bot não cita valor numérico; `docs/regras-de-negocio.md:188` diz que ele fala "a partir de R$ X"; o código faz o segundo. Resolver a contradição. |
| `rem-001b`, `rem-007` | `lembrete_status_after: "handoff_iniciado"` não existe no union e o agente de lembrete não monta link `wa.me`. Implementar ou corrigir a doc. |
| `rem-003b` | `OPT_OUT_PATTERNS` não cobre "Para de me mandar mensagem" — opt-out passa a depender do LLM, o que tensiona a ADR-0001 e é caminho LGPD. |

## Regras de cobertura

Não tenta ser exaustivo. Inclui:

1. Um caso por intent em cada agente — caminho feliz.
2. Cada invariante de ADR vira pelo menos um `critical: true`: ADR-0001 (LLM não muda status), ADR-0009 (não confirma agendamento), ADR-0012 (política de preço), ADR-0017 (confirmação antes de gravar).
3. Cada regressão histórica — conserte o bug, adicione o caso antes de fechar a tarefa.
4. Prompt injection — pelo menos um por agente.

## Anonimização

Nunca cole telefone real, nome real de cliente ou de oficina parceira. Telefones: `+55 11 99999-0001` a `+55 11 99999-0099`. Nomes: `Carlos Silva`, `Maria Santos`, `João Pereira`. Oficinas: `Auto Center Exemplo`, `Mecânica Modelo`. Veículos: `Onix 2018`, `HB20 2020`, `Civic 2019`.

## Quando NÃO adicionar caso aqui

- Parsing determinístico (regex, normalização) → `tests/whatsapp-utils.test.ts`.
- Roteamento (`agent_mode`) → `tests/whatsapp-router.test.ts`.
- Webhook (idempotência, assinatura) → `tests/whatsapp-route*.test.ts`.

## Referências

- [Runbook: tunar o agente](../../docs/runbooks/tunar-agente.md) · [Harness](../harness/whatsapp/index.ts) · [Skill whatsapp-agent](../../.claude/skills/whatsapp-agent/SKILL.md)
- [ADR-0001](../../docs/adr/0001-llm-como-conselheiro-nao-decisor.md), [ADR-0009](../../docs/adr/0009-confirmacao-vs-pre-agendamento.md), [ADR-0012](../../docs/adr/0012-politica-de-preco.md), [ADR-0017](../../docs/adr/0017-confirmacao-antes-de-registrar-troca.md)
