# Modulo: whatsapp-bot

Agente conversacional de IA no WhatsApp. Recebe eventos do webhook da Meta, resolve a
identidade do participante e o `agent_mode`, roda o agente certo (vendas, onboarding,
operacao, lembrete do cliente final, suporte) e responde. E stateful e auditado.

## Fronteiras

**Pertence a este modulo:**
- `lib/whatsapp/` — exceto os arquivos de cobranca (`cobranca-agent.ts`, `inadimplencia-guard.ts`), que sao do modulo [[billing]].
- `app/api/webhooks/whatsapp/route.ts` — entrada do webhook.
- `app/api/internal/whatsapp-reminders/consume/route.ts` — worker de lembretes.
- Prompts em `.codex/prompts/whatsapp-*.md`.
- `tests/harness/whatsapp/` — harness de teste conversacional (repositorio em memoria, sender
  fake, decorators que gravam o reply cru, invariantes). E a UNICA implementacao fake do
  `WhatsappRepository`: teste novo consome daqui em vez de duplicar `vi.fn()`.
- `scripts/whatsapp/` — CLIs de teste local (`repl`, `eval`, `persona`). Nunca importados por
  `app/` ou `lib/` (regra `no-restricted-imports` em `eslint.config.mjs`).

**NAO pertence:** UI do painel (modulo [[painel-admin]]), schema/migrations (modulo
[[database]]), cobranca/pagamento (modulo [[billing]]), site publico (modulo [[site-publico]]).

## Arquivos-chave
- `webhook-handler.ts` — orquestra persistencia, execucao do agente e envio de saida.
- `conversation-router.ts` — resolve identidade do participante e `agent_mode`.
- `sales-agent.ts` / `onboarding-agent.ts` / `reminder-agent.ts` / `support-agent.ts` — agentes por modo.
- `cliente-final-concierge.ts` — concierge do cliente final (ADR-0018).
- `service-confirmation.ts` — template `confirmacao_servico` enviado ao CLIENTE FINAL apos o
  cadastro (ADR-0005). E a ultima barreira antes da mensagem que o cliente da oficina le:
  nenhum texto livre da oficina pode virar parametro de template (ADR-0027). A confirmacao da
  OFICINA antes de gravar (o "sim" sobre o card) vive no `onboarding-agent.ts` (ADR-0017).
  O body auditado espelha o aprovado na Meta e o quick-reply "Chamar no whatsapp" e tratado
  pelo concierge como handoff para o wa.me (ADR-0018/QTR-35).
- `reminder-worker.ts` — consome a fila e dispara lembretes via template.
- `repository.ts` — toda a persistencia Supabase do bot.
- `whatsapp-client.ts` — envio pela Cloud API.
- `reply-generator.ts` / `reply-validator.ts` / `product-knowledge.ts` — camada de geracao
  conversacional (ADR-0020/0022/0024): rewrite naturaliza a enlatada; respond responde grounded
  no conhecimento fechado; validador deterministico com veto; `dontKnow` no respond grava
  `perguntas_sem_resposta` (ADR-0023).
- `date-parse.ts` — parsing deterministico de datas.
- `transcription.ts` / `image-vision.ts` / `document-text.ts` — media inbound (audio/imagem/pdf).
- `registration-signal.ts` — sinal deterministico compartilhado de cadastro, usado antes da classificação de vendas e no onboarding.
- `payload.ts`, `signature.ts`, `types.ts`, `*-fallbacks.ts` — parsing, assinatura, contratos e fallbacks.

## Regras/invariantes do modulo
- **LLM nao controla estado critico** (ADR-0001): pode classificar intencao / extrair dados, mas
  transicao de `lead.status`, `participant_type`, `agent_mode`, pagamento, opt-out e status de
  lembrete e decidida por regra deterministica no backend.
