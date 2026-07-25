# QTR-35 · P0 — extração por LLM, barreira de saída e data única

**Status: implementado em 25/07/2026** (commits `836ce4a`, `a63c8db`, `b4e45c1` + docs).
Pendência única: **a migration `20260725120000_register_service_returns_scheduled_at.sql`
não foi aplicada** — depende de aprovação para rodar no banco (projeto único, teste = prod).
Enquanto não for aplicada, o ack usa a copy neutra da janela de deploy (ver Etapa 3, item 3).
Decisões confirmadas na execução: data em `dd/mm/aaaa` e rótulo `revisão` fixo no código.

Plano executável para os **três itens P0** da issue [QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no).
P1 (itens 4–8) e P2 (itens 9–12) **não** entram nesta entrega.

Origem: análise das conversas `31ad24dc-f0b1-439c-852f-e11ac98cc6d0` (oficina) e
`0468d1ab-70fa-46c4-9752-8281b5f0658d` (cliente final), 24/07/2026.
Plano-pai: [`fase-camada-conversacional.md`](./fase-camada-conversacional.md).

## O que os três P0 têm em comum

Todos os três são a mesma falha em pontos diferentes do mesmo caminho: **texto falado
pela oficina virando dado persistido e mensagem enviada sem nenhuma barreira entre a
transcrição e o cliente final**. Por isso a ordem de execução abaixo não segue a
numeração da issue — começa pela barreira de saída (item 2), que protege o cliente
final mesmo que a extração continue errada.

```
áudio → transcrição → [1] extração → draft → confirmação → RPC → [3] copy p/ oficina
                                                              └→ [2] template p/ cliente final
```

---

## Estado atual verificado (evidência no código)

