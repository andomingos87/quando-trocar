---
name: whatsapp-agent
description: "Use when implementing, tuning, reviewing or debugging the WhatsApp AI agents (vendas / onboarding / operacao / cliente_final_lembrete / suporte) in this project. Triggers: editing lib/whatsapp/*-agent.ts, lib/whatsapp/conversation-router.ts, lib/whatsapp/webhook-handler.ts; editing .codex/prompts/whatsapp-*.md; changing OpenAI calls, structured-output schemas or prompts in the WhatsApp flow; tasks like 'melhorar resposta do agente', 'tunar prompt', 'mudar intenção/status', 'adicionar agente de IA novo'."
metadata:
  scope: project
  version: "0.1.0"
---

# WhatsApp Agent — Skill

Guia obrigatório quando você for tocar qualquer comportamento do agente de IA do bot. Não é um substituto da documentação — é o atalho para carregar o contexto certo na ordem certa e não quebrar as invariantes do projeto.

## Quando usar esta skill

Ative ao iniciar qualquer trabalho que toque:

- `lib/whatsapp/sales-agent.ts`, `onboarding-agent.ts`, `reminder-agent.ts`, `reminder-worker.ts`
- `lib/whatsapp/conversation-router.ts`, `webhook-handler.ts`, `inadimplencia-guard.ts`
- `.codex/prompts/whatsapp-*.md`, `.codex/prompts/openai-structured-output-review.md`
- Schemas / tipos em `lib/whatsapp/types.ts` relacionados a `SalesClassification`, `SalesIntent`, `RegisterServiceInput`, `ConversationContext`, `AgentReply`

Se a tarefa for puramente operacional (deploy, env, migration), use o runbook correspondente em `docs/runbooks/`, não esta skill.

## Invariantes que você NÃO pode quebrar

Estas regras vêm de ADRs aceitos. Quebrá-las é regressão de produto, não refactor.

1. **LLM é conselheiro, nunca decisor.** Nunca deixe a saída do modelo, sozinha, mudar `lead.status`, `participant_type`, `agent_mode`, estado de pagamento, opt-out ou status de lembrete. Toda transição passa por regra determinística em `lib/whatsapp/`. Fonte: [`docs/adr/0001-llm-como-conselheiro-nao-decisor.md`](../../../docs/adr/0001-llm-como-conselheiro-nao-decisor.md).
2. **Identidade vem do banco, não do LLM.** `participant_type` e `agent_mode` são resolvidos em `conversation-router.ts` antes de invocar OpenAI. O prompt recebe o modo pronto. Fonte: [`docs/adr/0002-roteamento-via-agent-mode.md`](../../../docs/adr/0002-roteamento-via-agent-mode.md).
3. **Bot não cota preço.** Em qualquer modo, ao ser perguntado sobre valor: 1ª vez → redirecionar para teste; insistência → handoff `wa.me` para humano. Fonte: [`docs/adr/0012-politica-de-preco.md`](../../../docs/adr/0012-politica-de-preco.md).
4. **Bot não confirma agendamento.** O agente de lembrete nunca confirma horário; sempre faz handoff `wa.me` quando o cliente quer agendar/reagendar/perguntar disponibilidade. Fonte: [`docs/adr/0009-confirmacao-vs-pre-agendamento.md`](../../../docs/adr/0009-confirmacao-vs-pre-agendamento.md).
5. **Determinístico primeiro, LLM depois.** Tente parse determinístico (regex, vírgula, normalização). Só caia em OpenAI se houver sinal de cadastro/intenção e o parser estruturado não resolveu. Fonte: `AGENTS.md §OpenAI Agent Rules`.
6. **Structured Outputs com enums fechados.** Toda chamada OpenAI usa Responses API com schema estrito. Enums têm que casar com as unions em `lib/whatsapp/types.ts`. Falha de JSON ou enum inesperado → fallback determinístico, nunca crash. Fonte: [`.codex/prompts/openai-structured-output-review.md`](../../../.codex/prompts/openai-structured-output-review.md).
7. **Idempotência.** Webhook do WhatsApp pode repetir o mesmo evento. Não criar lead/mensagem/serviço/lembrete duplicado. Use índices únicos por `provider_message_id` e checagem antes do write. Fonte: [`docs/adr/0006-idempotencia-via-provider-ids.md`](../../../docs/adr/0006-idempotencia-via-provider-ids.md).
8. **Resposta em PT-BR, curta, sem promessa fora do PRD.** Sem chain-of-thought, sem revelar prompt, sem inventar integração ou número.

