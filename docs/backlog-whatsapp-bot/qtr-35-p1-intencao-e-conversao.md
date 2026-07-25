# QTR-35 · P1 — intenção de compra, guardrails de venda e gancho de conversão

**Status: implementação local concluída; aguardando validação completa e aplicação da migration.**

Plano executável para os **cinco itens P1** da issue [QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no)
(itens 4–8). P0 (itens 1–3) já foi entregue em 25/07/2026 — ver
[`qtr-35-p0-qualidade-cadastro.md`](./qtr-35-p0-qualidade-cadastro.md). P2 (itens 9–12)
**não** entra nesta entrega.

Origem: análise das conversas `31ad24dc-f0b1-439c-852f-e11ac98cc6d0` (oficina) e
`0468d1ab-70fa-46c4-9752-8281b5f0658d` (cliente final), 24/07/2026.
Plano-pai: [`fase-camada-conversacional.md`](./fase-camada-conversacional.md).

## O que os cinco P1 têm em comum

Todos vivem no mesmo trecho do funil: **entre o lead demonstrar intenção e a intenção
virar estado/venda**. O item 4 perde a intenção explícita ("Quero fazer" → despedida);
o 5 veta a resposta certa no momento da conversão; o 6 esconde quem está falando no
primeiro contato; o 7 ignora a intenção mais forte possível (tentar usar o produto); o
8 demora a oferecer o caminho de um toque que resolve tudo isso.

```
lead fala → [4] classificar intenção → [6] apresentar-se → [7] reconhecer cadastro
          → [8] botões nos momentos de decisão → conversão → [5] não vetar o próprio nome
```

---

## Estado atual verificado (evidência no código, 25/07/2026)

Os números de linha da issue mudaram com a entrega da P0. Tabela conferida no código de hoje:

