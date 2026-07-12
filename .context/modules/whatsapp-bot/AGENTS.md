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

**NAO pertence:** UI do painel (modulo [[painel-admin]]), schema/migrations (modulo
[[database]]), cobranca/pagamento (modulo [[billing]]), site publico (modulo [[site-publico]]).

## Arquivos-chave
- `webhook-handler.ts` — orquestra persistencia, execucao do agente e envio de saida.
- `conversation-router.ts` — resolve identidade do participante e `agent_mode`.
- `sales-agent.ts` / `onboarding-agent.ts` / `reminder-agent.ts` / `support-agent.ts` — agentes por modo.
- `cliente-final-concierge.ts` — concierge do cliente final (ADR-0018).
- `service-confirmation.ts` — confirmacao da oficina antes de registrar a troca (ADR-0017).
- `reminder-worker.ts` — consome a fila e dispara lembretes via template.
- `repository.ts` — toda a persistencia Supabase do bot.
- `whatsapp-client.ts` — envio pela Cloud API.
- `date-parse.ts` — parsing deterministico de datas.
- `transcription.ts` / `image-vision.ts` / `document-text.ts` — media inbound (audio/imagem/pdf).
- `payload.ts`, `signature.ts`, `types.ts`, `*-fallbacks.ts` — parsing, assinatura, contratos e fallbacks.

## Regras/invariantes do modulo
- **LLM nao controla estado critico** (ADR-0001): pode classificar intencao / extrair dados, mas
  transicao de `lead.status`, `participant_type`, `agent_mode`, pagamento, opt-out e status de
  lembrete e decidida por regra deterministica no backend.
- Modos explicitos: `vendas`, `onboarding`, `operacao`, `cliente_final_lembrete`, `suporte`.
- Parsing deterministico primeiro; OpenAI so p/ texto livre, sempre com Structured Outputs (enum fechado).
- Persistir evento inbound antes de processar; guardar provider message IDs; idempotencia obrigatoria.
- Respeitar janela de 24h; fora dela, so template aprovado. Preservar opt-out / consentimento negativo.
- Decisoes que afetam estado de negocio sao logadas em `agent_tool_calls`.
- Respostas curtas, concretas e em portugues do Brasil.

## Testes
- `tests/whatsapp-*.test.ts` (route, router, repository, agentes, media, date-parse...).
- Evals de agente: `tests/whatsapp-agent-evals/` (`sales.json`, `onboarding.json`, `reminder.json`).
- Ao mudar parsing, roteamento, transicao de status, escrita no repo ou webhook: atualizar/adicionar teste.

## Referencias
- Arquitetura: `docs/architecture/whatsapp-bot-technical-plan.md`
- Backlog: `docs/backlog-whatsapp-bot/`
- Regras de negocio: `docs/regras-de-negocio.md`
- ADRs relevantes: ADR-0001 (LLM nao muda estado), ADR-0017 (confirmacao da oficina), ADR-0018 (concierge cliente final)
- Convencoes: `.context/conventions.md`