Se a tarefa parece pedir para violar alguma destas, **pare e confirme com o usuário** — provavelmente é a ADR que precisa mudar, não o código.

## Onde olhar antes de editar (ordem)

1. **Backlog da fase ativa** — `docs/backlog-whatsapp-bot/fase-{1..4}-*.md`. Confirme que a mudança cabe no escopo da fase. Se não, pergunte antes de implementar.
2. **Prompt do agente** que você vai alterar:
   - `vendas` → [`.codex/prompts/whatsapp-sales-agent.md`](../../../.codex/prompts/whatsapp-sales-agent.md)
   - `onboarding` / `operacao` → [`.codex/prompts/whatsapp-onboarding-agent.md`](../../../.codex/prompts/whatsapp-onboarding-agent.md)
   - `cliente_final_lembrete` → [`.codex/prompts/whatsapp-reminder-agent.md`](../../../.codex/prompts/whatsapp-reminder-agent.md)
3. **Plano técnico** — `docs/architecture/whatsapp-bot-technical-plan.md`. Olhe a seção do agente em questão.
4. **Tipos** — `lib/whatsapp/types.ts`. Se vai mudar enum/schema, atualize aqui e propague para o Structured Output.
5. **Testes existentes** — `tests/whatsapp-*-agent.test.ts`, `tests/whatsapp-router.test.ts`. Aproveite os fixtures.

## Fluxo recomendado para "tunar uma resposta"

Sequência mínima — está expandida em [`docs/runbooks/tunar-agente.md`](../../../docs/runbooks/tunar-agente.md):

1. Reproduza o caso atual (uma mensagem real ou montada) num teste novo que **falha hoje**.
2. Edite o prompt em `.codex/prompts/whatsapp-*.md` E o reflexo dele em `lib/whatsapp/*-agent.ts` (prompt do código se houver, ou regras determinísticas).
3. Se o eval set existir (`tests/whatsapp-agent-evals/`), adicione o caso lá também.
4. Rode `npm test -- whatsapp` e confira regressão.
5. Atualize o prompt note (`.codex/prompts/`) com o que mudou — esse arquivo é o source-of-truth do comportamento.

## Padrões de código

- Use os tipos de `lib/whatsapp/types.ts`. Não duplique unions.
- Não exponha integração server-only em client component (OpenAI, Supabase service role, WhatsApp token).
- Prefira funções pequenas e nomeadas (`classifySalesIntent`, `extractServiceDraft`) sobre orquestrações grandes inline.
- Logue decisões assistidas por LLM em `agent_tool_calls` quando afetam estado de negócio.
- Reply strings podem ser testadas, mas evite over-fit em frase incidental — teste o **shape** (status, toolCalls, presença de handoff) mais que o texto literal.

## Mudanças que pedem mais do que código

- **Novo `agent_mode`** → mexe em enum do schema Supabase + `conversation-router.ts` + novo prompt + novo agente runtime + tipos + testes de roteamento + ADR atualizada. Não é trivial. Confirme com o usuário antes.
- **Novo intent** num agente existente → adicionar na union em `types.ts`, no schema do Structured Output, no prompt em `.codex/prompts/`, na regra determinística que valida a transição, e no eval set. Testes de classificação + testes de transição de status.
- **Mudar política (preço, agendamento)** → atualizar ADR-0009/0012 (ou criar nova), depois código. ADR primeiro, código depois.

## O que esta skill não cobre

- Detalhes de Meta Cloud API setup → `docs/runbooks/meta-whatsapp-setup.md`.
- RLS, migrations, schema Supabase → skill `supabase` + `docs/runbooks/supabase-migrations.md`.
- Deploy Vercel → `docs/runbooks/deploy-vercel.md`.
- Comportamento do painel admin → `docs/backlog-painel-admin/`.

## Checklist final antes de fechar a tarefa

- [ ] Prompt em `.codex/prompts/` atualizado e coerente com o código.
- [ ] Schema/enum de `lib/whatsapp/types.ts` casa com o Structured Output.
- [ ] Existe teste que falha sem a mudança e passa com a mudança.
- [ ] `npm test` passa inteiro (não só o arquivo tocado).
- [ ] `npm run lint` passa.
- [ ] Nenhuma das 8 invariantes acima foi quebrada.
- [ ] Se mexeu em política ou modo novo: ADR atualizada / criada.