| # | Onde | O que acontece hoje |
| -- | -- | -- |
| 1 | [`onboarding-agent.ts:1092`](../../lib/whatsapp/onboarding-agent.ts#L1092) `extractDraft` | Roda `parseDeterministic` e, se os 4 campos vierem preenchidos, **retorna sem chamar** `extractWithOpenAI`. Transcrição de áudio é toda vírgula → sempre "tem sucesso" → LLM nunca roda. |
| 1 | [`onboarding-agent.ts:283`](../../lib/whatsapp/onboarding-agent.ts#L283) `parseDeterministic` | Split posicional por vírgula: `parts[0]`=nome, `parts[1]`=veículo, `parts[2..]`=serviço. Em fala natural isso é aleatório. |
| 2 | [`service-confirmation.ts:46`](../../lib/whatsapp/service-confirmation.ts#L46) | `default:` do `productLabelForConfirmation` devolve `input.servico` **cru** → para `revisao`/`outro` a frase transcrita inteira vira `{{produto}}` do template. |
| 3 | [`webhook-handler.ts:1601`](../../lib/whatsapp/webhook-handler.ts#L1601) | Copy usa `resolved.diasLembretePadrao ?? 90` (config da oficina). |
| 3 | [`20260522000000_tipos_servico_default.sql:83`](../../supabase/migrations/20260522000000_tipos_servico_default.sql#L83) | O RPC agenda por `tipos_servico_default.dias_lembrete` (`amortecedor=730`, `troca_oleo=90`, `revisao/outro=180`) e **não devolve** a data. Duas fontes de verdade → "90 dias" dito, `2028-07-23` gravado. |

## Achados adicionais (não estão na issue, entram no escopo P0)

Encontrados lendo o código. Todos são a mesma classe de falha dos três itens — sem
eles os critérios de conclusão da issue **não** se sustentam.

**A. `extractWithOpenAI` não recebe `today`.**
[`onboarding-agent.ts:1108`](../../lib/whatsapp/onboarding-agent.ts#L1108) manda só
`message`. O LLM não tem como resolver `"na data de hoje"` — hoje quem acerta a data é
`parseBrazilianDate` no caminho determinístico. Ao inverter a ordem, a data passa a
vir de um modelo sem referência temporal. **Decisão: a autoridade de `data_servico`
continua determinística** (`parseBrazilianDate(message, today)`); a data do LLM só é
aceita como fallback, e só se casar `^\d{4}-\d{2}-\d{2}$` dentro de uma janela sã.

**B. O merge por spread apaga campo bom.**
`{ ...deterministic, ...(aiDraft ?? {}) }` ([linha 1105](../../lib/whatsapp/onboarding-agent.ts#L1105)):
`parseOpenAIExtraction` devolve `undefined` para campo ausente, e `undefined` em spread
**sobrescreve**. Já hoje uma extração parcial do LLM apaga um campo que o parser
tinha acertado; invertendo a ordem isso vira o caminho principal. Precisa de um
`mergeDrafts` que só sobrescreve com valor não-vazio.

**C. O template tem 4 parâmetros de texto livre, não 1.**
`{{nome}}`, `{{carro}}` e `{{oficina}}` também saem da fala da oficina
([`service-confirmation.ts:52`](../../lib/whatsapp/service-confirmation.ts#L52)). O
`veiculos.descricao` gravado no caso real foi `Nome Dele É Leonardo` — se a oficina não
tivesse corrigido à mão, **isso** teria ido ao cliente final como `{{carro}}`. A
sanitização tem que valer para os quatro, não só para `{{produto}}`.

**D. O ack passa por reescrita de LLM sem garantia de preservação literal.**
[`webhook-handler.ts:1606-1609`](../../lib/whatsapp/webhook-handler.ts#L1606) comenta
*"o rewrite preserva os dados literais"*, mas
[`validateGeneratedReply`](../../lib/whatsapp/reply-validator.ts#L286) checa preço,
promessa, link, tamanho e cross-tenant — **nada** que exija a presença da data. Corrigir
o item 3 e mandar a copy por `allowGeneration = true` deixa a data à mercê do rewrite.

**E. Sem consentimento não existe lembrete, mas a copy promete um.**
O RPC só insere em `lembretes` quando `p_consentimento_whatsapp` é true
([linha 201](../../supabase/migrations/20260522000000_tipos_servico_default.sql#L201)) —
`lembrete_id` e `scheduled_at` vêm `null`. A copy atual promete "vou lembrar o X em N
dias" de qualquer forma. É a mesma mentira do item 3, por outro caminho.

**Nota de escopo:** os templates de lembrete (`enqueue_due_whatsapp_reminders`) já
passam só `customer_name`, `workshop_name`, `vehicle_description` — nenhum texto de
serviço. O item 2 da issue menciona "vale para os templates de lembrete": ali a
exposição é o `{{carro}}`, coberta por **C** + guarda de sanidade do item 1.

---

## Etapa 1 — Barreira de saída: nenhum texto livre vira parâmetro de template

Primeira porque é a de menor risco, não depende das outras duas e é a que impede a
pior falha ("texto sujo na cara do cliente da oficina") mesmo se a extração falhar.

**Arquivos:** `lib/whatsapp/service-confirmation.ts`, `lib/whatsapp/webhook-handler.ts`
(`sendServiceConfirmation`, ~linha 711).

1. `productLabelForConfirmation` deixa de ter `default:` que devolve texto livre.
   Passa a ser um mapa exaustivo `Record<TipoServico, string>`:
   `troca_oleo → "óleo"`, `amortecedor → "amortecedor"`, `revisao → "revisão"`,
   `outro → "revisão"`. `switch` exaustivo com `satisfies`/`never` para que um
   `tipo_servico` novo **quebre o build** em vez de vazar texto livre.
   *Rótulo fica no código, não em `tipos_servico_default.label`: aquele campo é
   editável no admin e um parâmetro de template não pode depender de texto editável
   (o `label` atual é `"Revisao"`, sem acento, impróprio para a frase).*
2. Nova `sanitizeTemplateParam(value, { maxLength })` aplicada aos **quatro**
   parâmetros em `serviceConfirmationParams`: colapsa espaços, remove `\n`/`\t`
   (a Cloud API rejeita), corta em ~60 chars com limite por campo, e devolve
   `null` quando o valor não sobra utilizável.
3. `sendServiceConfirmation` não envia quando qualquer parâmetro obrigatório
   sanitiza para `null` — grava `agent_tool_calls` com `output: { skipped: "param_invalido", campo }`
   e devolve `false` (a oficina recebe o ack sem "já avisei o cliente"). Não mandar é
   sempre melhor que mandar sujo.

**Testes** (`tests/whatsapp-service-confirmation.test.ts`, novo):
- `revisao` e `outro` com `servico` = a frase transcrita inteira → `{{produto}}` é `"revisão"`, e a frase **não** aparece em nenhum parâmetro.
- `switch` exaustivo: teste de tipo garantindo os 4 tipos mapeados.
- `{{carro}}` com `"Nome Dele É Leonardo"` de 3 linhas → sanitizado a uma linha; se exceder o limite, envio bloqueado.
- Param com `\n` → sem `\n` na saída.

**DoD:** nenhum caminho de `sendServiceConfirmation` consegue passar `serviceInput.servico` a um parâmetro de template. `npm test` verde.

---

## Etapa 2 — Extração por LLM primária + guarda de sanidade

**Arquivos:** `lib/whatsapp/onboarding-agent.ts`, `lib/whatsapp/webhook-handler.ts` (~1531), `lib/whatsapp/types.ts`.

1. **Inverter a ordem** em `extractDraft`:
   ```
   llm = await extractWithOpenAI(message, { today, sourceMediaType })
   base = (sourceMediaType === "audio") ? draftVazio : parseDeterministic(message, today)
   draft = mergeDrafts(base, llm)            // llm ganha, mas só com valor não-vazio
   draft.data_servico = parseBrazilianDate(message, today).date ?? dataIsoValidada(llm.data_servico)
   ```
   `parseDeterministic` vira **fallback** (sem `OPENAI_API_KEY`, erro de API, timeout) e
   **nunca** roda em texto vindo de áudio: split posicional em fala é ruído (achado A/B).
2. **`mergeDrafts(base, override)`** — só sobrescreve com string não-vazia / número /
   booleano definido. Mata o apagamento por `undefined` (achado B).
3. **Prompt de extração** recebe o contrato real (`nome_cliente`, `whatsapp_cliente`,
   `veiculo` só marca/modelo/ano, `servico` **descrição curta normalizada**,
   `data_servico`, `tipo_servico`, `marca_peca`, `valor`, `consentimento_whatsapp`),
   a data de hoje e a informação de que o texto pode ser transcrição de áudio com
   muletas de fala. Schema `strict: true` como já é hoje — só muda o system prompt e
   os campos de contexto. Espelhar em [`.codex/prompts/whatsapp-onboarding-agent.md`](../../.codex/prompts/whatsapp-onboarding-agent.md).
4. **Guarda de sanidade determinística depois do LLM** — nova
   `suspectDraftFields(draft): MissingField[]` exportada:
   - `nome_cliente`: < 3 chars, token único suspeito (`ó|oi|ah|então|olha|ele|ela`), ou vira vazio após `normalizeNomeCliente`;
   - `veiculo`: contém `\b(nome|ele|ela|dele|dela|acabou|tem|trocou)\b`, > 40 chars, ou > 4 tokens;
   - `servico`: > 60 chars, ou verbo conjugado de fala (`acabou|troquei|trocou|fiz|fez|tem`);
   - `data_servico`: fora da janela `[today-365, today+7]`.
   Campo suspeito **não** é aceito no draft: cai em `missingFieldForDraft` e o bot
   pergunta aquele campo. `Ó` e `Nome Dele É Leonardo` morrem nos dois filtros.
   Roda também em `applyFollowUp` e `mergeDraftCorrection` — as três portas de captura,
   como já vale para `normalizeNomeCliente`/`normalizeVeiculo`.
5. **Origem da mensagem até o agente**: `generateReply({ ..., sourceMediaType })` a
   partir de `inbound.mediaType` (já disponível — `inbound.body` recebe a transcrição em
   [`webhook-handler.ts:992`](../../lib/whatsapp/webhook-handler.ts#L992)). Usado para
   (a) barrar o parser posicional e (b) registrar `sourceMediaType` no tool call
   `solicitou_confirmacao_cadastro`, para medir qualidade de extração por origem.

**ADR-0001:** o LLM extrai *campos de rascunho*, não decide estado. O gate segue sendo
o "sim" explícito da oficina antes de qualquer escrita (ADR-0017). Nenhum invariante muda.

**Testes** (`tests/whatsapp-onboarding-agent.test.ts`):
- **Regressão canônica**, fixando a transcrição literal do caso real:
  `"Ó, o nome dele é Leonardo, ele tem, ele acabou de trocar um amortecedor da Perfect, ele tem uma BMW e na data de hoje."`
  com OpenAI mockado devolvendo a extração correta → `nome_cliente = "Leonardo"`,
  `veiculo = "BMW"`, `servico` curto (≤ 60 chars), `tipo_servico = "amortecedor"`,
  `marca_peca = "perfect"`, `data_servico = today`.
- Mesma mensagem com `openai: null` (fallback) → **não** produz `Ó` / `Nome Dele É Leonardo`; devolve pergunta de campo faltante.
- `suspectDraftFields` unitário para cada regra.
- LLM devolvendo `veiculo: null` não apaga o veículo que o parser acertou (achado B).
- LLM devolvendo `data_servico: "2028-07-23"` para "hoje" → data determinística prevalece (achado A).
- `sourceMediaType: "audio"` → `parseDeterministic` não é chamado (espiar via extração parcial).
- Caso `onb-001` (mensagem digitada com vírgulas) continua passando → sem regressão para quem digita no formato.
- Novo caso no eval set [`tests/whatsapp-agent-evals/onboarding.json`](../../tests/whatsapp-agent-evals/onboarding.json) com a transcrição literal, `critical: true`.

**Custo/latência:** passa a haver uma chamada OpenAI em todo turno com sinal de
cadastro (hoje o caminho por vírgulas curto-circuita). É `gpt-4o-mini` com schema
`strict`, no mesmo turno que já chama transcrição — impacto aceitável, e o fallback
determinístico cobre timeout.

---

## Etapa 3 — Agendar e comunicar a mesma data

**Arquivos:** nova migration, `lib/whatsapp/repository.ts` (~1132), `lib/whatsapp/types.ts` (`RegisteredService`), `lib/whatsapp/webhook-handler.ts` (~1599), `lib/whatsapp/reply-validator.ts`, `lib/whatsapp/reply-generator.ts`.

1. **Migration** `supabase/migrations/<ts>_register_service_returns_scheduled_at.sql`:
   `create or replace` do `register_service_with_reminder` com **a mesma assinatura**
   (10 params — preserva os grants; reexecutar `revoke`/`grant` de forma idempotente por
   segurança, ver lição de SECURITY DEFINER) adicionando ao `jsonb_build_object`:
   `'scheduled_at', <timestamptz do lembrete ou null>` e `'dias_lembrete', v_dias_lembrete`.
   Nenhuma outra mudança de comportamento no RPC.
2. `RegisteredService` ganha `scheduledAt: string | null` e `diasLembrete: number`;
   `registerServiceWithReminder` mapeia os dois campos.
3. **Copy do ack** (webhook-handler ~1599) passa a usar **`registered.scheduledAt`**:
   - com lembrete: `Cliente cadastrado. Vou lembrar o ${nome} em ${dd/mm/aaaa} pra voltar com você.`
   - sem consentimento (`scheduledAt === null`, achado E): `Cliente cadastrado. Como não tem autorização de WhatsApp, não vou mandar lembrete pra ele.`
   `resolved.diasLembretePadrao` deixa de ser usado aqui (segue existindo como config da oficina).
4. **Preservação literal na reescrita** (achado D): `validateGeneratedReply` ganha
   `requiredLiterals?: string[]`; se algum literal não estiver na saída gerada →
   `{ ok: false, reason: "literal_ausente" }` → cai na enlatada. Repassado por
   `maybeGenerateConversationalReply` exatamente como `requireHandoffLink` já é. No ack
   de cadastro passamos `[dataFormatada, nomeCliente]`.

**Testes:**
- `tests/whatsapp-route-phase3.test.ts` (ou novo `whatsapp-route-cadastro-ack.test.ts`): repo fake devolvendo `scheduledAt` para os três tipos → ack contém `troca_oleo` +90, `amortecedor` +730, `revisao`/`outro` +180 a partir de `data_servico`, e **nunca** um número de dias divergente.
- `scheduledAt: null` → ack diz que não haverá lembrete e não promete data.
- `tests/whatsapp-reply-validator.test.ts`: `requiredLiterals` reprova saída sem a data e aprova com ela.
- `tests/whatsapp-reply-generator.test.ts`: reescrita que remove a data → `usedFallback` true, corpo final = enlatada.
- `tests/whatsapp-repository.test.ts`: mapeamento de `scheduled_at`/`dias_lembrete`.
- **Verificação da migration em produção** (banco único, teste = prod): aplicar por migration, e **depois do deploy** conferir `list_migrations` contra os arquivos (lição `0002-deploy-corre-na-frente-das-migrations`) e rodar `get_advisors`. Aplicar a migration é ação em produção — confirmo com você antes de executar.

---

## Etapa 4 — Documentação e gates

1. **`docs/regras-de-negocio.md`** — obrigatório na mesma entrega (itens 1 e 3 mudam comportamento de produto):
   - §cadastro (~linhas 333–337): a extração passa a ser **LLM primário / parser fallback**, com a guarda de sanidade e a regra "campo suspeito volta a ser campo faltante"; `data_servico` continua determinística.
   - §confirmação ao cliente final: `{{produto}}` sai de rótulo fechado por `tipo_servico`; nenhum texto livre vira parâmetro; envio bloqueado se um parâmetro não sanitizar.
   - §lembretes (~linha 434): a copy informa a **data** vinda do RPC, não dias de config; sem consentimento o bot diz que não haverá lembrete.
2. **ADR** — item 1 é uma inversão de decisão de arquitetura (quem extrai o dado de cadastro). Registrar `docs/adr/0027-extracao-de-cadastro-por-llm.md` via `/aurea-context:adr`, referenciando ADR-0001 (por que não a viola) e ADR-0017 (o gate de confirmação continua sendo a rede de segurança).
3. **Contexto**: atualizar o doc do módulo em `.context/modules/` que cobre `lib/whatsapp/`.
4. `npm run lint` + `npm test` verdes. `/aurea-context:review` no diff antes do commit.
5. Comentário na QTR-35 com o que entrou (via `/aurea-linear:linear-pr-doc`).

---

## Sequência de commits (na `main`, sem branch nova)

| # | Commit | Etapa |
| -- | -- | -- |
| 1 | `Bloquear texto livre em parâmetro de template do cliente final` | 1 |
| 2 | `Extração de cadastro por LLM com guarda de sanidade determinística` | 2 |
| 3 | `RPC devolve scheduled_at e ack informa a data agendada` | 3 |
| 4 | `Atualizar regras de negócio e ADR-0027 (extração por LLM)` | 4 |

Cada commit sai com teste e verde por conta própria — dá para parar em qualquer um
deles com o produto melhor do que estava.

## Critérios de conclusão dos P0 (recorte da issue)

- [x] O áudio de teste produz `nome_cliente = Leonardo`, `veiculo = BMW`, `servico` curto, `tipo_servico = amortecedor` — teste fixando a transcrição literal em `tests/whatsapp-onboarding-agent.test.ts` + eval `onb-010`.
- [x] Nenhum caminho manda texto livre da oficina como parâmetro de template — `tests/whatsapp-service-confirmation.test.ts` cobre `revisao`, `outro` e os quatro parâmetros.
- [x] A copy informa a mesma data de `lembretes.scheduled_at` (teste para 90/730/180 em `tests/whatsapp-route-phase2.test.ts`) e não promete lembrete quando não há consentimento.
- [x] `docs/regras-de-negocio.md` atualizado (§3.2, §3.6, §4.1) + [ADR-0027](../adr/0027-extracao-de-cadastro-por-llm.md).
- [x] `npm test` (776) e `npm run lint` verdes; `npx tsc --noEmit` limpo.
- [ ] **Migration aplicada** e `list_migrations` conferido após o deploy (lição `0002-deploy-corre-na-frente-das-migrations`) — pendente de aprovação.

## Decisões tomadas na execução

1. **Formato da data no ack: `dd/mm/aaaa`** (e não "em julho de 2028"). Satisfaz o
   critério de forma mais estrita — é literalmente o `scheduled_at` — é conferível na
   hora pela oficina, e um erro de 8x salta aos olhos. Mês/ano por extenso deixaria
   margem para o rewrite "arredondar".
2. **Rótulo de `revisao`/`outro` no `{{produto}}`: `"revisão"` fixo no código**, não
   `tipos_servico_default.label` (editável no admin, e hoje `"Revisao"` sem acento).
   Parâmetro de template não pode depender de texto editável.
3. **Formatação da data em UTC.** Confirmado no banco que a sessão do Postgres roda em
   `UTC`, então `data_servico::timestamptz + interval` é meia-noite UTC do dia
   pretendido. Formatar em `America/Sao_Paulo` devolveria o dia anterior — trocaria um
   erro de meses por um erro de um dia, todo dia.
4. **Janela de sanidade da data em ±366 dias**, não ±7 como o plano esboçou: quando a
   mensagem não traz o ano, `parseBrazilianDate` assume o ano corrente, então uma data
   legítima pode estar a ~364 dias ("31/12" dito em janeiro). O alvo da guarda é o erro
   de ordem de grandeza (2028 para "hoje"), que é o que agenda lembrete anos à frente.
5. **Copy neutra para a janela de deploy.** O código sobe por push na `main` e as
   migrations são aplicadas à parte (lição 0002). Se o RPC antigo não devolver
   `scheduled_at` mas o lembrete existir, o ack diz "vou lembrar quando estiver na hora
   de voltar": não inventa data nem nega o lembrete.

## Fora do escopo desta entrega

P1 (4–8) e P2 (9–12) da QTR-35. Em particular ficam de fora, e continuam abertos:
o guard cross-tenant vetando o nome da própria oficina (item 5), o gancho de conversão
com sinal de cadastro em vendas (item 7), e a divergência entre `renderServiceConfirmation`
e o template aprovado na Meta (item 12) — este último é uma linha vizinha à Etapa 1,
mas é P2 e fica para a issue própria para não misturar auditoria com correção de dado.
