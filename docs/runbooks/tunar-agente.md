# Runbook · Tunar o agente de IA sem quebrar testes

## Quando usar

Você quer mudar **como o bot responde**: ajustar tom, corrigir intenção que classifica errado, refinar quando faz handoff, melhorar o prompt de extração de dados de serviço, ou adicionar um caso novo de mensagem que hoje cai mal.

Este runbook **não** é para:
- Adicionar um novo `agent_mode` (mudança estrutural — abra ADR primeiro).
- Mudar política de preço ou de agendamento (atualize ADR-0009 / ADR-0012 antes).
- Mexer em RLS, migration, env (use os runbooks específicos).

## O que você vai precisar antes de começar

- `npm install` rodado.
- `.env.local` configurado com `OPENAI_API_KEY` (necessário se for rodar eval que chama OpenAI real).
- Ter lido o prompt do agente que vai mexer:
  - `.codex/prompts/whatsapp-sales-agent.md`
  - `.codex/prompts/whatsapp-onboarding-agent.md`
  - `.codex/prompts/whatsapp-reminder-agent.md`
- Ter na mão a **mensagem real** (ou montada) que motivou a mudança.

## Princípio que rege este runbook

**Toda mudança de comportamento do agente começa com um teste que falha.** Sem teste, você está adivinhando, e a próxima iteração vai regredir o que você acabou de "consertar". Veja [`docs/adr/0001-llm-como-conselheiro-nao-decisor.md`](../adr/0001-llm-como-conselheiro-nao-decisor.md) para o porquê.

## Passos

### 1. Capture o caso atual

Identifique exatamente:

- Mensagem de entrada (texto literal que o usuário mandou).
- Modo do agente (`vendas`, `onboarding`, `operacao`, `cliente_final_lembrete`).
- Resposta atual (o que o bot está respondendo hoje).
- Resposta esperada (qual seria a resposta correta).

Se o caso veio de WhatsApp real, anonimize: troque nome, telefone, marca de carro por exemplos genéricos. Não cole telefone real em teste/eval set.

### 2. Escreva o teste que falha

Em `tests/whatsapp-<agente>-agent.test.ts`, adicione um caso novo. Não invente fixture inteira — copie a vizinha e edite o input/output esperado.

```ts
it("não cota preço quando lead pergunta valor de forma indireta", async () => {
  const reply = await runSalesAgent({
    message: "tem ideia de quanto sai por mes?",
    leadStatus: "em_conversa",
  });

  expect(reply.body).not.toMatch(/R\$|reais|\d+,\d{2}/);
  expect(reply.toolCalls).toEqual([]);
  expect(reply.body).toContain("teste"); // redireciona para o trial
});
```

Rode focado:

```bash
npm test -- whatsapp-sales-agent
```

Confirme que **falha pelo motivo certo** (não por `undefined`, não por erro de import). Se falha por outro motivo, conserte o teste antes de mexer no agente.

### 3. Decida onde mudar

| Sintoma | Onde provavelmente mexer |
|---|---|
| Classificação errada de intenção | regras determinísticas em `lib/whatsapp/sales-agent.ts` (regex / `isExplicitLossMessage` etc.) E/OU enum do Structured Output + prompt |
| Resposta certa, frase ruim | string no agente runtime (`lib/whatsapp/*-agent.ts`) E prompt em `.codex/prompts/` |
| Modelo extrai campo errado | schema do Structured Output em `lib/whatsapp/*-agent.ts` + descrição no prompt |
| Handoff disparando em hora errada | mapeamento intent → action em `reminder-agent.ts` |
| Bot cota preço acidentalmente | regra determinística de detecção de pergunta de preço + prompt §Pricing rule |

Regra: **sempre tente determinístico primeiro**. Só caia em prompt-tuning se o caso depender de interpretação livre.

### 4. Faça a mudança

Edite em paralelo:

1. `lib/whatsapp/<agente>-agent.ts` — código (regras, schema, fallback).
2. `.codex/prompts/whatsapp-<agente>.md` — descreve o comportamento esperado em PT-BR. **Este arquivo é o source-of-truth narrativo.** Se alguém ler o prompt e ele divergir do código, o prompt está mentindo.
3. `lib/whatsapp/types.ts` — se adicionou intent/campo novo no enum.

Sempre PT-BR nas respostas. Curtas. Sem promessa fora do PRD.

### 5. Rode a bateria de testes do bot

```bash
npm test -- whatsapp
```

Se algum teste antigo passou a falhar:

- **Era um teste que cobria comportamento que mudou intencionalmente?** Atualize o expected do teste e registre no `docs/CONTEXT_CHANGELOG.md` que a frase canônica X agora é Y.
- **Era teste que cobria comportamento que deveria continuar valendo?** Você quebrou regressão — volte e ajuste sem quebrar.

