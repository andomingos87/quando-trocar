# Context Changelog · Quando Trocar

Histórico de decisões e mudanças relevantes no contexto do projeto. Formato adaptado de [Keep a Changelog](https://keepachangelog.com/).

Quando registrar:

- Uma decisão arquitetural foi tomada (link p/ ADR).
- Um PRD foi aprovado, atualizado ou descontinuado.
- Uma fase do backlog foi encerrada.
- Um novo runbook foi adicionado.
- Convenção do projeto mudou (idioma, estrutura, fluxo de trabalho).
- Algo grande foi removido ou substituído.

Não registrar:

- Commits individuais (`git log` resolve).
- Bugs corrigidos (PRs resolvem).
- Mudanças de copy ou design pontuais.

---

## 2026-08-03 — Analytics de anúncios (Meta Ads via Windsor.ai)

Nova tela `/admin/analytics-ads`: liga gasto/resultado do Meta Ads ao funil real do CRM (lead → qualificado → convertido), respondendo "esse anúncio gerou venda de verdade?".

### Decidido

- Atribuição de anúncio (`referral`/`ctwa_clid` do Meta) é capturada no webhook e persistida em `leads_oficina` como **first-touch**, nunca sobrescrita — distinto do campo `origem` existente (landing vs. manual).
- Gasto/resultado do Meta Ads é sincronizado 1×/dia via **Windsor.ai** (não Meta Graph API direto) para `ad_insights_daily`, escolhido por já estar configurado como MCP no projeto e cobrir futuras fontes (Google Ads etc.) com uma única integração.
- Agregação roda em RPC SQL (`get_ads_analytics`, `SECURITY DEFINER`), mesmo padrão de `get_conversational_metrics`.

### Operação

- Migrations `ads_analytics` e `ad_insights_sync_cron` aplicadas em produção (único projeto Supabase — teste e prod são o mesmo banco).
- Pendente do lado do usuário: conectar a conta de Meta Ads no Windsor (conector `facebook` — só `instagram` orgânico estava conectado), configurar `WINDSOR_API_KEY` e registrar `ad_insights_sync_url` no Vault. Ver [runbook](./runbooks/ads-analytics-setup.md).
- Nomes de campo do conector Windsor (`campaign`, `adset`, `ad`, `actions`) ainda não foram confirmados com `get_fields` numa conta conectada — só documentados publicamente. Ajustar `lib/windsor/meta-ads.ts` se necessário após conectar.

---

## 2026-07-25 — Dado, card e auditoria (QTR-35 P2)

Implementa os itens 9–12 da [QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no), conforme [`qtr-35-p2-dado-card-auditoria.md`](./backlog-whatsapp-bot/qtr-35-p2-dado-card-auditoria.md).

### Decidido

- A identidade capturada da oficina é persistida no lead no mesmo turno e lida dali na conversão; `nome` só completa `nome_responsavel` quando ainda vazio.
- O card mostra campos alterados, alerta campos reprovados pela guarda e revalida o draft no aceite; correções múltiplas continuam em uma única mensagem.
- Auditoria de `update_lead` registra o status aplicado e mensagens interativas registram corpo, ids e títulos das opções.
- O body auditado de `confirmacao_servico` espelha a copy aprovada; o quick-reply "Chamar no whatsapp" responde com o `wa.me` da oficina. Botão URL fica para submissão futura na Meta.

### Operação

- Não há migration nem Edge Function nova nesta entrega. Validar `npm test` e `npm run lint` antes de publicar.

## 2026-07-25 — Intenção de compra, conversão guiada e volante seguro (QTR-35 P1)

Fecha localmente os itens 4–8 da [QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no). Plano e evidência de origem em [`qtr-35-p1-intencao-e-conversao.md`](./backlog-whatsapp-bot/qtr-35-p1-intencao-e-conversao.md). A migration do volante permanece pendente de aplicação remota.

### Decidido

- **[ADR-0028](./adr/0028-volante-de-gatilhos-de-intencao.md)** — divergência entre classificador determinístico e LLM vira audit best-effort; somente humano promove gatilho e o schema proíbe intent terminal.
- **[ADR-0029](./adr/0029-sinal-de-cadastro-em-vendas.md)** — tentativa de cadastro em vendas vira conversão guiada. O texto, origem e data sobrevivem à conversão e só são extraídos no onboarding, ainda atrás do card + "sim".

### Alterado

- Aceites reais como "quero fazer" passam a ser determinísticos; LLM não consegue produzir `sem_interesse`/`perdido` sem recusa explícita.
- A apresentação do Quando Trocar sai uma vez em toda primeira resposta de vendas; o cross-tenant permite o nome que o próprio lead acabou de fornecer, sem liberar nome inventado.
- Botões passam a cobrir preço/explicador e o card `Confirmar | Corrigir`; IDs e efeitos continuam determinísticos.

### Pendente

- Aplicar `20260725201415_volante_intencao_vendas.sql`, rodar advisors e conferir histórico de migrations depois do deploy.
- Criar issue-filha para tela administrativa de triagem/promoção de `divergencias_intencao_vendas`.

## 2026-07-25 — Qualidade do cadastro: extração por LLM, barreira de saída e data única (QTR-35 P0)

Correção dos três itens P0 da [QTR-35](https://linear.app/biapps/issue/QTR-35/qualidade-do-bot-extracao-por-llm-agendamento-correto-texto-sujo-no), a partir da análise das conversas de teste ponta a ponta em produção (cadastro da Oficina Marsili, 24/07/2026). O fluxo completava, mas gravava dado corrompido e prometia à oficina uma data diferente da agendada. Plano em [`qtr-35-p0-qualidade-cadastro.md`](./backlog-whatsapp-bot/qtr-35-p0-qualidade-cadastro.md).

### Decidido

- **[ADR-0027](./adr/0027-extracao-de-cadastro-por-llm.md)** — o LLM passa a ser o **extrator primário** do cadastro de troca; o parser posicional por vírgula vira fallback e nunca roda em transcrição de áudio. Como o extrator primário passa a ser não-determinístico, entra uma **guarda de sanidade determinística** (`suspectDraftFields`) depois dele: campo suspeito volta a ser perguntado, nunca é persistido. A `data_servico` continua determinística. Não viola a ADR-0001 (o LLM extrai campo, não decide estado) e o gate da ADR-0017 (o "sim" da oficina) permanece.

### Alterado

- **Barreira de saída no template do cliente final** — o `{{produto}}` do `confirmacao_servico` sai de um mapa fechado por `tipo_servico` (antes `revisao`/`outro` mandavam o texto livre que a oficina ditou). Sanitização aplicada aos **quatro** parâmetros, porque `{{nome}}` e `{{carro}}` também vêm da fala; parâmetro que não sobrevive **aborta o envio** e audita `skipped: param_invalido`. Regras §3.6.
- **Data do lembrete com fonte única** — `register_service_with_reminder` passa a devolver `scheduled_at` e `dias_lembrete` (migration `20260725120000_register_service_returns_scheduled_at.sql`), e a copy informa **a data** (`dd/mm/aaaa`) em vez de "em N dias". Antes a copy lia `oficinas.dias_lembrete_padrao` (90) enquanto o RPC agendava pela cadência do tipo (`amortecedor` = 730). Sem consentimento não há lembrete e o bot deixa de prometer um. Regras §4.1.
- **`requiredLiterals` no validador da camada de geração** — reescrita que perde ou altera um dado literal obrigatório (hoje a data do lembrete) é reprovada (`literal_ausente`) e cai na enlatada. O ack de cadastro passava por rewrite sem nenhuma garantia disso.

### Pendente

- P1 (itens 4–8) e P2 (itens 9–12) da QTR-35 seguem abertos — entre eles o guard cross-tenant vetando o nome da própria oficina, o gancho de conversão para sinal de cadastro em modo vendas, e a divergência entre `renderServiceConfirmation` e o template aprovado na Meta.

Migration aplicada no mesmo dia (`20260725184455_register_service_returns_scheduled_at`), conferida em `list_migrations`, com `get_advisors` sem achado novo.

## 2026-07-18 — Demais fases da camada conversacional (CV4–CV8, QTR-13 a QTR-17)

Fecha o milestone "3. Demais fases (CV4–CV8)" do projeto Camada Conversacional. Todas protegidas por validador + fallback enlatado (ADR-0020); com `geracao_llm_modo='off'`, comportamento idêntico ao anterior.

### Adicionado

- **CV4 — Follow-up proativo de leads** (QTR-13): job diário `app/api/internal/followup-leads/route.ts` (protegido por `INTERNAL_JOB_SECRET`) + `lib/whatsapp/followup-leads.ts` (seleção pura testável). Até 2 follow-ups por lead via template Meta aprovado (fora da janela 24h — ADR-0005); janelas 24h/72h; só `em_conversa`/`qualificado`, nunca em handoff; idempotente (contador só avança em sucesso). Migrations `20260718140000_leads_followup.sql` e `20260718141000_followup_leads_cron.sql` (cron 1×/dia; requer o segredo `followup_leads_url` no Vault). Regras §1.7.
- **CV5 — Volante de aprendizado** (QTR-14): busca semântica na FAQ (pgvector + `embedding` em `faq_vendas` + RPC `match_faq_vendas`, `lib/whatsapp/faq-embeddings.ts`), fallback pro match por keyword; embedding gerado no save do admin (best-effort). Tela `/admin/perguntas-sem-resposta` (lista por frequência, "virar FAQ" pré-preenchido, ignorar). Migration `20260718150000_faq_semantic_search.sql`. Regras §1.5/§1.8.
- **CV6 — Operação como assistente** (QTR-15): consultas read-only escopadas por `oficina_id` (`listUpcomingReminders`, `countRemindersSentThisMonth`, `getClienteResumo`) via intents `consulta_lembretes`/`consulta_cliente` (`classifyReadOnlyQuery`); dados literais + moldura só em respostas curtas. Comando `/ajuda` determinístico por modo. Ack de cadastro ganha moldura (rewrite). Regras §3.3-bis/§13.
- **CV7 — Humanização fina + métricas** (QTR-16): read receipt + typing (`markReadAndTyping`), quebra de mensagem longa (`message-split.ts`, ~350 chars → 2 msgs), `bot_muted` (silencia o bot 24h no handoff — `conversas.bot_muted_until`), tela `/admin/metricas-conversacional` (RPC `get_conversational_metrics`) e captura de quality rating do número (`meta_phone_status`, webhook `phone_number_quality_update`). Migrations `20260718160000`, `20260718161000`, `20260718162000`. Regras §13.
- **CV8 — Concierge com moldura gerada** (QTR-17): [ADR-0026](./adr/0026-concierge-moldura-gerada.md) revisa a ADR-0018 — moldura gerada (rewrite) só nos intents `quem_e`/`agradecimento`/`mensagem_indefinida`; `opt_out`/`numero_errado`/`nao_reconhece`/`pedido_oficina` seguem determinísticos. Regra extra do validador `requireHandoffLink` (exige a ponte `wa.me` da oficina). Red-team em `tests/whatsapp-concierge-generation.test.ts`. Regras §3.7.

### Notas

- Migrations aplicadas via MCP nesta sessão; escritas idempotentes (`if not exists` / `create or replace`) — reaplicar por `db push` é seguro apesar do drift de timestamp nome-de-arquivo × versão registrada.
- **Pendências operacionais**: submeter/aprovar os templates Meta `followup_lead_24h`/`followup_lead_72h` e definir `WHATSAPP_TEMPLATE_FOLLOWUP_*` (CV4); criar o segredo `followup_leads_url` no Vault (CV4); inscrever a WABA no webhook `phone_number_quality_update` (CV7).
- Não implementado (fora do essencial do card): moldura gerada no reminder-agent (CV8 menciona como opcional) — o concierge é a superfície sensível e ficou coberto.

## 2026-07-18 — Vendas: objeções, resumo de handoff e botões (Fase CV3, QTR-12)

### Adicionado

- **Objeções como FAQ** (não coluna `tipo`): seeds de `faq_vendas` (migration `20260718130000_faq_objecoes_vendas.sql`) para "não tenho tempo", "cliente não usa WhatsApp", "já controlo no caderno" e "vai achar chato" — contorno + CTA de teste, editáveis no admin. Decisão consciente de divergir do plano original (que previa coluna `tipo`): o [ADR-0022](./adr/0022-modo-respond-grounded.md)/[ADR-0023](./adr/0023-perguntas-sem-resposta.md) já estabeleceram a FAQ do banco como o canal editável-sem-deploy que alimenta o `respond` e o match de `pergunta_faq`.
- **Resumo de handoff** (`lib/whatsapp/handoff-summary.ts`, prompt `whatsapp-handoff-summary.md`): quando o agente de vendas faz handoff, gera um resumo de 3 linhas (LLM, uso interno) e envia ao WhatsApp comercial. Best-effort (não bloqueia o handoff), só com `geracao_llm_modo != 'off'`, auditado em `agent_tool_calls`. Ver `regras-de-negocio.md §1.5`.
- **Botões interativos** no fallback nível 2 de vendas: `sendInteractiveButtons` em `lib/whatsapp/whatsapp-client.ts` (Cloud API reply buttons, máx 3) + `lib/whatsapp/sales-buttons.ts` (id determinístico → mensagem canônica → intent, sem LLM) + parse de `button_reply.id` em `payload.ts`. Substitui `FALLBACK_VARIATIONS[1]`; degrada para texto quando o transporte não suporta botões. Determinístico — não marca respond nem altera o contador. Ver `regras-de-negocio.md §1`.

### Notas

- **Deploy**: a migration de seeds precisa ser aplicada ao banco (o deploy do código corre à frente das migrations neste projeto).

---

## 2026-07-18 — Portal do representante (Fase R4)

### Adicionado

- **[ADR-0025](./adr/0025-portal-do-representante.md)** (estende a [ADR-0019](./adr/0019-representantes-e-comissao.md)) — **portal próprio do representante** (`app/representante`), read-only, com login OTP-no-WhatsApp contra a tabela `representantes` (sem `rep_users`). Sessão isolada do admin (cookie `qt_rep_session`, `REP_SESSION_SECRET`, claim `isRepresentante`, TTL 14 d). Escopo por `representante_id` **imposto no código** (não há RLS por tenant — ADR-0003 estado real); guard re-checa `ativo`/`deleted_at` a cada request. **Sem PII de cliente final** (LGPD): carteira mostra a oficina + agregados. Playbook e novidades são conteúdo estático no código. Responde à decisão em aberto do [PRD §24](./product/PRD-whatsapp-bot.md).
- **Novo módulo `portal-representante`** (`.context/modules/portal-representante/AGENTS.md`) — fronteira de segurança distinta do `painel-admin`.
- **Migration `20260718120000_portal_representante.sql`** — `auth_otps.target` passa a aceitar `'representante'`; `representantes.ultimo_acesso_em timestamptz`.
- **Nova subseção `regras-de-negocio.md §18.7`**; runbook `docs/runbooks/publicar-novidade-representante.md`.
- Novo secret `REP_SESSION_SECRET` (≥32 chars) em `.env.local.example` e runbooks de env. Reaproveita o template Meta de OTP existente (`WHATSAPP_TEMPLATE_OTP_NAME`) — sem template novo na Meta.

### Encerrado

- Fase R4 de `docs/backlog-whatsapp-bot/fase-representantes-comissao.md` deixa de ser "futuro" — executada em `fase-representante-portal.md`.

---

## 2026-07-16 — Volante de aprendizado e respond em vendas (CV2 completo)

### Adicionado

- **[ADR-0023](./adr/0023-perguntas-sem-resposta.md)** — tabela **`perguntas_sem_resposta`** (migration `20260716120000`): quando o modo respond devolve `dontKnow`, a pergunta vira registro triável (`agent_mode`, pergunta, enlatada enviada, `geracao_modo`, `prompt_version`, `status`) que o admin converte em FAQ **sem deploy**. Grava em `sombra` e `on`, best-effort; rewrite+`dontKnow` não grava. Contrato do gerador mudou: `ReplyGenerator.generate` devolve `{reply} | {reply: null, reason: "dont_know" | "error"}`.
- **[ADR-0024](./adr/0024-respond-em-vendas.md)** — emenda o invariante 6 da ADR-0022: o **caso geral do `fora_escopo` de vendas** roda em respond, grounded em `buildSalesKnowledge` (`PRODUCT_FACTS` + novo `SALES_FACTS` + FAQ filtrada + handoff). Sub-caminhos (saudações, lead interessado, handoff ≥7) seguem determinísticos; `consecutive_fallback` nunca reage à geração. Objetivo do prompt por `agent_mode`; bump `cv2-2`.
- **`PRODUCT_FACTS` expandido** — cadências de fábrica do lembrete (óleo ~90d, revisão/outros ~180d, amortecedor ~2 anos; seed `tipos_servico_default`, ajustável no painel), correção antes vs depois de confirmar, pós-confirmação.

### Alterado

- No audit de `agent_tool_calls`, `dontKnow` sai do bucket `generation_failed_or_null` e vira **`generation_dont_know`** — consultas/monitoração sobre a string antiga verão o número "cair" sem ser melhora.

---

## 2026-07-16 — Modo "respond" grounded na camada de geração conversacional

### Adicionado

- **[ADR-0022](./adr/0022-modo-respond-grounded.md)** — complementa a [ADR-0020](./adr/0020-camada-geracao-conversacional.md): a camada de geração ganha o modo **respond** (CV2): o LLM responde a pergunta do usuário grounded num bloco de conhecimento fechado (`lib/whatsapp/product-knowledge.ts` + FAQ filtrada + contexto da oficina), em vez de só reescrever a enlatada (rewrite/CV1). Protocolo "não sei" → `dontKnow` → fallback enlatado. Validador com veto e máquina off/sombra/on inalterados; prompt-version bump `cv2-1`; audit ganha `generationMode`.
- **Categoria `pergunta` no agente de operação** — pergunta fora do cadastro ("já sou cliente?", "vocês fazem alinhamento?") deixa de despejar o formulário; enlatada = resposta curta + handoff comercial + convite a registrar, com geração respond. **Preço na operação é trilho crítico** (ADR-0012): regex determinística força rewrite sobre o handoff — o respond nunca responde preço.

---

## 2026-07-12 — Gateway de pagamento pluggável (ASAAS + Mercado Pago)

### Adicionado

- **[ADR-0021](./adr/0021-gateway-pagamento-multiplo-asaas.md)** — complementa a [ADR-0008](./adr/0008-pagamento-no-mvp.md): o pagamento deixa de ser acoplado ao Mercado Pago. Camada `lib/payments/` com interface `PaymentGateway` e duas implementações (`mercado-pago-gateway`, `asaas-gateway`); provedor ativo escolhido em runtime pela config. **ASAAS** vira o provedor ativo (cobrança avulsa por ciclo, `billingType: UNDEFINED` = PIX/boleto/cartão); Mercado Pago fica **configurado porém dormente**. Webhook único e idempotente (`process-webhook.ts`) para os dois; nova rota `POST /api/webhooks/asaas`.
- **Gestão pelo painel admin** — `/admin/configuracoes/pagamentos` (provedor ativo, ambiente ASAAS, credenciais). **Segredos no Supabase Vault** (funções `SECURITY DEFINER` só `service_role`); a UI só mostra se cada segredo está configurado, nunca o valor; auditoria nunca registra segredo. Um provedor só é ativável com credencial usável.
- **Schema** — migration `20260712120000_gateway_pagamento_asaas.sql`: colunas genéricas em `pagamentos` (`gateway`, `gateway_charge_id`, `gateway_payment_id`, `payment_url`, `external_reference`; `mp_*` mantidas/deprecadas e backfilladas), `oficinas.cpf_cnpj` + `oficinas.asaas_customer_id`, tabela singleton `configuracoes_pagamento`, funções de Vault. Aditiva e reversível.
- **Seções 9.3/9.5 de `regras-de-negocio.md`** e runbook [asaas-setup](./runbooks/asaas-setup.md).

---

## 2026-07-11 — Camada de geração conversacional com validador

### Adicionado

- **[ADR-0020](./adr/0020-camada-geracao-conversacional.md)** — o bot ganha uma camada de **geração de texto por LLM** entre a decisão determinística de estado e o envio, cercada por um **validador determinístico** com poder de veto. Complementa (não altera) a [ADR-0001](./adr/0001-llm-como-conselheiro-nao-decisor.md): o texto gerado nunca muda estado; reprovação/erro/timeout cai no fallback enlatado atual. Modo `off`/`sombra`/`on` via `configuracoes_vendedor.geracao_llm_modo` (kill switch sem deploy).
- **Plano por fases** em [fase-camada-conversacional](./backlog-whatsapp-bot/fase-camada-conversacional.md) (CV0–CV8): fundação (gerador + validador + sombra), fallback conversacional em vendas, objeções/handoff com contexto/botões, follow-up proativo, volante de aprendizado (`perguntas_sem_resposta` + pgvector), operação como assistente, humanização fina + métricas, concierge do cliente final.
- **Seção 13 de `regras-de-negocio.md`** atualizada: resposta gerada por LLM passa por validador; reprovada → enlatada; texto gerado nunca muda estado.

---

## 2026-07-09 — Representantes comerciais e comissão configurável

### Adicionado

- **[ADR-0019](./adr/0019-representantes-e-comissao.md)** — supersede a [ADR-0011](./adr/0011-visibilidade-de-representante.md): o app passa a ser distribuído por rede de representantes. Atribuição via código `#REP-<codigo>` na primeira mensagem do lead (determinístico, sem LLM) + atribuição manual no admin; comissão gerada no webhook do Mercado Pago quando o pagamento confirma, com snapshot da regra vigente e idempotência por `comissoes.pagamento_id`.
- **Política de comissão 100% configurável no painel** — singleton `configuracoes_comissao` (tipo percentual/fixo, valor, duração em meses ou vitalícia, base valor pago/preço de tabela) + override por representante. Payout manual (`prevista → paga`) no MVP, sem split automático MP.
- **Schema** — migration `20260709000000_representantes_comissao.sql`: tabelas `representantes`, `comissoes`, `configuracoes_comissao`; `representante_id` em `leads_oficina` e `oficinas`; RPC `convert_lead_to_oficina_manual` atualizada para propagar a atribuição.
- **Painel admin** — `/admin/representantes` (CRUD + link wa.me), `/admin/comissoes` (extrato, marcar paga individual/lote), seção de comissão em `/admin/configuracoes`, campo representante no modal da oficina, card de comissão prevista no dashboard.
- **Seção 18 em `regras-de-negocio.md`** e plano em [fase-representantes-comissao](./backlog-whatsapp-bot/fase-representantes-comissao.md).

---

## 2026-06-02 — Confirmação da oficina antes de registrar a troca

### Adicionado

- **[ADR-0017](./adr/0017-confirmacao-antes-de-registrar-troca.md)** — cadastro de troca vira fluxo de dois passos: o agente mostra um resumo e marca `awaiting_confirmation`; só grava e dispara o template ao cliente após a oficina responder afirmativamente. Rede de segurança que o [ADR-0015](./adr/0015-suporte-audio-whisper.md) assumia mas que não existia.
- **`context.awaiting_confirmation`** em `lib/whatsapp/types.ts` + `handleConfirmation`/`confirmationReply`/`isAffirmativeConfirmation`/`mergeDraftCorrection` em `lib/whatsapp/onboarding-agent.ts`. Webhook inalterado (continua agindo sobre `registerServiceInput`).
- **Seção 3.4 reescrita em `regras-de-negocio.md`** — confirmação obrigatória, detecção de afirmação por whitelist de tokens, fluxo de correção via LLM.
- **Cobertura** — `tests/whatsapp-onboarding-agent.test.ts` adaptado ao fluxo de dois passos + casos de confirmação/correção; eval `tests/whatsapp-agent-evals/onboarding.json` (onb-008 confirma, onb-009 regressão do incidente Whisper). Suíte: 406 testes verde.

### Motivação (incidente)

- Cadastro por áudio em 2026-05-29: Whisper alucinou o veículo como "Não houve loucura.", o agente gravou e o template foi ao cliente final sem revisão. O ADR-0015 já aceitava o erro de transcrição assumindo correção manual da oficina — que não estava implementada.

### Correção de índice

- `docs/adr/README.md` passou a listar 0014–0017 (estava parado em 0013).

---

## 2026-05-21 — Suporte a imagem (vision) e PDF (texto) sem Storage

### Adicionado

- **[ADR-0016](./adr/0016-suporte-imagem-pdf-sem-storage.md)** — estende a ADR-0015 com pipeline próprio para imagem (gpt-4o-mini multimodal) e documento PDF (`unpdf`), mantendo a decisão de **não armazenar mídia bruta**.
- **`lib/whatsapp/image-vision.ts`** — `describeImage` com timeout, sentinela "imagem sem conteúdo extraível" → `empty`, allowlist por mime, limite de 5MB.
- **`lib/whatsapp/document-text.ts`** — `extractDocumentText` com `unpdf`, timeout, descarta PDFs escaneados (< 50 chars úteis) como `empty`, trunca em 2000 chars.
- **Branches `processImage` e `processDocument` no webhook** — análogos a `processAudio`, populam `inbound.body` com `[imagem] ...` / `[documento] ...` quando bem-sucedidos. Falha cai no fallback contextual da F0.
- **Rate limit por número de WhatsApp** — imagem + documento combinados, 50/dia por padrão (env `WHATSAPP_MEDIA_DAILY_LIMIT`). Aplicado antes da chamada paga; excedido grava `transcription_error = 'rate_limit'` e dispara fallback.
- **Novo método repository** — `countInboundMediaInLastDay({ whatsappFrom })`. Opcional na interface (mocks de teste continuam compatíveis sem implementá-lo).
- **Captura de `caption` e `mime_type`** no parser de payload para image/document.
- **Seções 17.7, 17.8, 17.9 em `regras-de-negocio.md`** — política de imagem, fallback genérico e rate limit.
- **Runbook `docs/runbooks/whatsapp-media-metrics.md`** — queries SQL para volume, distribuição de status, custo estimado, top oficinas, rate limit, latência, mídia caída no fallback.
- **Cobertura de testes** — `tests/whatsapp-image-vision.test.ts`, `tests/whatsapp-route-image.test.ts`, `tests/whatsapp-document-text.test.ts`, `tests/whatsapp-route-document.test.ts`. Total: 334 testes verde, lint limpo.

### Decisões registradas em ADR-0016

- **Sem Supabase Storage** — bytes são processados em memória e descartados. Confirma e expande ADR-0015 ponto 2.
- **`gpt-4o-mini` para vision** — mesma família dos classificadores em uso.
- **`unpdf` para PDF** — pure-JS, sem binário, funciona em runtime serverless.
- **Sem fallback vision em PDF escaneado** — evita custo imprevisível em PDFs grandes. Fica como melhoria futura.
- **Reaproveitamento de `unsupported-media-fallbacks.ts`** — copy já cobre image e document. Sem duplicar lógica.
- **Rate limit apenas em imagem+documento** — Whisper é mais barato e não precisa.

---

## 2026-05-21 — F0: fallback universal para mídia não suportada

### Adicionado

- **Migration `20260525000000_mensagens_media_types_extra.sql`** — amplia `mensagens_media_type_check` para aceitar `image`, `document`, `sticker`, `video`, `location`, `contacts`, `unsupported` (antes só `text`/`audio`).
- **`lib/whatsapp/unsupported-media-fallbacks.ts`** — mensagens fixas por `(agent_mode, mediaType)` para tipos sem pipeline próprio. Estilo espelha `audio-fallbacks.ts`.
- **`lib/whatsapp/payload.ts`** — `extractInboundMessages` agora emite `mediaType` para todos os tipos conhecidos do WhatsApp Cloud API (em vez de descarte silencioso). Tipos desconhecidos viram `unsupported`.
- **`InboundMediaType`** estendido em `types.ts` para o conjunto completo.
- **Branch de fallback em `webhook-handler.ts`** — quando `mediaType` ≠ `text`/`audio`, persiste o inbound, envia fallback contextual e pula o agente.
- **Seção 17.7 em `docs/regras-de-negocio.md`** — política de fallback de mídia.
- **Cobertura de testes** — `tests/whatsapp-payload-audio.test.ts` (estendido) e `tests/whatsapp-route-unsupported-media.test.ts` (novo).

### Por que

ADR-0015 deixou explícito que image/document/sticker/etc. ficavam fora do MVP. Na prática, o bot ficava **mudo** para esses tipos — pior cenário de UX. F0 elimina o silêncio sem decidir nada sobre processamento de imagem/PDF (essa decisão fica para ADR-0016).

### Próxima fase

- **ADR-0016** — decide pipeline próprio para imagem (vision) e PDF (extração de texto), mantendo a decisão da ADR-0015 de não armazenar mídia bruta.

---

## 2026-05-21 — Suporte a áudio via Whisper (Fase 5)

### Adicionado

- **[ADR-0015](./adr/0015-suporte-audio-whisper.md)** — bot passa a aceitar notas de voz e arquivos de áudio, transcritos via OpenAI Whisper (`whisper-1`, `language: "pt"`) de forma síncrona dentro do webhook, timeout 15s.
- **[Fase 5 do backlog](./backlog-whatsapp-bot/fase-5-audio.md)** — escopo, decisões e critérios de aceite.
- **Migration `20260524000000_phase_5_audio_transcription.sql`** — colunas em `mensagens`: `media_type`, `media_id`, `transcription`, `transcription_status`, `transcription_error`, `audio_duration_ms`.
- **`lib/whatsapp/transcription.ts`** — helper `transcribeAudio` com timeout duro e discriminated union (`success`/`empty`/`timeout`/`failed`).
- **`lib/whatsapp/audio-fallbacks.ts`** — mensagens de fallback contextuais por `agent_mode`, enviadas quando a transcrição não tem sucesso.
- **`WhatsAppCloudApiClient`** — métodos `getMediaMetadata` e `downloadMedia` (Graph API v20, mesmo `WHATSAPP_ACCESS_TOKEN`).
- **Seção 17 em `docs/regras-de-negocio.md`** — política de áudio.

### Decisões registradas em ADR-0015

- **Síncrono** dentro do webhook (sem fila/worker), timeout 15s.
- **Não armazenar o áudio bruto** — só a transcrição. Sem dependência de Supabase Storage.
- **Fallback contextual por agente** — vendas, onboarding, operação, lembrete, suporte e cobrança têm cada um seu próprio texto.
- **Idioma fixo `pt`**, sem auto-detect.
- **Lead e oficina** ambos transcritos, sem distinção.

### Não muda

- ADR-0001 (LLM não decide estado), ADR-0004 (webhook persiste antes de processar), ADR-0006 (idempotência via `provider_event_id`) seguem valendo. Transcrição é dado de entrada, idempotência herdada do `provider_event_id`.

---

## 2026-05-23 — Cadência/template por tipo + FAQ amortecedor + dashboard mercado (Fases 2-4)

### Adicionado

- **`tipos_servico_default`** (migration `20260522000000_tipos_servico_default.sql`): tabela global com cadência (`dias_lembrete`) e template Meta (`template_name`/`template_language`) por tipo. Seed: óleo=90d, amortecedor=730d, revisão=180d, outro=180d.
- **`enqueue_due_whatsapp_reminders` recriado** para resolver template, idioma e body dinamicamente via join com `tipos_servico_default`. Worker passou a ler `templateName`/`templateLanguage` do dequeue em vez do hard-code.
- **`/admin/tipos-servico`** — painel para o admin editar cadência e template_name por tipo, com auditoria. Auditoria grava em `admin_audit_log` como `tipo_servico.update`.
- **FAQ `serve_para_outros_servicos`** (migration `20260523000000_faq_serve_outros_servicos.sql`) — vendedor responde quando lead pergunta sobre outros serviços (amortecedor, revisão, alinhamento, etc.). Saudação inicial **não muda** — pitch principal continua focado em óleo.
- **`/admin/inteligencia-mercado`** — dashboard com mix por tipo, market-share Perfect/Monroe/Cofap/Nakata, top cidades e cohort Perfect. Filtros de período e cidade.
- **[ADR-0014](./adr/0014-cadencia-e-template-por-tipo-de-servico.md)** — Cadência e template Meta por tipo de serviço.

### Decidido

- **Cadência global, sem override por oficina no MVP** — admin altera, valor vale pra todas as oficinas. Override fica como evolução futura.
- **Anti-viés Perfect** vira regra escrita: ordem alfabética em qualquer UI ou pergunta de marca (Cofap, Monroe, Nakata, outra, Perfect). Dashboard admin-only, sem compartilhamento externo sem revisão jurídica.
- **Fallback do scheduler** continua sendo `oficinas.dias_lembrete_padrao` + `lembrete_troca_oleo` quando linha em `tipos_servico_default` está desativada — preserva continuidade.

### Pendências externas

- **Aprovação Meta** dos templates `lembrete_amortecedor` e `lembrete_revisao_geral` é pré-requisito pra ativar os tipos `amortecedor` e `revisao`/`outro` em produção. Enquanto não aprovado, manter `ativo=false` nessas linhas ou aceitar envios falhando com `132001` (template inexistente).

---

## 2026-05-21 — Tipo de serviço estruturado (Fase 1 de "3 níveis de produto")

### Adicionado

- **`servicos.tipo_servico`** (enum fechado `troca_oleo | amortecedor | revisao | outro`, default `troca_oleo`) e **`servicos.marca_peca`** (nullable, enum fechado `perfect | monroe | cofap | nakata | outra`) na migration `20260521000000_tipo_servico_marca_peca.sql`. Constraint garante que `marca_peca` só é populada quando `tipo_servico = 'amortecedor'`.
- **Pergunta ativa de marca** no `onboarding-agent` quando `tipo='amortecedor'` e marca ausente. Lista alfabética (Cofap, Monroe, Nakata, Perfect, outra) — Perfect nunca primeiro, para evitar viés.
- **Índice `servicos_tipo_servico_idx`** preparando dashboard de inteligência de mercado (Fase 4 do mesmo plano).

### Decidido

- **Posicionamento estratificado**: troca de óleo continua sendo o carro-chefe da comunicação. Amortecedor é vitrine de coleta de dados (parceria estratégica com marca Perfect). Revisão/outros são catch-all.
- **LLM classifica, backend valida**: agente extrai `tipo_servico` e `marca_peca` do texto, mas backend reforça enum (ADR-0001 preservado).
- **Cadência e templates por tipo virão na Fase 2** — esta fase deixa o dado estruturado sem mudar comportamento de lembrete (continua 90 dias + template óleo).

### Próximo

- Fase 2: tabela `tipos_servico_default` + cadência/template por tipo + admin `/tipos-servico`. Bloqueada por aprovação Meta de 2 templates novos (`lembrete_amortecedor`, `lembrete_revisao_geral`).
- Fase 3: FAQ `serve_para_outros_servicos` no vendedor.
- Fase 4: dashboard `/admin/inteligencia-mercado`.

---

## 2026-05-17 — Painel admin especificado (ADR-0013, PRD, backlog dedicado)

### Adicionado

- **[ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md)** — Painel admin: escopo, billing mensal recorrente, auto-pausa por inadimplência, MRR em tempo real, auditoria obrigatória. Fecha as decisões que sobravam após ADR-0010/0012.
- **[PRD do painel admin](./product/PRD-painel-admin.md)** — canônico. 7 telas, fluxos, modelo de dados, RNFs, critérios de aceite.
- **[Backlog do painel admin](./backlog-painel-admin/README.md)** — 7 sub-fases (Admin-0 a Admin-6), cada uma mergeavel separadamente.

### Decidido

- **URL**: `/admin/*` no mesmo domínio Next.js. Sessão admin separada via cookie distinto.
- **Status oficina**: mantém enum atual (`ativa/pausada/cancelada`). Adiciona campo novo `motivo_pausa` (`inadimplencia | voluntaria | admin`).
- **Cadastro manual de oficina**: admin pode criar oficina pelo painel com `origem='manual'`.
- **Billing**: mensal recorrente. Cron diário gera preferência Mercado Pago e envia link por WhatsApp. Sem Subscription API (suporta Pix recorrente).
- **Inadimplência**: auto-pausa após 7 dias (configurável). Bot responde com mensagem padrão de cobrança em vez de operar.
- **Preço negociado**: sem expiração — vale até admin mudar.
- **MRR**: query em tempo real (rever quando passar de ~500 oficinas).
- **Notificações para admin**: só na tela.
- **Impersonate**: fora do MVP.
- **Seeds**: Anderson como único admin inicial, 1 plano placeholder editável.

### Implicações para implementação

- Nova migration em Admin-0: cria `planos`, `admin_users`, `admin_audit_log`, `pagamentos`, `cobranca_jobs`; adiciona `motivo_pausa`, `proximo_vencimento`, `plano_id`, `preco_negociado` em `oficinas`.
- Pequena alteração em [conversation-router.ts](../lib/whatsapp/conversation-router.ts) para tratar oficinas pausadas por inadimplência (Admin-6).
- Novo template Meta categoria "Utility" (`WHATSAPP_TEMPLATE_COBRANCA_NAME`) — solicitar com antecedência.
- Reuso do template OTP existente para login admin.
- Fase 4F do bot WhatsApp ([fase-4-retorno-dashboard.md](./backlog-whatsapp-bot/fase-4-retorno-dashboard.md)) é **substituída e expandida** pelo backlog do painel admin. Manter Fase 4F como referência, mas execução real segue o backlog novo.

Nenhum código alterado nesta entrega — só documentação. Implementação real começa em Admin-0.

### Pendências externas registradas

- WhatsApp do Anderson para seed de `admin_users` em Admin-0: **`+5511945207618`** (confirmado 2026-05-17).
- Template Meta categoria "Utility" para cobrança (`WHATSAPP_TEMPLATE_COBRANCA_NAME`) — a solicitar quando se aproximar de Admin-6 (ciclo Meta leva horas/dias).
- `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET` — placeholder em `.env.local.example` e no runbook. Anderson preenche valores reais quando chegar em Admin-6.

---

## 2026-05-17 — Docs alinhados com as ADRs 0008, 0009, 0010, 0012

### Mudou

- **`docs/product/PRD-whatsapp-bot.md §12` (Fluxo 6 — Cliente Final Responde)** — reescrito para refletir o handoff via `wa.me` da [ADR-0009](./adr/0009-confirmacao-vs-pre-agendamento.md). Removido o exemplo de `status_conversa = agendado` e `data_agendada`. Adicionado padrão das duas mensagens (cliente → atendente, atendente → cliente).
- **`docs/backlog-whatsapp-bot/fase-3-lembretes-reais.md`** — `lembretes.status` perdeu `agendado` e ganhou `handoff_iniciado`. Regras de resposta do cliente reescritas: toda intenção de agendar/perguntar preço/disponibilidade vira handoff `wa.me`. Adicionada tarefa de criar `oficinas.whatsapp_atendente`. Seção de handoff documenta os templates das duas mensagens.
- **`docs/backlog-whatsapp-bot/fase-4-retorno-dashboard.md`** — login do painel mudou de Supabase Auth Phone OTP por SMS para **OTP via WhatsApp** (template Meta Authentication) — ADR-0010. Adicionadas sub-fases **4F (painel admin + planos)** e **4G (Mercado Pago)**. `create_retorno` não escreve mais `lembretes.status = agendado`. Riscos e testes atualizados.
- **`.codex/prompts/whatsapp-reminder-agent.md`** — reescrito. Classificador inclui `pergunta_disponibilidade`. Comportamento de handoff `wa.me` documentado com templates de mensagens pré-preenchidas. Bot nunca confirma agenda nem cita preço.
- **`.codex/prompts/whatsapp-sales-agent.md`** — adicionada regra de preço (ADR-0012): bot não cita valor; primeira menção vira redirect para teste grátis; insistência vira handoff `wa.me` para WhatsApp comercial.

### Pendências de implementação que estes docs deixam claras

- `oficinas.whatsapp_atendente` (Fase 3) — schema + UI nas configurações.
- Tabela `auth_otps` + template Meta Authentication aprovado (Fase 4A).
- Tabela `planos` + `oficinas.plano_id` + `oficinas.preco_negociado` (Fase 4F).
- Tabelas `admin_users` + `admin_audit_log` + painel `/admin` (Fase 4F).
- Tabela `pagamentos` + webhook Mercado Pago + integração no fluxo de conversão (Fase 4G).

Nenhum código foi alterado — só documentação. Implementação real entra nas respectivas fases.

---

## 2026-05-17 — Todas as ADRs em aberto decididas

### Decidido

- **[ADR-0007](./adr/0007-provedor-whatsapp-business-cloud.md)** — Provedor WhatsApp: Meta Business Cloud API direta (sem BSP intermediário). Implementação já está nessa base desde a Fase 1; decisão formaliza o caminho.
- **[ADR-0008](./adr/0008-pagamento-no-mvp.md)** — Pagamento integrado via Mercado Pago. Implementação pendente.
- **[ADR-0009](./adr/0009-confirmacao-vs-pre-agendamento.md)** — Bot não se envolve em agendamento. Detecta intenção de agendar e gera duas mensagens com link `wa.me` clicável: uma para o cliente (chamar o atendente), outra para o atendente (chamar o cliente). Substitui o fluxo de `status = agendado` previsto no PRD §12.
- **[ADR-0010](./adr/0010-painel-web-no-mvp.md)** — Painel web mínimo (4 telas) na Fase 4. Login passwordless via OTP enviado por WhatsApp. Exige template de Authentication aprovado pela Meta.
- **[ADR-0011](./adr/0011-visibilidade-de-representante.md)** — Não rastrear representante no MVP. Todo lead com `origem = landing_page`.
- **[ADR-0012](./adr/0012-politica-de-preco.md)** — Plano único, preço variável por oficina, armazenado no banco e editável via painel admin separado (para devs/fundadores/donos). Bot vendedor não cita preço — conduz para teste grátis ou handoff humano.

### Implicações para implementação

Mudanças no modelo de dados decorrentes (a implementar em fase específica, não agora):

- `oficinas.whatsapp_atendente` para o ping de handoff (ADR-0009).
- `lembretes.status` enum simplificado (remover `agendado`, ADR-0009).
- Tabela `auth_otps` + sessão para login do painel (ADR-0010).
- Tabela `planos` + `oficinas.plano_id` + `oficinas.preco_negociado` (ADR-0012).
- Tabela `admin_users` + `admin_audit_log` para painel admin (ADR-0012).
- Template Meta categoria "Authentication" para OTP (ADR-0010).

### Pendente de reflexão nos docs

Estes docs ainda descrevem o fluxo antigo e precisam de revisão no momento da implementação:

- `docs/product/PRD-whatsapp-bot.md §12` (Fluxo 6 — substituído por ADR-0009).
- `docs/backlog-whatsapp-bot/fase-3-lembretes-reais.md` (ajustar para handoff em vez de `agendado`).
- `docs/backlog-whatsapp-bot/fase-4-retorno-dashboard.md` (ajustar para painel mínimo + OTP + admin panel).
- `.codex/prompts/whatsapp-reminder-agent.md` (novo comportamento de handoff).
- `.codex/prompts/whatsapp-sales-agent.md` (não cita preço).

---

## 2026-05-17 — Estrutura de context engineering instalada

### Adicionado

- `CLAUDE.md` na raiz, complementar a `AGENTS.md`.
- `docs/README.md` como índice navegável.
- `docs/glossary.md` consolidando 15+ termos de domínio.
- `docs/adr/` com 6 ADRs retroativas (decisões já vigentes, agora documentadas) e 6 ADRs draft (perguntas em aberto do PRD §24).
- `docs/runbooks/` com índice + 4 runbooks: Meta setup, env setup, Supabase migrations, deploy Vercel.
- `docs/CONTEXT_CHANGELOG.md` (este arquivo).

### Mudou

- Reorganização de docs em `docs/product/`, `docs/architecture/`, `docs/adr/`, `docs/runbooks/`.
- `PRD.md` → `docs/product/PRD-landing-prototype.md`.
- `PRD_WHATSAPP_BOT_REAL.md` → `docs/product/PRD-whatsapp-bot.md`.
- `copy.md` → `docs/product/copy.md` (continua gitignored).
- `design-system.md` → `docs/product/design-system.md` (continua gitignored).
- `docs/telas-web.md` → `docs/product/telas-web.md`.
- `docs/whatsapp-bot-technical-plan.md` → `docs/architecture/whatsapp-bot-technical-plan.md`.
- `docs/meta-whatsapp-configuracao.md` → `docs/runbooks/meta-whatsapp-setup.md`.
- Convenção de idioma: AGENTS/CLAUDE/ADRs em inglês; resto em português.

### Em aberto

6 decisões formalizadas em ADRs draft (ver `docs/adr/`):

- 0007 — Provedor WhatsApp para a primeira versão.
- 0008 — Pagamento dentro do fluxo ou manual no MVP.
- 0009 — Agente pode confirmar agenda ou apenas pré-agendar.
- 0010 — Painel web no MVP ou tudo começa pelo WhatsApp.
- 0011 — Representante comercial terá visão própria dos leads.
- 0012 — Política de preço/plano usada pelo agente vendedor.

---

## 2026-04-26 — Fases 1, 2 e 3 implementadas

### Adicionado

- Prompts dos 3 agentes consolidados em `.codex/prompts/`: vendas, onboarding, reminder.
- Fase 1 (bot vendedor), Fase 2 (conversão e onboarding) e Fase 3 (lembretes reais) implementadas.
- Resumo consolidado em `docs/backlog-whatsapp-bot/fases-1-2-e-3-resumo-implementacao.md`.

### Em aberto na época

- Fase 4 (retorno e dashboard) ainda em planejamento.

---

## 2026-04-25 — Bases do produto real

### Adicionado

- `PRD_WHATSAPP_BOT_REAL.md` aprovado (status "Implementação Real", v1.0). Define visão dual (vendas + operacional), 7 fluxos, modelo de dados, agentes, compliance.
- Plano técnico publicado em `docs/whatsapp-bot-technical-plan.md`. Recomenda Next.js + Supabase + Cloud API + OpenAI Structured Outputs.
- `design-system.md` documenta identidade visual "Perfect Automotive" para a landing.
- `docs/telas-web.md` propõe painel operacional para a oficina.
- `docs/meta-whatsapp-configuracao.md` consolida setup operacional da Meta.

### Decidido

- Stack: Next.js 15 + React 19 + Supabase (Postgres, Auth, RLS, Queues, Cron) + OpenAI Responses API + Meta WhatsApp Cloud API.
- Multi-tenancy: RLS por `oficina_id`.
- LLM gera texto e interpreta, mas não decide estado.
- Roteamento via `agent_mode` + `participant_type` antes de invocar LLM.
- Mensagens fora da janela de 24h via templates aprovados pela Meta.

---

## 2026-04-24 — Protótipo de validação aprovado

### Adicionado

- `PRD.md` aprovado para execução (status "Aprovado para execução", v1.0). Protótipo frontend-only para validação comercial com 3–5 oficinas.

### Decidido

- Escopo do protótipo: simulação completa do fluxo (cadastro, lembretes, conversas) sem backend nem WhatsApp real.
- Resultado da validação informa a decisão de seguir com a implementação real.