| # | Onde | O que acontece hoje |
| -- | -- | -- |
| 4 | [`sales-agent.ts:413`](../../lib/whatsapp/sales-agent.ts#L413) | Regex de aceite cobre só `quero testar\|teste\|proximo passo\|vamos\|tenho interesse\|bora\|topo`. "Quero fazer" → confidence 0.6 → classificador OpenAI. |
| 4 | [`sales-agent.ts:1016-1025`](../../lib/whatsapp/sales-agent.ts#L1016) | Guard do LLM só reverte `sem_interesse` quando `detectPain` é true. Sem dor, o `sem_interesse` do LLM é aceito. |
| 4 | [`sales-agent.ts:759-778`](../../lib/whatsapp/sales-agent.ts#L759) | Já existe guard **de status** (sem `isExplicitLossMessage` o lead não vai a `perdido`), mas a **copy** continua sendo despedida ("deixo registrado") — foi exatamente a resposta que o "Quero fazer" recebeu. |
| 5 | [`webhook-handler.ts:1985-1987`](../../lib/whatsapp/webhook-handler.ts#L1985) | `allowedNames = [resolved.oficinaNome, ...extraAllowedNames]` — `extraAllowedNames` só é populado no branch do concierge ([linha 1798](../../lib/whatsapp/webhook-handler.ts#L1798)). No branch de vendas nada entra: nome capturado no turno (`reply.nomeOficina`, `converted.nome`, `memory.workshop_name`) e nome dito pelo lead ficam fora da allowlist. |
| 5 | [`reply-validator.ts:233-269`](../../lib/whatsapp/reply-validator.ts#L233) | `checkCrossTenant` compara por `includes` bidirecional contra a allowlist normalizada — aceitar entradas "cruas" (ex.: a própria mensagem inbound) funciona sem mudança no validador. |
| 6 | [`sales-agent.ts:663-672`](../../lib/whatsapp/sales-agent.ts#L663) + [`1051-1078`](../../lib/whatsapp/sales-agent.ts#L1051) | Branch `pergunta_faq` devolve placeholder e o caller injeta `faq.resposta` com `withPain`, **sem `withGreeting`**. Também não saúdam: `small_talk`, `social_test`, `quer_humano`, `vai_pensar`, `pergunta_preco`, `informa_volume_ticket`, `quer_testar`. Só `pergunta_funcionamento` e o fallback `!greeted` saúdam. |
| 7 | [`onboarding-agent.ts:100-107`](../../lib/whatsapp/onboarding-agent.ts#L100) | `hasRegistrationSignal` existe, é determinístico (vírgulas + telefone + padrão de serviço), mas **não é exportado** e só roda nos modos `onboarding`/`operacao`. Em `vendas`, mensagem de cadastro cai em FAQ/fallback. |
| 8 | [`sales-agent.ts:864-878`](../../lib/whatsapp/sales-agent.ts#L864) | O menu de botões **já dispara no 2º fallback consecutivo** (`incomingFallbackCount % 5 === 1`) — a antecipação pedida pela issue já está no código (CV3, posterior à conversa analisada). Falta fixar com teste de regressão. |
| 8 | [`webhook-handler.ts:1537-1540`](../../lib/whatsapp/webhook-handler.ts#L1537) | `interactiveButtons` só é lido do reply no branch de **vendas**. O branch operacional (card de confirmação) não tem como enviar botões. |
| 8 | [`payload.ts:234-246`](../../lib/whatsapp/payload.ts#L234) | `button_reply.id` conhecido vira mensagem canônica via `resolveSalesButtonReplyId`; id desconhecido degrada para o `title`. Estrutura pronta para novos ids. |

## Achados adicionais (não estão na issue, entram no escopo P1)

Encontrados lendo o código. Sem eles, os critérios de conclusão não se sustentam.

**A. `convertLeadToOficina` zera o contexto da conversa.**
[`repository.ts:1096-1100`](../../lib/whatsapp/repository.ts#L1096) grava
`agentMode: "onboarding", context: {}` na conversão. Qualquer rascunho guardado em
`conversas.context` antes da conversão **morre ali**. O item 7 precisa retomar o
rascunho **no mesmo turno da conversão** (ler de `resolved.context` antes do wipe e
regravar o contexto do onboarding depois), ou o "rascunho preservado até depois da
conversão" do critério de conclusão é impossível.

**B. Import circular se `hasRegistrationSignal` for importado pelo sales-agent.**
`onboarding-agent.ts` já importa `normalizeText` de `./sales-agent`
([linha 5](../../lib/whatsapp/onboarding-agent.ts#L5)). O sinal precisa ir para um
módulo compartilhado novo (`lib/whatsapp/registration-signal.ts`, levando junto
`extractPhone` e `SERVICE_PATTERN`), importado pelos dois agentes.

**C. Mensagem de cadastro digitada dispara `informa_volume_ticket` hoje.**
"Leonardo, BMW, troca de óleo, 11 99300-5555" contém números → 
[`extractVolumeOrTicket`](../../lib/whatsapp/sales-agent.ts#L396) lê o telefone como
volume/ticket e responde ROI. O check de sinal de cadastro tem que rodar **antes** da
classificação (como o `awaiting_workshop_name` já faz), não como intent novo no meio.

**D. `extractWorkshopName` aceita "Sim" como nome de oficina.**
"sim" não é greeting nem ack ([`detectNeutralAck`](../../lib/whatsapp/sales-agent.ts#L123)
não tem "sim"), tem 3 chars → vira nome e **converte uma oficina chamada "Sim"**. O
gancho do item 7 pergunta "ativo e registro? me diz o nome da oficina" — resposta "sim"
fica muito mais provável. Guarda nova: tokens afirmativos puros re-perguntam o nome.

**E. "Corrigir" no card custa uma chamada de LLM à toa.**
[`handleConfirmation`](../../lib/whatsapp/onboarding-agent.ts#L1337) manda qualquer
não-"sim" para `extractCorrection` (OpenAI). O botão "Corrigir" (item 8) cairia nisso.
Early-exit determinístico para `corrigir|nao|não|errado|ta errado` → direto para
"Me diga o que corrigir." (sem LLM).

**F. Rascunho guardado envelhece: "hoje" falado ≠ "hoje" da conversão.**
Se o lead falar "troquei hoje" e converter dias depois, a extração na conversão
resolveria a data relativa ao dia errado. `pending_registration` guarda `received_at`
(data São Paulo do turno do sinal) e a retomada passa **essa** data como `today`.

**G. Botões hoje desligam a camada de geração.**
No handler, `reply.interactiveButtons` força `allowGeneration = false`
([1537-1540](../../lib/whatsapp/webhook-handler.ts#L1537)) — correto para o menu de
fallback (texto fixo), mas para explicador/preço (item 8) o corpo é conteúdo CV1. Ver
decisão (c).

---

## Decisões aprovadas

**(a) Escopo do volante do item 4.3** — **Aprovado:** log + gatilhos consumíveis já; tela admin vira issue-filha.
Só a tabela de log não fecha o volante (não há onde "promover"). Proposta: duas tabelas
— `divergencias_intencao_vendas` (log) e `gatilhos_intencao_vendas` (padrões promovidos,
consumidos pelo classificador a cada batch, como `faq_vendas`). Até a tela existir, a
promoção é um INSERT via Supabase Studio. Alternativa menor: só o log agora.

**(b) Copy do gancho do item 7** — **Aprovado:** copy genérica determinística, sem nomes.
Personalizar ("já registro o Leonardo da BMW?") exigiria rodar a extração LLM no turno
de vendas (latência + acoplamento). A personalização real chega 2 turnos depois, no
card pós-conversão com os dados extraídos. Alternativa: extração best-effort no gancho
só para compor a copy.

**(c) Explicador/preço com botões mantêm a geração CV1 no corpo?** — **Aprovado: sim.**
O corpo interativo passa a ser `generation.finalBody` quando aprovado pelo validador
(a invariante da ADR-0024 é sobre **estado**, que não muda). O menu de fallback nível 2
continua 100% determinístico como hoje.

---

## Ordem de execução

Seis pacotes, cada um com commit próprio na `main`. Quick wins primeiro; DDL por último
(lição [`0002-deploy-corre-na-frente-das-migrations`](../../.context/lessons/)).

### Pacote 1 — Item 4a + 4b: gatilhos de aceite e guard simétrico (sem banco)

**Arquivos:** `lib/whatsapp/sales-agent.ts`, `.codex/prompts/whatsapp-sales-agent.md`,
`tests/whatsapp-sales-agent.test.ts`, `tests/whatsapp-agent-evals/sales.json`.

1. **Regex de aceite** ([linha 413](../../lib/whatsapp/sales-agent.ts#L413)): adicionar
   `quero fazer|quero sim|quero ativar|pode ativar|fechado|fechou|manda|vamos nessa|to dentro|topa|vou querer`
   (`normalizeText` já remove acentos — "tô dentro" → "to dentro").
2. **Guard simétrico** no merge da classificação
   ([1010-1041](../../lib/whatsapp/sales-agent.ts#L1010)): generalizar o caso `detectPain`
   — se o LLM devolver `sem_interesse` e `!isExplicitLossMessage(message)`, a
   classificação é **rebaixada** (com dor → `pergunta_funcionamento`; sem dor → mantém a
   determinística `fora_escopo` 0.6, que cai no fluxo de fallback/respond, nunca em copy
   de despedida). O branch de `buildReply` (759) permanece como cinto de segurança do
   status.
3. Registrar a mudança no prompt note (`.codex/prompts/whatsapp-sales-agent.md`).

**Testes:** "Quero fazer"/"quero sim"/"pode ativar"/"fechado" → `quer_testar` sem LLM;
LLM mockado devolvendo `sem_interesse` para mensagem neutra → resposta não é despedida e
status não muda; `isExplicitLossMessage` real ("não quero mais") → segue `perdido`.
Casos novos em `sales.json` (id `sales-0xx`, `critical: true` para "Quero fazer").

**Critério da issue coberto:** "Quero fazer" e variações → `quer_testar`; nenhum caminho
leva a `perdido`/`sem_interesse` sem `isExplicitLossMessage`.

### Pacote 2 — Item 5: allowlist do cross-tenant com o nome do próprio turno

**Arquivos:** `lib/whatsapp/webhook-handler.ts`, `tests/whatsapp-route-generation.test.ts`
(ou teste novo `whatsapp-route-cross-tenant.test.ts`).

1. No branch de vendas, empurrar para `extraAllowedNames`:
   `reply.nomeOficina` (turno de captura), `reply.updatedContext?.sales?.workshop_name`,
   `resolved.context.sales?.workshop_name` (memória de turnos anteriores) e
   `converted.nome` (turno da conversão — hoje `resolved.oficinaNome` ainda é `null` aqui).
2. Na montagem final ([1985](../../lib/whatsapp/webhook-handler.ts#L1985)), incluir
   `inbound.body` como entrada da allowlist — nome que o **interlocutor** acabou de
   escrever não é vazamento (o `includes` bidirecional do `checkCrossTenant` já cobre
   "Oficina Marsili" contido na mensagem). Vale para todos os modos.
3. O guard continua reprovando nome que o LLM inventou (allowlist não ganha nada além
   do turno).

**Testes:** reproduzir os dois vetos reais da issue — geração citando "Oficina Marsili"
(i) no turno em que o lead disse o nome e (ii) no turno da conversão — ambas aprovadas;
geração citando "Oficina do Zé" (não dita, não cadastrada) → reprovada `cross_tenant`.

### Pacote 3 — Item 6: apresentação garantida na primeira resposta

**Arquivos:** `lib/whatsapp/sales-agent.ts`, `tests/whatsapp-sales-agent.test.ts`.

1. Centralizar: wrapper único em `generateReply` (aplicado nos três pontos de retorno —
   early-return de `awaiting_workshop_name`, resolução de FAQ e retorno final): se o
   `memory.greeted` **de entrada** era falsy → prefixa `GREETING_PREFIX` no `body` e
   grava `greeted: true` no `updatedContext.sales`.
2. Remover os `withGreeting` internos dos branches (`pergunta_funcionamento`, fallback
   `!greeted`) para não duplicar o prefixo — o wrapper passa a ser o único dono.
3. `interactiveButtons.bodyText` não recebe prefixo (menu nunca dispara sem `greeted`;
   fixar essa invariante em teste).

**Testes:** primeira mensagem sendo FAQ, preço, small talk, `quer_humano` e volume →
resposta contém a apresentação; segunda mensagem não repete; caminho
`pergunta_funcionamento` não sai com prefixo duplicado; snapshot dos branches que já
saudavam continua idêntico.

**Critério da issue coberto:** primeira resposta de qualquer conversa nova contém a
apresentação, inclusive com gatilho FAQ.

### Pacote 4 — Item 8: botões estratégicos (menu, card e momentos de decisão)

**Arquivos:** `lib/whatsapp/sales-buttons.ts`, `lib/whatsapp/sales-agent.ts`,
`lib/whatsapp/onboarding-agent.ts`, `lib/whatsapp/types.ts`, `lib/whatsapp/payload.ts`,
`lib/whatsapp/webhook-handler.ts`, testes correspondentes.

1. **Menu no 2º não-entendi**: já é o comportamento atual — apenas teste de regressão
   fixando (1º fallback → variação de texto; 2º → `interactiveButtons`).
2. **Card de confirmação com botões** `Confirmar`/`Corrigir`:
   - `OnboardingAgentReply` ganha `interactiveButtons?` (mesmo shape do vendas).
   - `confirmationReply` anexa `[{id: "onb_confirmar", title: "Confirmar"}, {id: "onb_corrigir", title: "Corrigir"}]`
     (2 ≤ 3 do limite da Cloud API); corpo continua o card determinístico
     (`allowGeneration = false`, ADR-0017 intacta).
   - `payload.ts`: mapa de ids ganha os dois novos → mensagens canônicas `"confirmar"` /
     `"corrigir"` (renomear o resolver para algo genérico, ex. `resolveButtonReplyId`,
     mantendo os ids de vendas). `"confirmar"` já é token afirmativo
     ([onboarding-agent.ts:760](../../lib/whatsapp/onboarding-agent.ts#L760)).
   - `handleConfirmation`: early-exit determinístico para `corrigir|nao|não|errado` →
     "Me diga o que corrigir." sem chamada de LLM (achado E).
   - Branch operacional do handler passa `onboardingReply.interactiveButtons` para o
     mesmo caminho de envio já existente.
3. **Explicador e preço com botões** (decisão c): `pergunta_funcionamento` (e o
   explicador do fallback `!greeted`) anexam `[Quero testar | Quanto custa | Falar com o Anderson]`;
   a 1ª resposta de preço anexa `[Quero testar | Como funciona | Falar com o Anderson]`.
   Novo id `sales_fb_humano` → canônica `"quero falar com humano"` (já casa
   `detectQuerHumano`). No handler, quando o reply é elegível a geração **e** tem
   botões, o corpo interativo usa `generation.finalBody` aprovado (senão o corpo
   determinístico); o menu nível 2 mantém `allowGeneration = false`.
4. Invariante ADR-0024 em teste: com e sem suporte a botões no transporte, o estado
   resultante (status, contexto, tool calls) é idêntico; o clique produz o mesmo intent
   da mensagem canônica.

**Critério da issue coberto:** botões nos momentos de decisão + card com
Confirmar/Corrigir, respeitando o limite de 3 reply buttons.

### Pacote 5 — Item 7: sinal de cadastro em vendas vira gancho de conversão

**Arquivos:** novo `lib/whatsapp/registration-signal.ts`, `lib/whatsapp/sales-agent.ts`,
`lib/whatsapp/onboarding-agent.ts`, `lib/whatsapp/types.ts`,
`lib/whatsapp/webhook-handler.ts`, testes + evals.

1. **Módulo compartilhado** (achado B): mover `hasRegistrationSignal`, `extractPhone` e
   `SERVICE_PATTERN` para `registration-signal.ts`; onboarding passa a importar de lá.
2. **Tipos**: `ConversationContext` ganha
   `pending_registration?: { message: string; media_type: InboundMediaType | null; received_at: string }`;
   `SalesAgentInput` ganha `sourceMediaType?` (o handler já tem `inbound.mediaType`).
3. **Gancho no sales-agent**: check **pré-classificação** (achado C), no mesmo ponto do
   `awaiting_workshop_name`: `hasRegistrationSignal(message)` → guarda
   `pending_registration` no contexto, seta `awaiting_workshop_name = true`, status
   `interessado`, tool call `registration_signal_em_vendas`, copy determinística no
   espírito de: *"Chefe, é exatamente isso que eu faço: guardo a troca e aviso o cliente
   na data certa da próxima. Já anotei o que você mandou — me diz o nome da sua oficina
   que eu ativo seu teste grátis e deixo esse cadastro pronto pra confirmar."*
   Sinal repetido antes da conversão → atualiza a mensagem guardada (última vence), sem
   repetir a copy inteira.
4. **Guarda de afirmativos no nome** (achado D): `extractWorkshopName` rejeita mensagem
   composta só de tokens afirmativos (`sim|pode|bora|quero|isso|fechado|ok...`) →
   re-pergunta o nome. Cobre também o fluxo antigo de `quer_testar`.
5. **Retomada na conversão** (achado A): no branch `reply.convertToOficina` do handler,
   ler `resolved.context.pending_registration` **antes** de `convertLeadToOficina`
   (que zera o contexto). Se existir: rodar `onboardingAgent.generateReply` com a
   mensagem guardada (`today = received_at`, `sourceMediaType` guardado, contexto vazio)
   e compor `replyBody = intro + "\n\n" + card` (o split de mensagem longa CV7 já
   divide em 2 envios). Persistir o contexto devolvido (rascunho + `awaiting_confirmation`)
   via `updateConversationModeAndContext`, gravar tool calls, anexar os botões
   Confirmar/Corrigir do pacote 4. Turno composto é transacional
   (`allowGeneration = false`).
   **Nada é gravado em `servicos`/`lembretes` neste turno** — o gate continua sendo o
   "sim" da oficina no card (ADR-0001/ADR-0017 intactas).
6. Degradação: extração falhou / OpenAI fora → o card não sai; sai a intro + pergunta de
   campo faltante do fluxo normal (a oficina segue no caminho de hoje, sem regressão).

**Testes:** primeira mensagem = transcrição literal do áudio do Leonardo → gancho (sem
FAQ, sem ROI); mensagem digitada com telefone → gancho (não `informa_volume_ticket`);
"sim" após o gancho → re-pergunta o nome (não converte "Sim"); nome após gancho →
conversão + intro + card com os dados extraídos; `pending_registration` sobrevive a
turnos intermediários ("quanto custa?" entre o gancho e o nome); sem pending →
conversão idêntica à atual (snapshot).

**Critério da issue coberto:** sinal de cadastro em modo vendas vira gancho com rascunho
preservado até depois da conversão.

### Pacote 6 — Item 4c: volante de retroalimentação da classificação (único com DDL)

**Arquivos:** migration nova `supabase/migrations/2026XXXXXXXXXX_volante_intencao_vendas.sql`,
`lib/whatsapp/repository.ts`, `lib/whatsapp/types.ts`, `lib/whatsapp/sales-agent.ts`,
`lib/whatsapp/webhook-handler.ts`, testes.

1. **Tabela `divergencias_intencao_vendas`** (espelho de
   [`perguntas_sem_resposta`](../../supabase/migrations/20260716120000_perguntas_sem_resposta.sql)):
   `id`, `conversa_id` FK, `lead_id` FK, `mensagem` (≤500), `intent_deterministico`,
   `confidence_deterministica`, `intent_llm`, `confidence_llm`, `intent_aplicado`,
   `status` (`aberta|promovida|ignorada`), `created_at`; índices por
   `(status, created_at desc)` e `conversa_id`; **RLS habilitado sem policy**
   (service-role only, convenção do projeto); comments nas colunas.
2. **Tabela `gatilhos_intencao_vendas`** (decisão a): `id`, `padrao` (texto), `intent`
   com **check constraint restrito a intents não-terminais**
   (`quer_testar|pergunta_preco|pergunta_funcionamento|quer_humano|vai_pensar`) — 
   `sem_interesse`/`perdido` proibidos por schema (ADR-0001: estado terminal é só
   `isExplicitLossMessage` no código), `ativo`, `origem_divergencia_id` FK nullable,
   `created_at`. RLS idem.
3. **Plumbing**: `AgentReply` ganha `classificationAudit?` (intents/confidences dos dois
   classificadores + aplicado), preenchido só quando o LLM rodou e divergiu; handler
   grava best-effort (try/catch, nunca derruba a resposta — padrão ADR-0023);
   repository ganha `saveDivergenciaIntencao` e `listActiveGatilhosIntencao`
   (opcionais na interface).
4. **Consumo**: gatilhos carregados junto das FAQs
   ([webhook-handler.ts:1036](../../lib/whatsapp/webhook-handler.ts#L1036)), passados em
   `SalesAgentInput`; `classifySalesMessage` os testa **depois** das regras 1–2 (recusa
   explícita e dor vencem promoção) com match por palavra normalizada (regex-escape do
   padrão), confidence 0.9.
5. **Ritual de banco** (memória do projeto): `apply_migration` → `get_advisors` →
   conferir `list_migrations` vs arquivos após o deploy; registrar neste doc como o P0
   fez.

**Testes:** divergência gravada quando determinístico ≠ LLM (e não gravada quando o LLM
não roda); gatilho ativo promove "quero fazer tambem" → `quer_testar` sem LLM; gatilho
com intent proibido rejeitado pelo check (teste de migration/SQL não se aplica — cobrir
no repository com mock); recusa explícita vence gatilho.

**Critérios da issue cobertos:** retroalimentação com revisão do admin promovendo padrão
sem deploy; RLS + advisors + list_migrations.

---

## Documentação e fechamento (junto dos pacotes, não depois)

- **`docs/regras-de-negocio.md`** (itens 4, 6, 7 e 8 mudam comportamento de produto):
  §1.2 (gatilhos de aceite ampliados + regra "LLM nunca leva lead a
  `perdido`/`sem_interesse` sem recusa explícita"); nova subseção em §1 para o volante de
  intenção (par da §1.8) e para o gancho de cadastro em vendas; §1.x botões nos momentos
  de decisão; §3.4 (card com botões Confirmar/Corrigir); nota da apresentação obrigatória
  na primeira resposta.
- **ADRs**: `0028-volante-de-gatilhos-de-intencao.md` (pacote 6) e
  `0029-sinal-de-cadastro-em-vendas.md` (pacote 5). Guard simétrico não pede ADR nova —
  é enforcement da ADR-0001.
- **Prompts**: `.codex/prompts/whatsapp-sales-agent.md` atualizado (gatilhos, gancho,
  guard) — source of truth do comportamento.
- **Camada de contexto**: `.context/modules/whatsapp-bot/AGENTS.md` +
  `docs/CONTEXT_CHANGELOG.md` + linha no [`README.md`](./README.md) deste diretório.
- **Linear**: issue-filha para a tela admin do volante (triagem de
  `divergencias_intencao_vendas` → promover/ignorar), referenciando a ADR-0028.

## Critérios de conclusão P1 (da issue)

- [x] "Quero fazer" e variações de aceite classificam como `quer_testar`; nenhum caminho
      leva um lead a `perdido`/`sem_interesse` sem `isExplicitLossMessage`.
- [x] Resposta contendo o nome da própria oficina, capturado no mesmo turno, não é
      reprovada por `cross_tenant`.
- [x] Primeira resposta de qualquer conversa nova contém a apresentação, inclusive FAQ.
- [x] Sinal de cadastro em modo vendas vira gancho de conversão com rascunho preservado
      até depois da conversão.
- [ ] Volante: migration local cria RLS e o escopo por conversa/lead; faltam aplicação remota,
      `get_advisors` e `list_migrations`
      conferido após deploy.
- [x] `docs/regras-de-negocio.md` atualizado na mesma entrega.
- [x] `npm test`, `npm run lint` e `npm run build` verdes (suíte inteira, não só os arquivos tocados).

## Riscos e reversibilidade

- Tudo exceto o pacote 6 é código puro, sem migration e sem template Meta novo —
  reversível por revert de commit.
- Pacote 6 é aditivo (duas tabelas novas, zero alteração em tabela existente); rollback
  = revert + drop das tabelas.
- Pacote 5 muda o primeiro contato de leads reais: a degradação (item 6 do pacote)
  mantém o fluxo atual quando qualquer coisa falhar; nenhuma escrita nova acontece sem a
  confirmação da oficina.
- Ordem dos commits permite parar a qualquer momento com a `main` íntegra.