### 6. Rode o eval set (se existir)

Se `tests/whatsapp-agent-evals/` estiver implementado:

```bash
npm run eval:whatsapp   # ou conforme estiver configurado
```

O eval set roda casos canônicos contra o agente real (com OpenAI). Falha aceitável: < 5% de regressão. Falha bloqueante: regressão em caso marcado `critical: true` no fixture.

Se ainda não existe runner: **adicione seu caso ao fixture JSON** em `tests/whatsapp-agent-evals/<agente>.json` mesmo assim — ele será exercitado quando o runner ficar pronto.

### 7. Lint + build

```bash
npm run lint
npm run build
```

Build é importante se a mudança tocou `lib/whatsapp/types.ts` (mudança de tipo propaga para `app/`).

### 8. Smoke test no número real (opcional, para mudanças sensíveis)

Quando: mudança em prompt de produção, novo intent que afeta lead já em conversa, mudança no handoff `wa.me`.

Como: configure ambiente preview (Vercel) apontando para o WABA de teste e mande mensagens manualmente. Confira no painel admin os `agent_tool_calls` registrados. Veja [`runbooks/meta-whatsapp-setup.md`](./meta-whatsapp-setup.md) e [`runbooks/deploy-vercel.md`](./deploy-vercel.md).

Não é obrigatório para mudança puramente textual coberta por teste.

### 9. Documente a mudança

- Atualize o prompt em `.codex/prompts/whatsapp-<agente>.md` com a regra nova na seção certa (Status Rules, Safety Rules, Reply Rules).
- Se virou uma política nova (não só ajuste fino), abra/atualize ADR em `docs/adr/`.
- Se virou regra de comportamento estável (não trivial de inferir do código), registre no `docs/CONTEXT_CHANGELOG.md`.

## Como verificar que funcionou

- [ ] Teste novo passa.
- [ ] Todos os testes em `npm test` passam.
- [ ] `npm run lint` passa.
- [ ] `npm run build` passa (se tocou tipos).
- [ ] Prompt em `.codex/prompts/` reflete o comportamento real do código.
- [ ] Nenhuma das 8 invariantes em `.claude/skills/whatsapp-agent/SKILL.md` foi violada.
- [ ] Mensagem do bot continua em PT-BR, curta, sem cotação numérica indevida, sem promessa fora do PRD.

## Problemas comuns

**"Mudei o prompt mas o comportamento não mudou."**
O agente em produção pode estar usando texto hardcoded em `lib/whatsapp/*-agent.ts`, não lendo `.codex/prompts/*.md` em runtime (esses arquivos são guidance para devs/agentes, não prompt rodando em produção, a menos que explicitamente carregados). Olhe o `system` passado ao OpenAI e a estrutura do agente.

**"Teste passa local mas modelo real responde diferente."**
Snapshot de mock divergiu do modelo. Atualize o mock e considere adicionar o caso ao eval set, que roda modelo real.

**"OpenAI retornou JSON inválido em produção."**
Não crashe. O agente deve cair em fallback determinístico (ou resposta segura mínima) e logar em `agent_tool_calls` com `error`. Veja `.codex/prompts/openai-structured-output-review.md`.

**"Adicionei intent novo e roteamento de status quebrou."**
Confira que: (a) enum em `types.ts` foi atualizado, (b) schema do Structured Output cita o novo valor, (c) regra determinística decide o que `lead.status` vira (não deixa pro LLM — viola ADR-0001), (d) teste de transição de status cobre o caminho.

**"Bot começou a cotar preço de novo."**
Regressão de ADR-0012. Reabra o prompt §Pricing rule, confira que a regra determinística de detecção de "quanto custa?" ainda dispara antes do LLM, e adicione caso ao eval set marcado `critical: true`.

## Referências

- [`AGENTS.md §OpenAI Agent Rules`](../../AGENTS.md)
- [`.claude/skills/whatsapp-agent/SKILL.md`](../../.claude/skills/whatsapp-agent/SKILL.md)
- [`docs/adr/0001-llm-como-conselheiro-nao-decisor.md`](../adr/0001-llm-como-conselheiro-nao-decisor.md)
- [`docs/adr/0002-roteamento-via-agent-mode.md`](../adr/0002-roteamento-via-agent-mode.md)
- [`docs/adr/0009-confirmacao-vs-pre-agendamento.md`](../adr/0009-confirmacao-vs-pre-agendamento.md)
- [`docs/adr/0012-politica-de-preco.md`](../adr/0012-politica-de-preco.md)
- [`docs/architecture/whatsapp-bot-technical-plan.md`](../architecture/whatsapp-bot-technical-plan.md)
- [`tests/whatsapp-agent-evals/README.md`](../../tests/whatsapp-agent-evals/README.md)
