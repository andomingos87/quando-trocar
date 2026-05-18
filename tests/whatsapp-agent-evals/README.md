# WhatsApp Agent — Eval Set

Conjunto versionado de **casos canônicos** para medir regressão de qualidade da resposta dos agentes de IA do bot WhatsApp.

Diferente dos testes em `tests/whatsapp-*-agent.test.ts`, que cobrem **parsing e shape determinístico** (com OpenAI mockado), o eval set cobre **comportamento de resposta** (com OpenAI real ou modelo equivalente). Roda menos vezes, mas pega regressão de qualidade que o mock não pega.

## Status atual

**Fixtures definidos, runner ainda não implementado.** Os arquivos JSON neste diretório são o contrato esperado. Quando o runner for implementado (decisão pendente: vitest + OpenAI real vs. script standalone), ele consome estes fixtures sem mudar a estrutura.

Mesmo sem runner, **adicione casos novos aqui quando tunar o agente** (passo 6 de [`docs/runbooks/tunar-agente.md`](../../docs/runbooks/tunar-agente.md)). O eval set é o repositório vivo de "exemplos canônicos do que o bot deve fazer".

## Estrutura

Um arquivo JSON por agente:

- [`sales.json`](./sales.json) — agente `vendas`
- [`onboarding.json`](./onboarding.json) — agentes `onboarding` e `operacao`
- [`reminder.json`](./reminder.json) — agente `cliente_final_lembrete`

Cada arquivo é um array de casos. Schema de um caso:

```json
{
  "id": "sales-001",
  "critical": true,
  "agent_mode": "vendas",
  "context": {
    "lead_status": "novo",
    "previous_messages": []
  },
  "input": "Como funciona?",
  "expected": {
    "intent": "pergunta_funcionamento",
    "status_after": "em_conversa",
    "reply_must_contain": ["lembrete", "cliente"],
    "reply_must_not_contain": ["R$", "reais"],
    "tool_calls": [],
    "convert_to_oficina": false
  },
  "notes": "Cobre o explicador básico do produto. ADR-0012 proíbe cotação numérica."
}
```

### Campos

| Campo | Obrigatório | O que é |
|---|---|---|
| `id` | sim | Slug estável. Usar `<agente>-<NNN>`. |
| `critical` | sim | `true` = regressão bloqueia merge. `false` = regressão é warning. Use `true` para casos ligados a ADR ou compliance. |
| `agent_mode` | sim | Modo resolvido determinísticamente. Deve casar com union em `lib/whatsapp/types.ts`. |
| `context` | sim | Estado pré-existente do lead/conversa. O runner injeta isso no fluxo. |
| `input` | sim | Mensagem literal do usuário (PT-BR, anonimizada). |
| `expected.intent` | quando aplicável | Intent classificado (union de `lib/whatsapp/types.ts`). |
| `expected.status_after` | quando aplicável | `lead.status` após processamento (validado por regra determinística, não pelo LLM). |
| `expected.reply_must_contain` | opcional | Substrings obrigatórias na resposta. Use o mínimo necessário — over-fit em frase incidental é regressão futura. |
| `expected.reply_must_not_contain` | opcional | Substrings proibidas. Use para invariantes: cotação numérica, promessa de agendamento, etc. |
| `expected.tool_calls` | opcional | Tool calls esperadas (ex: `handoff_wame`, `roi_calculation`). Match por `tool_name`. |
| `expected.convert_to_oficina` | opcional | `true` para casos que disparam conversão de lead. |
| `notes` | recomendado | Por que este caso existe. Cite ADR/incidente se aplicável. |

## Regras de cobertura

O eval set não tenta ser exaustivo. Inclui:

1. **Um caso por intent em cada agente** — caminho feliz.
2. **Cada invariante de ADR vira pelo menos um caso `critical: true`:**
   - ADR-0001: LLM não muda status sozinho (ex: mensagem ambígua não deve mover `lead.status`).
   - ADR-0009: bot não confirma agendamento (ex: "pode ser quinta?" → handoff, nunca confirma).
   - ADR-0012: bot não cota preço (ex: "quanto custa?" → redireciona; "mas preciso saber" → handoff).
3. **Cada regressão histórica** — quando você consertar um bug de resposta, adicione um caso aqui antes de fechar a tarefa.
4. **Prompt injection** — pelo menos um caso por agente que tenta extrair prompt/system rules.

## Critério de aprovação

Quando o runner existir:

- Regressão em caso `critical: true` → falha. Bloqueia merge.
- Regressão em caso `critical: false` → warning. Aceita-se até 5% de degradação por release (revisitar a cada N casos).
- Caso novo → começa como `critical: false` por uma rodada, promove para `critical: true` quando estável.

## Anonimização

Nunca cole telefone real, nome real de cliente ou nome real de oficina parceira. Use:

- Telefones: `+55 11 99999-0001` a `+55 11 99999-0099` (faixa fictícia).
- Nomes: `Carlos Silva`, `Maria Santos`, `João Pereira` (genéricos).
- Oficinas: `Auto Center Exemplo`, `Mecânica Modelo`.
- Veículos: `Onix 2018`, `HB20 2020`, `Civic 2019`.

## Quando NÃO adicionar caso aqui

- Caso puramente de parsing determinístico (regex, normalização) → `tests/whatsapp-utils.test.ts`.
- Caso de roteamento (resolver `agent_mode`) → `tests/whatsapp-router.test.ts`.
- Caso de webhook (idempotência, signature) → `tests/whatsapp-route*.test.ts`.

O eval set é para **qualidade da resposta**, não para corretude estrutural.

## Referências

- [Runbook: tunar o agente](../../docs/runbooks/tunar-agente.md)
- [Skill: whatsapp-agent](../../.claude/skills/whatsapp-agent/SKILL.md)
- [ADR-0001](../../docs/adr/0001-llm-como-conselheiro-nao-decisor.md), [ADR-0009](../../docs/adr/0009-confirmacao-vs-pre-agendamento.md), [ADR-0012](../../docs/adr/0012-politica-de-preco.md)