- Modos explicitos: `vendas`, `onboarding`, `operacao`, `cliente_final_lembrete`, `suporte`.
- OpenAI sempre com Structured Outputs (enum fechado). Para **classificacao de intencao**, o
  deterministico vem primeiro. Para **extracao de cadastro de troca**, o LLM e o extrator primario
  e o parser posicional por virgula e fallback (ADR-0027): em transcricao de audio a posicao da
  virgula nao separa campos, e o parser gravava `nome = "Ó"`. Depois de qualquer extracao roda a
  guarda de sanidade deterministica (`suspectDraftFields`) — campo suspeito volta a ser perguntado,
  nunca e persistido. A data e sempre deterministica (`parseBrazilianDate`).
- Em vendas, `hasRegistrationSignal` roda antes de volume/ticket (ADR-0029): só guarda o rascunho
  e conduz à captura do nome. A extração volta no onboarding após a conversão e nunca grava sem
  card + "sim" da oficina.
- Divergências entre classificador determinístico e LLM são auditadas best-effort; gatilhos só
  entram após promoção humana e o schema proíbe intenções terminais (ADR-0028).
- O que o bot promete tem de ser o que o banco gravou: a copy do cadastro informa a data que o RPC
  devolveu (`scheduled_at`), nunca um prazo recalculado de outra fonte.
- Persistir evento inbound antes de processar; guardar provider message IDs; idempotencia obrigatoria.
- Respeitar janela de 24h; fora dela, so template aprovado. Preservar opt-out / consentimento negativo.
- Decisoes que afetam estado de negocio sao logadas em `agent_tool_calls`.
- Respostas curtas, concretas e em portugues do Brasil.

## Testes
- `tests/whatsapp-*.test.ts` (route, router, repository, agentes, media, date-parse...).
- Ao mudar parsing, roteamento, transicao de status, escrita no repo ou webhook: atualizar/adicionar teste.

### Teste conversacional local (sem WhatsApp)
Tres ferramentas sobre o mesmo harness (`tests/harness/whatsapp/`), que roda o webhook REAL
contra repositorio em memoria e sender fake — sem Meta, sem Supabase e, por padrao, sem OpenAI.
Sempre pelo `handlers.POST` com request assinado: o texto que o cliente le nao e `reply.body`
(passa por geracao, validador, split e botoes) e o estado e decidido no webhook (ADR-0001).

- `npm run repl:whatsapp` — conversa no terminal mostrando o trace da decisao (intent, modo,
  transicao de status, tool calls, handoff). Flags: `--perfil lead|oficina|cliente_final`,
  `--geracao off|sombra|on`, `--openai off|real`. Comandos: `/estado`, `/raw`, `/audio`, `/botao`.
- `npm run eval:whatsapp` — roda `tests/whatsapp-agent-evals/` (schema tipado em `schema.ts`).
  Ver o README de la para `status` (active/quarantine/pending_decision) e replay vs seed.
- `npm run persona:whatsapp` — personas sinteticas conversam com o bot; invariantes
  deterministicas (`invariants.ts`) reprovam, LLM-judge so relata.

Os tres ficam FORA do `npm test`: com `--openai real` custam dinheiro e nao sao deterministicos.
Cobertura do proprio harness: `tests/whatsapp-harness.test.ts` e
`tests/whatsapp-harness-invariants.test.ts` (teste negativo — prova que cada invariante dispara).

## Referencias
- Arquitetura: `docs/architecture/whatsapp-bot-technical-plan.md`
- Backlog: `docs/backlog-whatsapp-bot/`
- Regras de negocio: `docs/regras-de-negocio.md`
- ADRs relevantes: ADR-0001 (LLM nao muda estado), ADR-0017 (confirmacao da oficina), ADR-0018 (concierge cliente final), ADR-0020/0022/0024 (camada de geracao conversacional), ADR-0023 (perguntas_sem_resposta), ADR-0027 (extracao de cadastro por LLM + guarda de sanidade), ADR-0028 (volante de intencao), ADR-0029 (cadastro sinalizado em vendas)
- Convencoes: `.context/conventions.md`
