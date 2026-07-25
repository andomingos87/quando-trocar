# Regras de Negócio · Quando Trocar

Índice consolidado das regras de negócio do produto. **Não é fonte canônica** — cada regra cita o documento original (ADR, PRD, código) que decide. Use este doc para localizar a regra; aprofunde na fonte.

Quando uma regra mudar, mude na fonte canônica primeiro e atualize este índice depois (ou registre no [Context Changelog](./CONTEXT_CHANGELOG.md)).

---

## ⚠️ Quando atualizar este doc

Este doc precisa refletir o código. **Toda alteração que muda comportamento do produto** deve atualizar a entrada correspondente aqui — **no mesmo commit/PR que muda o código**, não depois.

### Dispara atualização

- Novo `status`, `intent`, `agent_mode`, `participant_type`, `motivo_pausa` ou qualquer enum de negócio.
- Novo guardrail ou bloqueio do bot (ex: nova regra de quando não enviar lembrete).
- Mudança em fluxo conversacional (ordem de perguntas, nova pergunta, novo follow-up).
- Mudança em transição de status (quem pode virar o quê, em qual condição).
- Nova fórmula ou threshold (ex: mudou taxa de ROI de 10% para outro número, mudou dias de grace de inadimplência).
- Novo trigger de opt-out, número errado, handoff.
- Nova tabela, novo campo obrigatório, ou mudança em campo já listado.
- Nova regra de billing, cobrança, vencimento, pausa.
- Nova proibição do bot (entra em "13. Comportamento do bot").
- Novo template Meta ou mudança na lógica de janela 24h.

### Não dispara atualização

- Refactor sem mudança de comportamento.
- Rename de variável/arquivo.
- Fix de bug que restaura o comportamento já documentado.
- Otimização de performance que não muda saída.
- Mudança em teste sem mudar a regra testada.
- Mudança em UI/copy sem mudar regra de negócio.
- Mudança em dependência (lib, versão).

### Em caso de dúvida

**Pergunte ao usuário antes de implementar a mudança no código.** Pergunta padrão:

> "Essa mudança em [arquivo/feature] altera a regra X de regras-de-negocio.md? Atualizo o doc junto?"

O usuário decide. Não atualize por conta própria nem ignore por conta própria.

### Como atualizar

1. Localize a seção (use o sumário abaixo).
2. Edite a entrada — mantenha o estilo: regra clara + citação da fonte canônica.
3. Se for regra estrutural (novo princípio, nova proibição global), registre em [`docs/CONTEXT_CHANGELOG.md`](./CONTEXT_CHANGELOG.md).
4. Se for mudança grande sem ADR ainda, **crie a ADR antes** de documentar aqui.

---

## Sumário

- [Princípios fundamentais](#princípios-fundamentais)
- [1. Vendas e ciclo do lead](#1-vendas-e-ciclo-do-lead)
- [2. Conversão (lead → oficina)](#2-conversão-lead--oficina)
- [3. Onboarding e operação](#3-onboarding-e-operação)
- [4. Lembretes automáticos](#4-lembretes-automáticos)
- [5. Cliente final responde](#5-cliente-final-responde)
- [6. Retorno e receita](#6-retorno-e-receita)
- [7. Consentimento e opt-out](#7-consentimento-e-opt-out)
- [8. WhatsApp e Meta (janela, templates)](#8-whatsapp-e-meta-janela-templates)
- [9. Preço, planos e billing](#9-preço-planos-e-billing)
- [10. Inadimplência e pausa de oficina](#10-inadimplência-e-pausa-de-oficina)
- [11. Painel admin e auditoria](#11-painel-admin-e-auditoria)
- [12. Multi-tenancy e segurança](#12-multi-tenancy-e-segurança)
- [13. Comportamento do bot (resumo das proibições)](#13-comportamento-do-bot-resumo-das-proibições)
- [14. Modo suporte (`agent_mode='suporte'`)](#14-modo-suporte-agent_modesuporte)
- [15. Modo cobrança (`agent_mode='cobranca'`)](#15-modo-cobrança-agent_modecobranca)
- [16. Inteligência de mercado](#16-inteligência-de-mercado)
- [17. Áudio e transcrição](#17-áudio-e-transcrição)
- [18. Representantes e comissão](#18-representantes-e-comissão)
  - [18.7 Portal do representante](#187-portal-do-representante)

---

## Princípios fundamentais

Quatro invariantes que valem em todo o sistema. Se uma regra parece conflitar com elas, a regra está errada.

### P1. LLM é conselheiro, nunca decisor
- A IA pode **classificar intenção** e **extrair dados estruturados**.
- A IA **nunca** muda sozinha: `lead.status`, `participant_type`, `agent_mode`, estado de pagamento, opt-out, status de lembrete.
- Toda transição de estado passa por regra determinística no backend.
- Fonte: [ADR-0001](./adr/0001-llm-como-conselheiro-nao-decisor.md), [`AGENTS.md §OpenAI Agent Rules`](../AGENTS.md)

### P2. Identidade vem do banco, não do LLM
- `participant_type` e `agent_mode` são resolvidos em `lib/whatsapp/conversation-router.ts` **antes** de invocar OpenAI.
- O prompt recebe o modo pronto. LLM nunca decide quem é a contraparte.
- Fonte: [ADR-0002](./adr/0002-roteamento-via-agent-mode.md)

### P3. Multi-tenancy via RLS por `oficina_id`
- Toda tabela de dados de oficina tem `oficina_id` + policy RLS.
- `SUPABASE_SERVICE_ROLE_KEY` é server-side only — usada apenas em rotas API, workers, scheduler.
- Fonte: [ADR-0003](./adr/0003-multi-tenancy-via-rls-oficina-id.md), [`AGENTS.md §Supabase Rules`](../AGENTS.md)

### P4. Idempotência via provider IDs
- Webhook do WhatsApp pode repetir o mesmo evento.
- Não criar lead/mensagem/serviço/lembrete duplicado. Unicidade por `provider_event_id` e `whatsapp_message_id` no banco.
- Fonte: [ADR-0006](./adr/0006-idempotencia-via-provider-ids.md)

---

## 1. Vendas e ciclo do lead

### 1.0 Escopo do produto na conversa (ciclo 5)
O bot fala "qualquer peça ou serviço automotivo com retorno previsível" — óleo, amortecedor, filtro, revisão, alinhamento, freio. Não restringe a troca de óleo. Suportado no banco via `TipoServico` enum (`troca_oleo · amortecedor · revisao · outro`).

### 1.1 Origem do lead
- Frases-gatilho que marcam `origem = landing_page` são configuráveis em `configuracoes_vendedor.frases_landing` (painel admin). Default: `"oi quero testar o quando trocar"`.
- Qualquer outra primeira mensagem → `origem = manual_whatsapp`.
- Fonte: [PRD §6](./product/PRD-whatsapp-bot.md), `detectLeadOrigin()` em `lib/whatsapp/sales-agent.ts`, `/admin/configuracoes`.

### 1.2 Estados do lead
Enum em `leads_oficina.status`:

```
novo · em_conversa · qualificado · interessado · teste_aceito · convertido · perdido
```

Intents que o vendedor classifica (`SalesIntent`):

```
pergunta_funcionamento · informa_volume_ticket · pergunta_preco · pergunta_faq · small_talk · social_test · confirmacao_neutra · vai_pensar · quer_humano · quer_testar · sem_interesse · fora_escopo
```

**Ordem de detecção em `classifySalesMessage`** (atualizada ciclo 4):
1. `isExplicitLossMessage` → `sem_interesse` (vence tudo, até dor).
2. **`detectPain` → `pergunta_funcionamento`** (override forte).
3. **`detectQuerHumano` → `quer_humano`**.
4. **`detectVaiPensar` → `vai_pensar`**.
5. **`detectBasicGreeting` → `fora_escopo`** (confidence 0.9). Saudação simples e body vazio.
6. **`detectNeutralAck` → `confirmacao_neutra`** (vem antes do social_test pra "blz" não cair como social).
7. **`detectSocialTest` → `social_test`** (mensagens ≤3 chars não-cobertas, "kkkk", "testando").
8. `detectPriceQuestion` → `pergunta_preco`.
9. `extractVolumeOrTicket` → `informa_volume_ticket`.
10. Regex de funcionamento → `pergunta_funcionamento`.
11. Regex de interesse → `quer_testar`.
12. **`detectSmallTalk` → `small_talk`** (off-topic explícito: time, futebol, piada).
13. `matchFaq` → `pergunta_faq`.
14. Default → `fora_escopo`.

Há um segundo gate dentro de `WhatsappSalesAgent.generateReply`: se o OpenAI fallback classificar como `sem_interesse` mas a mensagem disparar `detectPain` sem `isExplicitLossMessage`, o agente sobrescreve para `pergunta_funcionamento`.

Transições válidas (decisão determinística, não LLM):

| Intent classificado | Status resultante | Regra determinística |
|---|---|---|
| `pergunta_funcionamento` | `em_conversa` | sempre; copy curta na 2ª aparição (`funcionamento_explained`) |
| `informa_volume_ticket` | `qualificado` | quando há volume + ticket válidos (memorizados ao longo de várias mensagens) |
| `pergunta_preco` | mantém status atual | nunca rebaixa lead; incrementa contador; se memória tem volume+ticket, conecta com ROI |
| `pergunta_faq` | mantém status atual | resposta vem de `faq_vendas` por match de palavra-chave. **Objeções** (CV3) são modeladas como linhas de `faq_vendas` (editáveis no admin, sem coluna `tipo`): "não tenho tempo", "cliente não usa WhatsApp", "já controlo no caderno", "vai achar chato/spam" → contorno + CTA de teste, respondidas aqui mesmo em vez de cair no `fora_escopo` |
| `small_talk` | mantém status atual | resposta curta de redirect; não conta como fallback |
| `social_test` | mantém status atual | "kkkk", "testando", mensagens muito curtas; resposta paciente (5 variações rotacionadas); **conta como fallback** |
| `confirmacao_neutra` | mantém status atual | "ok"/"blz"/"entendi"; resposta curta se já explicou, senão cai pro fluxo padrão |
| `vai_pensar` | mantém status atual | "vou pensar"/"depois te falo"; copy "sem pressa", sem handoff |
| `quer_humano` | mantém status atual | "passa pro Anderson"; **handoff direto** com `wa.me` |
| `quer_testar` | `teste_aceito` | **pergunta o nome da oficina** e aguarda a resposta (`sales.awaiting_workshop_name`); só dispara a conversão quando o nome é capturado |
| `sem_interesse` | `perdido` | **só** se mensagem passa em `isExplicitLossMessage()` |
| `fora_escopo` | mantém status atual | nunca rebaixa lead `interessado`; copy curta na 2ª aparição; **caso geral vira faixa livre** ([ADR-0024](./adr/0024-respond-em-vendas.md)): a camada de geração responde grounded (modo respond) com a enlatada do pool como fallback — sub-caminhos (saudações, lead `interessado`, handoff ≥7) seguem determinísticos |

**Saudação no primeiro turno:** quando `context.sales.greeted !== true`, as respostas de `pergunta_funcionamento` e `fora_escopo` (que são os "explicadores") recebem o prefixo *"Fala chefe! Aqui e do Quando Trocar — a gente faz o cliente que troca oleo (ou faz revisao) voltar pro proximo servico."*. Flag persistida no contexto.

**Saudação subsequente (ciclo 4):** quando `memory.greeted === true` e o lead manda outra saudação ("bom dia", "tudo bem?"), o bot responde com uma das **5 variações** sociais em vez de repetir o explicador. Não conta como fallback.

**Contador `consecutive_fallback` (ciclo 4):** incrementado a cada `fora_escopo` ou `social_test` consecutivo; resetado por qualquer outro intent. Ao atingir **7**, dispara handoff automático para o WhatsApp comercial com `handoffReason = "fallback_loop"`. As 5 variações de `FALLBACK_VARIATIONS` rotacionam baseadas nesse contador. **O contador nunca reage à camada de geração** ([ADR-0024](./adr/0024-respond-em-vendas.md)): incrementa mesmo quando o respond respondeu bem — `off`/`sombra`/`on` só podem diferir no texto enviado, nunca no estado.

**Botões interativos no fallback nível 2 (CV3):** no slot do menu da rotação (`FALLBACK_VARIATIONS[1]`), em vez do menu de texto o bot envia **reply buttons** da Cloud API (máx 3: "Como funciona", "Quanto custa", "Quero testar"). O clique volta como `button_reply.id` **determinístico**, mapeado para a mensagem canônica em `lib/whatsapp/sales-buttons.ts` (id → intent, **sem LLM**), eliminando erro de classificação de texto livre. É determinístico — **não** marca respond e não altera o contador (idêntico ao caminho de texto). Quando o transporte não suporta botões, degrada para o menu de texto. Fonte: `lib/whatsapp/sales-buttons.ts`, `sendInteractiveButtons` em `lib/whatsapp/whatsapp-client.ts`.

- Fonte: [PRD §8](./product/PRD-whatsapp-bot.md), [`.codex/prompts/whatsapp-sales-agent.md`](../.codex/prompts/whatsapp-sales-agent.md), `lib/whatsapp/sales-agent.ts`.

### 1.3 Cálculo de ROI exibido ao lead
- Fórmula: `receita_recuperada = serviços_mês × ticket_médio × taxa_recuperacao_roi`.
- **Taxa default: 15%**, configurável no painel em `configuracoes_vendedor.taxa_recuperacao_roi`.
- Bot apresenta como tendência ("oficinas do seu tamanho costumam trazer de volta uns X%"), não como promessa.
- **Ciclo 5 — caminho B (sem fricção):** o bot **NÃO pergunta** volume/ticket na abertura. A abertura termina com CTA pros 14 dias grátis. O ROI só é calculado quando o lead voluntariamente passa os números numa mensagem.
- Volume + ticket podem ser informados em mensagens separadas — o bot memoriza no `conversas.context.sales`.
- Quando o lead dá só um dos dois, o bot pergunta o complemento **com saída fácil pro teste** ("sem stress — bora pro teste de 14 dias grátis").
- Body do ROI fala "**serviços/mês**" (não "trocas/mês"), refletindo o escopo amplo.
- Registrado em `agent_tool_calls` como `calculate_roi`.
- Fonte: [PRD §7](./product/PRD-whatsapp-bot.md), `calculateRoi()` em `lib/whatsapp/sales-agent.ts`, `/admin/configuracoes`.

### 1.4 Bot vendedor — política de preço
- Bot **fala valor de partida** ("a partir de R$ X"), nunca o valor final. Fonte do número: `planos.preco_base` do plano default (gerenciado em `/admin/planos`). Default seedado: R$ 59,00.
- Primeira pergunta de preço → resposta com "a partir de R$ X" + redirect pro teste grátis. Contador `sales.price_mentions` é incrementado.
- Segunda pergunta de preço (insistência) → handoff `wa.me` para WhatsApp comercial. Número configurado em `configuracoes_vendedor.whatsapp_handoff_comercial`.
- Bot nunca diz "depende", nunca dá faixa, nunca compromete o valor final.
- Fonte: [ADR-0012](./adr/0012-politica-de-preco.md), [`.codex/prompts/whatsapp-sales-agent.md`](../.codex/prompts/whatsapp-sales-agent.md).

### 1.5 Resumo de handoff para o comercial (CV3)
- Quando o agente de vendas decide **handoff** (`handoffRequired` — preço insistente, pedido de humano, rede/franquia, volume alto ou loop de fallback), o backend gera um **resumo de 3 linhas** da conversa (LLM) e o envia ao `configuracoes_vendedor.whatsapp_handoff_comercial`.
- **Uso interno** — vai para o humano do comercial, **nunca** para o lead. Não decide estado (ADR-0001): o handoff já foi decidido pelo backend determinístico.
- **Best-effort**: falha de geração/envio/timeout **não bloqueia** o handoff (o link `wa.me` já foi entregue ao lead). Auditado em `agent_tool_calls` (`handoff_summary`).
- **Só com a camada de geração ativa** (`geracao_llm_modo != 'off'`) — em `off`, comportamento idêntico ao anterior (nenhuma chamada de LLM nova).
- Fonte: `lib/whatsapp/handoff-summary.ts`, [`.codex/prompts/whatsapp-handoff-summary.md`](../.codex/prompts/whatsapp-handoff-summary.md), [ADR-0020](./adr/0020-camada-geracao-conversacional.md).

### 1.5 FAQ do vendedor
- Perguntas comuns vivem em `faq_vendas` (gerenciada em `/admin/faq`).
- Match por palavra-chave (prioritário): para cada FAQ ativa, conta quantas `palavras_chave` aparecem na mensagem normalizada (sem acento, lower-case). FAQ com mais matches vence; empate desempata pela menor `ordem`.
- **Busca semântica (CV5, fallback):** quando o match por keyword falha, o bot gera um embedding da mensagem (OpenAI `text-embedding-3-small`, 1536d) e busca a FAQ mais parecida por similaridade de cosseno (RPC `match_faq_vendas`, threshold configurável). Isso pega paráfrase que a keyword não cobre ("quanto sai por mês?" acha a FAQ de preço mesmo sem a keyword "custa"). **Best-effort:** sem embedding/erro, cai no match por keyword. O embedding de cada FAQ é gerado no save do admin (também best-effort).
- Cache de 60s no agente (`SupabaseWhatsappRepository.listActiveFaqs`). Edições no admin demoram até 1 minuto pra refletir no bot.
- Tool call registrada como `faq_lookup`.
- **Escopo amplo na saudação (revisado ciclo 5):** a saudação inicial **menciona o escopo completo** — óleo, amortecedor, filtro, revisão, alinhamento, freio. Essa decisão sobrescreve o desenho anterior de "posicionamento estratificado / saudação só com óleo", a pedido do sócio que considerou que esconder o escopo perdia oportunidade. A FAQ `serve_para_outros_servicos` (slug interno, seedada em `20260523000000_faq_serve_outros_servicos.sql`) **continua existindo** para detalhar quando o lead pergunta especificamente.
- Fonte: `lib/whatsapp/sales-agent.ts`, `lib/admin/faq.ts`.

### 1.6 Handoff comercial direto
O vendedor faz handoff (mantém status e marca `conversas.handoff_required = true`) nos seguintes casos:
- Pergunta de preço com `sales.price_mentions ≥ 1` → reason `preco_insistente`.
- Mensagem cita rede/franquia/matriz/filial → reason `rede_ou_franquia`.
- Volume informado > 300 trocas/mês → reason `volume_alto`.
- Em todos os casos, envia link `wa.me` para `configuracoes_vendedor.whatsapp_handoff_comercial`.
- Fonte: `lib/whatsapp/sales-agent.ts`, `lib/whatsapp/webhook-handler.ts`.

### 1.7 Follow-up proativo de leads (CV4)
Reengajamento automático de leads que esfriaram, via **template Meta aprovado** (fora da janela de 24h — obrigatório, ADR-0005). Job diário protegido por `INTERNAL_JOB_SECRET`, acionado pelo cron do Supabase 1×/dia em horário comercial.
- **Elegibilidade:** apenas leads com status `em_conversa` ou `qualificado`, não excluídos (`deleted_at is null`) e cuja conversa **não** está em handoff.
- **Nunca** envia para `perdido`, `convertido`, `teste_aceito`, `interessado` nem `novo`.
- **Janelas** (medidas desde a última interação do lead — `last_message_at`, ou `created_at` se nunca houve inbound): 1º follow-up com ≥ 24h; 2º follow-up com ≥ 72h.
- **Cap de 2 follow-ups por lead** (`leads_oficina.followup_count`).
- **Texto 100% determinístico** (template Meta; o LLM não entra — ADR-0001). Parâmetro `{{1}}` = primeiro nome do lead.
- **Idempotência:** `followup_count`/`last_followup_at` só avançam após envio com sucesso; rodar o job 2× no mesmo dia não duplica envio. Falha de envio (ex.: template não aprovado) não queima o follow-up — é reprocessável no próximo dia.
- Fonte: `lib/whatsapp/followup-leads.ts`, `app/api/internal/followup-leads/route.ts`, migrations `20260718140000_leads_followup.sql` e `20260718141000_followup_leads_cron.sql`.

### 1.8 Volante de aprendizado (CV5)
Melhoria contínua da FAQ sem deploy: pergunta que o bot não soube responder → admin responde 1× → bot sabe pra sempre.
- Quando o modo `respond` devolve `dontKnow`, a pergunta é gravada em `perguntas_sem_resposta` (status `aberta`) — ADR-0023.
- Tela `/admin/perguntas-sem-resposta`: lista as perguntas abertas **agrupadas por frequência**. Ações: **Virar FAQ** (abre o form de `faq_vendas` pré-preenchido; ao salvar, marca as ocorrências como `resolvida`) e **Ignorar** (marca `ignorada`). Toda ação é auditada em `admin_audit_log`.
- Fonte: `lib/admin/perguntas-sem-resposta.ts`, `app/admin/(autenticado)/perguntas-sem-resposta/`, migration `20260718150000_faq_semantic_search.sql`.

---

## 2. Conversão (lead → oficina)

### 2.1 Critérios para virar cliente
Uma oficina vira `cliente_ativo` quando:
- aceita iniciar teste, **ou**
- aceita contratar, **ou**
- confirma que quer começar a cadastrar clientes.

Dados mínimos coletados no fluxo: `nome_oficina`, `whatsapp_principal`.

**Captura do nome da oficina (obrigatória):** quando o lead aceita testar (`quer_testar`), o bot **não converte na hora** — primeiro pergunta o nome da oficina ("Boa chefe! Antes de ativar seu teste, como chama a sua oficina?") e marca `sales.awaiting_workshop_name = true`. Na resposta, `extractWorkshopName()` limpa frases de embrulho ("minha oficina se chama X", "é a X", "o nome é X") e valida que não é saudação/ack/pergunta/preço nem só dígitos. Se a resposta não parecer um nome, o bot repergunta. Se o lead desistir (`isExplicitLossMessage`), vira `perdido`. Com o nome válido, o agente devolve `convertToOficina = true` e `nomeOficina = <nome>`, e a tool call `capture_workshop_name` é registrada. O nome capturado fica em `sales.workshop_name`.

- Fonte: [PRD §8](./product/PRD-whatsapp-bot.md), `extractWorkshopName()` em `lib/whatsapp/sales-agent.ts`.

### 2.2 Ações no banco na conversão
- Cria registro em `oficinas` com `status = ativa`, `plano = teste`, `origem = landing_whatsapp`.
- `nome` = o nome capturado no fluxo (`AgentReply.nomeOficina`). Se vier vazio, grava o placeholder `"Oficina sem nome"` (sentinela `OFICINA_SEM_NOME` em `lib/whatsapp/repository.ts`), que dispara o backfill na próxima interação (ver §2.7).
- `leads_oficina.status = convertido`, preenche `converted_at` e `oficina_id`.
- Conversa transita: `participant_type = oficina_cliente`, `agent_mode = onboarding`.
- Mensagem de boas-vindas é **personalizada com o nome** ("Pronto, a *Auto Center Silva* esta cadastrada."); cai no genérico ("sua oficina") só quando o nome é o placeholder.
- Tudo via RPC transacional `convertLeadToOficina` (`lib/whatsapp/repository.ts`).

### 2.3 Cadastro manual de oficina (painel admin)
- Admin pode criar oficina pelo painel com `origem = 'manual'` (pula bot vendedor).
- Útil para captação offline, eventos, indicações.
- Campos do formulário (`OficinaFormModal`, modo `create`): obrigatórios `nome`, `whatsapp`, `cidade`, `plano_id`; opcionais `responsavel`, `cpf_cnpj`, `email`, endereço (`cep`, `estado`/UF, `bairro`, `logradouro`, `numero`, `complemento`), `preco_negociado`, `representante_id`, `status` inicial (`ativa | pausada`), `ticket_medio`, `volume_trocas_mes`, `observacao`.
- `observacao` é **persistida** em `oficinas.observacao` (antes o campo do formulário era descartado no payload de auditoria).
- Validação/normalização de `cpf_cnpj`, `email`, `cep`, `estado` segue as mesmas regras da §2.5.
- Fonte: [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md), `validateOficinaCreate`/`createOficinaManual` em `lib/admin/oficinas.ts`, `OficinaFormModal` em `components/admin/oficina-form-modal.tsx`.

### 2.4 Conversão manual de lead em oficina (painel admin)
Admin pode converter um lead vivo em oficina sem passar pelo bot. Fechamento por telefone ou visita.

Ação atômica via RPC `convert_lead_to_oficina_manual`:
- Bloqueia se lead já está em status terminal (`convertido | perdido`) ou se WhatsApp já está em uso por oficina não-cancelada.
- Cria `oficinas` com `origem = 'manual'`, `plano_id` escolhido pelo admin, `preco_negociado` opcional, `dias_lembrete_padrao` configurável e `status` inicial `ativa | pausada`.
- Atualiza `leads_oficina.status = convertido`, preenche `converted_at` e `oficina_id`.
- Se houver conversa ligada ao lead, transita para `participant_type = oficina_cliente` e `agent_mode = onboarding`.
- Fonte: `convertLeadManual` em `lib/admin/leads.ts`, migration `20260520120000_admin_lead_cliente_actions.sql`.

### 2.5 Edição do cadastro de oficina (painel admin)
Na listagem (`/admin/oficinas`) o **nome** leva à página de detalhe; a edição abre pelo botão **Editar** (na linha da lista ou no cabeçalho do detalhe), sempre no mesmo `OficinaFormModal` (modo `edit`). Campos editáveis: `nome`, `whatsapp_principal`, `responsavel`, `cpf_cnpj`, `email`, endereço (`cep`, `cidade`, `estado`, `bairro`, `logradouro`, `numero`, `complemento`), `plano_id`, `preco_negociado`, `representante_id`, `status` (e `motivo_pausa` quando pausada), `ticket_medio`, `volume_trocas_mes`, `observacao`.

Regras:
- `nome` obrigatório (não vazio); campos de texto opcionais aceitam vazio → gravam `null`.
- `whatsapp_principal` é normalizado para E.164 e validado contra unicidade — bloqueia (409) se já estiver em uso por outra oficina não-cancelada.
- `cpf_cnpj` valida dígito verificador (CPF ou CNPJ) e é gravado **só com dígitos**; habilita a cobrança ASAAS (§9.5). `email` valida formato; `cep` exige 8 dígitos (gravado só dígitos); `estado` valida UF (gravado em maiúsculo); `ticket_medio` ≥ 0; `volume_trocas_mes` inteiro ≥ 0.
- Mudança de `status` segue as mesmas regras de [§10](#10-inadimplência-e-pausa-de-oficina): cancelar exige confirmar o nome e é irreversível por esta tela; oficina cancelada não volta atrás aqui.
- Auditoria: uma entrada por ação distinta (`oficina.update_cadastro`, `oficina.update_fiscal`, `oficina.update_status`, `oficina.update_plano`, `oficina.update_preco`, `oficina.update_representante`, `oficina.update_lembrete_config`).
- Fonte: `patchOficina` em `lib/admin/oficinas.ts`, `OficinaFormModal` em `components/admin/oficina-form-modal.tsx`, rota `PATCH /api/admin/oficinas/[id]`.

A **automação de lembretes por oficina** (`dias_lembrete_padrao`, `horario_envio_inicio`/`fim`, `mensagem_lembrete_padrao`) é editável na página de detalhe (`OficinaLembreteConfigCard`), pela mesma rota `PATCH`. `dias_lembrete_padrao` deve estar entre 1 e 365; a janela de envio exige `fim > inicio`. Audita `oficina.update_lembrete_config`.

### 2.6 Exclusão de oficina — soft delete (painel admin)
Admin pode excluir uma oficina pela "zona de perigo" do mesmo modal de edição (`/admin/oficinas`). Exclusão é **soft delete**, distinta de `status = 'cancelada'`:
- `cancelada` é estado de negócio: a oficina some dos fluxos operacionais mas continua visível e filtrável na listagem do admin.
- **Excluir** grava `oficinas.deleted_at = now()` e oculta o registro de **todas** as telas do admin (listagem, detalhe, busca, checagem de unicidade de WhatsApp), preservando-o no banco para auditoria.

Regras:
- Exige confirmar o nome exato da oficina (mesma proteção do cancelamento); nome divergente bloqueia (400).
- Oficina inexistente ou já excluída retorna 404.
- **Irreversível por esta tela** — restauração só diretamente no banco (limpar `deleted_at`).
- O WhatsApp de uma oficina excluída deixa de bloquear unicidade, podendo ser reusado por um novo cadastro.
- Auditoria: uma entrada `oficina.soft_delete`.
- Fonte: `softDeleteOficina` em `lib/admin/oficinas.ts`, `OficinaFormModal` (zona de perigo) em `components/admin/oficina-form-modal.tsx`, rota `DELETE /api/admin/oficinas/[id]`, migration `20260602000000_oficinas_soft_delete.sql`.

**Exclusão em massa (checkbox na listagem):** a listagem (`/admin/oficinas`) tem seleção por checkbox — um por linha e um "selecionar todas" no cabeçalho, restrito à **página atual** (paginar/filtrar/ordenar zera a seleção). Com uma ou mais selecionadas aparece a barra de ações com **Excluir selecionadas**, que abre um modal de confirmação listando os nomes e exigindo digitar **`EXCLUIR`** (confirmação deliberada; não pede o nome exato de cada oficina, ao contrário do delete individual). Confirmando, chama `DELETE /api/admin/oficinas` com `{ ids, confirm: true }`.
- Mesma semântica de soft delete do delete individual (grava `deleted_at`, oculta de todas as telas, preserva no banco). Cada oficina excluída gera uma entrada `oficina.soft_delete` (com `bulk: true` no payload).
- Ids inexistentes ou já excluídos são **ignorados** (não contam em `deleted`); a resposta traz `{ requested, deleted }`.
- Teto de **100 oficinas por chamada** (`BULK_SOFT_DELETE_MAX`); lista vazia, acima do teto ou sem `confirm: true` bloqueia (400).
- Por enquanto a única ação em massa é exclusão.
- Fonte: `bulkSoftDeleteOficinas` em `lib/admin/oficinas.ts`, `OficinasBulkDeleteModal` em `components/admin/oficinas-bulk-delete-modal.tsx`, seleção em `components/admin/oficinas-client.tsx`, rota `DELETE /api/admin/oficinas`.

### 2.7 Backfill do nome da oficina ("Oficina sem nome")
Oficinas convertidas antes da captura obrigatória (ou cujo lead não respondeu o nome) ficam com `nome = "Oficina sem nome"`. Na **próxima interação** dessa oficina (modo `onboarding`/`operacao`), o webhook intercepta antes do agente de onboarding:
- 1ª mensagem com o placeholder → pergunta "Antes de continuar, qual o nome da sua oficina? E pra deixar seu cadastro certinho." e marca `conversas.context.awaiting_workshop_name = true`. O cadastro de troca **não** é processado nesse turno.
- Resposta seguinte → `extractWorkshopName()` (mesma validação da §2.1). Se válido, grava `oficinas.nome` via `updateOficinaNome`, registra a tool call `update_oficina_nome`, limpa a flag e devolve ao fluxo normal pedindo a troca. Se inválido, repergunta.
- Fonte: `lib/whatsapp/webhook-handler.ts` (branch de backfill), `updateOficinaNome` em `lib/whatsapp/repository.ts`.

---

## 3. Onboarding e operação

### 3.1 Modos
- `onboarding`: primeiro cadastro após conversão. Ensina formato.
- `operacao`: cadastros recorrentes. Mesmo agente, sem mensagem introdutória.
- Transição automática: após primeiro `registerServiceWithReminder` com sucesso, `onboarding → operacao`.
- Fonte: [PRD §9](./product/PRD-whatsapp-bot.md), `lib/whatsapp/onboarding-agent.ts`.

### 3.2 Campos obrigatórios para registrar uma troca
1. `nome_cliente`
2. `whatsapp_cliente` (E.164)
3. `veiculo`
4. `servico`
5. `data_servico` — ver cobertura de formatos abaixo.
6. `tipo_servico` — enum fechado `troca_oleo | amortecedor | revisao | outro`. Classificado deterministicamente do texto de `servico`; LLM apenas classifica (ADR-0001). Default histórico = `troca_oleo`.

Opcional: `valor`.

Condicional:
- `marca_peca` — **só obrigatório quando `tipo_servico = amortecedor`**. Enum fechado `perfect | monroe | cofap | nakata | outra`. Se a oficina mencionar a marca espontaneamente, o parser extrai. Se faltar, agente pergunta uma vez com as 5 opções em ordem alfabética (`Cofap, Monroe, Nakata, Perfect, outra`) — Perfect nunca aparece primeiro, para evitar viés nos relatórios de mercado.

**Quem extrai os campos** ([ADR-0027](./adr/0027-extracao-de-cadastro-por-llm.md)): o **LLM é o extrator primário**. O parser posicional por vírgula (`Nome, Carro, Servico, Data, Telefone`) é **fallback**, usado só quando não há OpenAI disponível (sem chave, erro de API, timeout), e **nunca** em mensagem vinda de áudio — em fala natural a posição da vírgula não separa campos. Em áudio o caminho determinístico só aproveita os campos independentes de posição (telefone, data, marca, consentimento). O `sourceMediaType` chega ao agente e é gravado na tool call `solicitou_confirmacao_cadastro`, para medir acerto de extração por origem.

A **`data_servico` continua determinística** (`parseBrazilianDate`), mesmo com o LLM como extrator primário: o modelo não tem referência temporal confiável para "na data de hoje", e data errada agenda o lembrete no ano errado. A data devolvida pelo LLM só entra quando o parser não achou nada, e ainda passa pela guarda de sanidade.

**Guarda de sanidade determinística** (`suspectDraftFields`), aplicada **depois** da extração e **antes** de o rascunho ser aceito, nas três portas de captura (extração, follow-up, correção na confirmação):
- `nome_cliente` — reprova muleta de fala (`Ó`, `Então`, `Olha`), token de rótulo (`nome`, `cliente`) e contaminação de outro campo (`ele`, `dele`, `acabou`, `data`).
- `veiculo` — reprova frase (mesma lista), > 40 chars ou > 6 tokens.
- `servico` — reprova > 60 chars ou verbo conjugado de fala (`acabou`, `troquei`, `tem`, `fiz`).
- `data_servico` — reprova formato não-ISO e distância > 366 dias de hoje (erro de ordem de grandeza, ex.: `2028-07-23` para "hoje").

Campo reprovado **sai do rascunho e volta a ser perguntado** — não é confirmado nem persistido. A ocorrência é auditada na tool call `extracao_suspeita` (com os valores descartados). Quando o `servico` é reprovado, o `tipo_servico` derivado dele cai junto, para não agendar com a cadência de um serviço que foi corrigido.

O `nome_cliente` é **normalizado na captura** (`normalizeNomeCliente` em `lib/whatsapp/onboarding-agent.ts`): remove frases de intenção/rótulo que a oficina às vezes envia junto (ex.: "Quero cadastrar o cliente Luca Marcilli" → `Luca Marcilli`), apara pontuação nas pontas e aplica caixa de nome próprio (partículas `de/da/do/das/dos/e` em minúsculas). Aplica-se aos três pontos de captura: parser determinístico, resposta de follow-up e extração via LLM. Se sobrar vazio após normalizar, o campo continua faltante e o bot pergunta o nome.

O `servico` é **normalizado na captura** (`normalizeServico`): guarda a descrição curta, sem o embrulho de fala (ex.: "ele acabou de trocar um amortecedor da Perfect" → `amortecedor da Perfect`, "eu troquei o oleo" → `oleo`). O infinitivo e o substantivo ficam intactos (`troca de oleo` não muda). O prompt do LLM exige descrição de no máximo 5 palavras, sem verbo conjugado.

O `veiculo` é **normalizado na captura** (`normalizeVeiculo` em `lib/whatsapp/onboarding-agent.ts`): remove o embrulho conversacional que a oficina costuma escrever (ex.: "o carro dele é um UP" → `UP`, "ela tem um HB20 prata" → `HB20 Prata`, "carro: Onix" → `Onix`), apara stopwords/pontuação nas pontas e ajusta a caixa preservando siglas/códigos de modelo (`UP`, `HB20`, `S10`, `208` ficam intactos; `gol`→`Gol`, `civic`→`Civic`). Aplica-se aos três pontos de captura (parser determinístico, follow-up e LLM) + guard final antes de persistir; o prompt da LLM também exige devolver só marca/modelo. Esse valor vai direto pra mensagem que o cliente final lê (template `confirmacao_servico` → `{{carro}}`), então não pode conter frase. Se sobrar vazio após normalizar, o campo continua faltante e o bot pergunta o carro.

Se faltar algum, o bot pergunta **só o primeiro faltante**, persiste o draft parcial em `conversas.context.service_draft`, e completa multi-turn.

**Cobertura de formatos de `data_servico`** (`parseBrazilianDate` em `lib/whatsapp/date-parse.ts`, com `today` no fuso `America/Sao_Paulo`):
- Relativos explícitos: `hoje`, `ontem`, `anteontem`, `amanhã`, `depois de amanhã`.
- Contagem de dias/semanas: `daqui 3 dias`, `daqui a uma semana`, `em 2 dias`, `dentro de 1 dia`, `5 dias atrás`, `há 2 dias`, `uma semana atrás`.
- Numérico: `05/06`, `5/6`, `05/06/2026`, `5/6/26`, `15-03`, `10-12-2025` (dia/mês; `.` **não** é separador, para não confundir com motorização tipo `Gol 1.0`).
- Extenso: `dia 5`, `5 de junho`, `5 de jun`, `10 de dezembro de 2025`.
- Dia da semana **só com qualificador**: `sexta que vem`/`próxima sexta` → próxima ocorrência futura; `sábado passado` → ocorrência anterior; `terça retrasada` → duas semanas atrás. **Dia da semana sem qualificador** ("foi na segunda") permanece **ambíguo** e o bot pergunta a data (poderia ser passada ou futura).
- O trecho de data reconhecido é removido do texto do serviço (`cleanServiceText`), evitando que "amanhã"/"05/06"/"sexta que vem" poluam o campo `servico`.

- Fonte: [PRD §10](./product/PRD-whatsapp-bot.md), [`.codex/prompts/whatsapp-onboarding-agent.md`](../.codex/prompts/whatsapp-onboarding-agent.md), `lib/whatsapp/onboarding-agent.ts`, `lib/whatsapp/date-parse.ts`, migration `20260521000000_tipo_servico_marca_peca.sql`.

### 3.3 Guardrails operacionais
Bot **não** inicia cadastro nem preenche campo quando:
- mensagem é neutra (`ok`, `obrigado`, `bom dia`, `valeu`);
- mensagem é uma pergunta (começa com `qual`, `como`, contém `?`);
- mensagem tem padrão de prompt injection (`ignore`, `instrucoes`, `drop table`, etc.) — registra `blocked_prompt_injection` em `agent_tool_calls`.

**Resposta conversacional a mensagem neutra (`neutralReply`):** em vez de repetir duas frases fixas (efeito "disco riscado" observado em produção — três respostas idênticas seguidas, "Bom dia" às 22h), o bot classifica a intenção social — `saudacao | small_talk | como_funciona | agradecimento | pergunta | generico` — e responde de forma variada e **determinística** (sem OpenAI):
- **Saudação sensível ao horário** (`America/Sao_Paulo`): "Bom dia" (< 12h), "Boa tarde" (< 18h), "Boa noite" (senão); nunca hard-codada.
- **Sem repetição:** cada categoria tem um pool de variações que rotaciona por `context.neutral_turn` (incrementado a cada turno). `context.greeted` marca que a saudação completa (com exemplo) já foi dada — a próxima é curta.
- Small-talk ("tudo bem?") e agradecimento ("valeu") respondem curto e convidam a registrar; não despejam o formulário inteiro. Saudação inicial e "como funciona" trazem o exemplo copiável.
- **Pergunta fora do cadastro** ([ADR-0022](./adr/0022-modo-respond-grounded.md)): mensagem question-like que não casa com as categorias sociais ("já sou cliente?", "vocês fazem alinhamento?") **não** despeja o formulário. Enlatada = resposta curta + handoff comercial via `wa.me` (`configuracoes_vendedor.whatsapp_handoff_comercial`) + convite a registrar; sem handoff configurado, versão sem link ("um humano te responde por aqui"). Quando a camada de geração está ativa, a resposta é gerada em modo **respond** (grounded — ver §13.1). **Preço/cobrança é trilho crítico**: regex determinística (`PRICE_QUESTION_PATTERN`) força o modo rewrite sobre o handoff — o bot nunca cota preço na operação (ADR-0012).
- Registra `ignored_operational_message` em `agent_tool_calls` com `neutral_kind` (a categoria classificada).

- Fonte: `lib/whatsapp/onboarding-agent.ts` (`neutralReply`, `classifyNeutral`, `saudacaoTemporal`, `PRICE_QUESTION_PATTERN`), `lib/whatsapp/webhook-handler.ts` (`localHourSaoPaulo`).

### 3.3-bis Operação como assistente: consultas read-only e /ajuda (CV6)
No modo `operacao`, além de registrar trocas, o bot responde consultas **read-only** (leitura não muda estado → não fere a ADR-0001). A intenção é classificada deterministicamente pelo agente (`classifyReadOnlyQuery`); a leitura é feita pelo webhook, **sempre escopada por `oficina_id`** (nunca vaza dados de outra oficina), e a resposta traz os **dados literais** (números/nomes nunca são gerados) com moldura conversacional só em respostas curtas.
- `consulta_lembretes` (próximos): "quais lembretes dessa semana?", "quem vou avisar?" → `listUpcomingReminders({ oficinaId, days: 7 })`. A lista fica **literal** (sem geração, pra não perder item).
- `consulta_lembretes` (mês): "quantos lembretes saíram esse mês?" → `countRemindersSentThisMonth({ oficinaId })`.
- `consulta_cliente`: "dados do cliente João", "cliente 41999998888" → `getClienteResumo({ oficinaId, nomeOuTelefone })` (nome, WhatsApp, último serviço, total, próximo lembrete, aviso de opt-out). Não encontrado → mensagem pedindo pra conferir nome/telefone.
- Consultas **só valem em `operacao`** (no `onboarding` a oficina ainda está aprendendo a registrar). Mensagem de cadastro (`hasRegistrationSignal`) nunca é interpretada como consulta. Registra `operacao_read_only_query` em `agent_tool_calls`.
- **Comando `/ajuda`** (determinístico por modo, mesmo padrão de `/suporte`/`/voltar`): lista o que o bot faz naquele modo. Verbatim — nunca passa pela camada de geração.
- Fonte: `lib/whatsapp/onboarding-agent.ts` (`classifyReadOnlyQuery`, `extractClienteTermo`), `lib/whatsapp/operacao-queries.ts`, `lib/whatsapp/webhook-handler.ts` (`resolveOperacaoReadOnlyQuery`, branch `/ajuda`), `lib/whatsapp/repository.ts` (`listUpcomingReminders`, `countRemindersSentThisMonth`, `getClienteResumo`).

### 3.4 Confirmação obrigatória antes de registrar (ADR-0017)
Quando todos os campos obrigatórios estão preenchidos, o bot **não grava direto**. Primeiro devolve um resumo dos dados captados e marca `conversas.context.awaiting_confirmation = true` (carregando o draft completo em `service_draft`). É a rede de segurança que o [ADR-0015](./adr/0015-suporte-audio-whisper.md) assumia ("a oficina corrige manualmente") mas que não existia no fluxo — sem ela, uma transcrição errada do Whisper (ex.: veículo capturado como "Não houve loucura") era gravada e o template irreversível disparava ao cliente frio sem revisão humana.

- **Resumo**: lista cliente, carro, serviço (com marca do amortecedor quando houver), data e WhatsApp; pede "Responda *sim* pra confirmar, ou me diga o que corrigir". Registra a tool call `solicitou_confirmacao_cadastro`.
- **Afirmação** (`sim`, `isso`, `pode cadastrar`, `ok`, `beleza`… — só quando **todos** os tokens da resposta são afirmativos, pra "sim, mas o carro é Gol" não confirmar por engano): aí sim chama a RPC e dispara a confirmação ao cliente. Tool call `confirmou_cadastro` com `confirmed=true`.
- **Correção** (qualquer resposta não-afirmativa): re-extrai os campos informados **via LLM** (o parser por vírgula é perigoso em respostas curtas) e mescla sobre o draft, reapresentando o resumo para novo "sim". Se nada foi entendido, pede explicitamente o que corrigir. Em nenhum caso grava ou dispara template enquanto não houver afirmação. Tool call `confirmou_cadastro` com `confirmed=false`.

Após a afirmação, a RPC `register_service_with_reminder` cria atomicamente:
- `clientes_finais` (ou reusa se já existe por `(oficina_id, whatsapp)`)
- `veiculos` (ou reusa)
- `servicos` (sempre novo)
- `lembretes` (apenas se `consentimento_whatsapp = true`)

- Fonte: [ADR-0017](./adr/0017-confirmacao-antes-de-registrar-troca.md), [PRD §10](./product/PRD-whatsapp-bot.md), `lib/whatsapp/onboarding-agent.ts`, migration `20260426021529_phase_2_conversion_onboarding.sql`.

### 3.5 Preservação de status do cliente
RPC `register_service_with_reminder` **não reativa** cliente que já está em:
- `opt_out`
- `numero_errado`

Mesmo se a oficina mandar novo cadastro do mesmo número.

- Fonte: migration `20260426130513_phase_3_real_reminders.sql`.

### 3.6 Confirmação ao cliente no cadastro
Logo após o cadastro do serviço (RPC bem-sucedida), o bot envia uma **confirmação ao cliente final**:
- **Só com consentimento**: dispara apenas se `consentimento_whatsapp = true` (mesma regra dos lembretes — [§7.1](#71-consentimento-obrigatório)).
- **Sempre via template aprovado**: o cliente é um número "frio" (nunca iniciou conversa), então o envio cai fora da janela de 24h → template Meta obrigatório ([ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md)). Template: `confirmacao_servico` / `pt_BR` (configurável via `WHATSAPP_CONFIRMACAO_TEMPLATE` e `WHATSAPP_CONFIRMACAO_TEMPLATE_LANGUAGE`). Usa **variáveis nomeadas**: `{{nome}}`, `{{produto}}`, `{{carro}}`, `{{oficina}}`.
- **Nenhum texto livre da oficina vira parâmetro de template.** O `{{produto}}` sai de um **mapa fechado por `tipo_servico`** (`troca_oleo`→"óleo", `amortecedor`→"amortecedor", `revisao`→"revisão", `outro`→"revisão"). O mapa vive no código (`PRODUCT_LABEL_BY_TIPO`) e é exaustivo — tipo novo quebra o build. Não usa `tipos_servico_default.label`, que é editável no admin: parâmetro de template não pode depender de texto editável.
- **Sanitização como última barreira**, aplicada aos **quatro** parâmetros — `{{nome}}` e `{{carro}}` também saem do que a oficina ditou: colapsa espaços, remove `\n`/`\t` (a Cloud API rejeita) e impõe limite por campo (nome/oficina 60, produto/carro 40). **Parâmetro que não sobrevive à sanitização aborta o envio**: registra `notify_cliente_confirmacao` com `skipped: param_invalido` + o campo culpado e a oficina segue recebendo o ack, sem o "já avisei o cliente". Mandar texto sujo para o cliente da oficina é pior que não mandar nada.
- **Não bloqueante**: qualquer falha de envio (template não aprovado, erro do provedor) é registrada (`outbound_messages` em `failed` + `agent_tool_calls.notify_cliente_confirmacao`) mas **não** derruba a resposta de confirmação para a oficina.
- **Reflexo na resposta à oficina**: quando a confirmação é enviada, o bot acrescenta "Já avisei o {cliente} que o serviço foi registrado." à mensagem de cadastro.
- A conversa do cliente final é criada/reusada em `conversas` (`participant_type = cliente_final`, `agent_mode = cliente_final_lembrete`).
- **Botão "Chamar no WhatsApp"** (ADR-0018): o template tem um botão **CTA de URL `https://wa.me/{{1}}`**, com `{{1}}` = WhatsApp da oficina (passado no envio). O cliente fala direto com a oficina; o botão **não** devolve mensagem ao bot. A copy do corpo direciona a esse botão.

- Fonte: [ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md), [ADR-0018](./adr/0018-cliente-final-concierge-pre-lembrete.md), `lib/whatsapp/service-confirmation.ts`, `sendServiceConfirmation()` em `lib/whatsapp/webhook-handler.ts`.

### 3.7 Concierge do cliente final antes do primeiro lembrete (ADR-0018, revisado pela ADR-0026)
Entre a confirmação e o primeiro lembrete há uma janela em que o cliente final pode responder. Nessa janela ele **não** é lead de vendas:
- **Reconhecimento**: o roteador identifica o cliente final por telefone via `findClienteFinalConversationByWhatsapp` (conversa `cliente_final` em `conversas`, independente de lembrete). Resolve `agent_mode = cliente_final_lembrete` **sem `lastReminderId`**; o webhook bifurca por esse campo — com lembrete ativo → agente de lembrete; sem → **concierge** (`lib/whatsapp/cliente-final-concierge.ts`). Ambiguidade multi-oficina (telefone com outbound de 2+ oficinas) → handoff suporte, como no lookup de lembrete.
- **Moldura gerada (CV8, ADR-0026):** a decisão do estado/ação e a **base da resposta** seguem determinísticas; o que muda é que os intents **seguros** (`quem_e`, `agradecimento`, `mensagem_indefinida`) podem ganhar moldura por LLM em **rewrite** quando `geracao_llm_modo != off`. A geração exige a **ponte `wa.me` da oficina** na saída (`requireHandoffLink`) e o `wa.me`/nome da oficina entram na allowlist do validador; qualquer reprovação/erro → frase determinística. `opt_out`, `numero_errado`, `nao_reconhece` e `pedido_oficina` permanecem **100% determinísticos**. Com `off`, comportamento idêntico ao da ADR-0018.
- **Comportamento (intents e ações)** — a coluna "Resposta" é a base determinística (moldura gerada só nos intents marcados ✎):

| Intent | Resposta | Moldura | Efeito |
|---|---|---|---|
| `agradecimento` | curta + link da oficina | ✎ rewrite | — |
| `quem_e` | explica (assistente da oficina via Quando Trocar) + link | ✎ rewrite | — |
| `mensagem_indefinida` | handoff (destino seguro) + link | ✎ rewrite | `markConversationHandoff(mensagem_ambigua)` |
| `pedido_oficina` (preço, agendar, remarcar, horário, reclamação) | handoff `wa.me` pra oficina | determinística | `markConversationHandoff(pedido_cliente_final)` |
| `opt_out` | "não envio mais mensagens" | determinística | `clienteStatus = opt_out` + cancela lembretes futuros |
| `numero_errado` | "desculpe o engano" | determinística | `clienteStatus = numero_errado` + cancela lembretes futuros |
| `nao_reconhece` | handoff pra oficina verificar | determinística | `markConversationHandoff(cliente_nao_reconhece)` |

- Bot não cota preço nem agenda ([ADR-0009](./adr/0009-confirmacao-vs-pre-agendamento.md)/[ADR-0012](./adr/0012-politica-de-preco.md)); opt-out/status nunca via LLM ([ADR-0001](./adr/0001-llm-como-conselheiro-nao-decisor.md)). O validador barra preço/promessa/agenda mesmo na moldura gerada (red-team em `tests/whatsapp-concierge-generation.test.ts`). Tool call `cliente_final_concierge` registrada sempre.
- Fonte: [ADR-0018](./adr/0018-cliente-final-concierge-pre-lembrete.md), [ADR-0026](./adr/0026-concierge-moldura-gerada.md), `lib/whatsapp/cliente-final-concierge.ts`, `lib/whatsapp/reply-validator.ts` (`requireHandoffLink`), `lib/whatsapp/conversation-router.ts`, `lib/whatsapp/webhook-handler.ts`.

---

## 4. Lembretes automáticos

### 4.1 Prazo padrão por tipo de serviço
- `proximo_lembrete = data_servico + tipos_servico_default.dias_lembrete` (resolvido pelo `tipo_servico` do serviço cadastrado).
- Tabela global `tipos_servico_default` (gerenciada em `/admin/tipos-servico`):

| `tipo_servico` | `dias_lembrete` | `template_name` |
|---|---|---|
| `troca_oleo` | 90 | `lembrete_troca_oleo` |
| `amortecedor` | 730 | `lembrete_amortecedor` |
| `revisao` | 180 | `lembrete_revisao_geral` |
| `outro` | 180 | `lembrete_revisao_geral` |

- **Fallback**: se o tipo estiver `ativo = false` (admin desativou), usa `oficinas.dias_lembrete_padrao` (default 90). Mantido por compatibilidade.
- **O que o bot diz à oficina é a data, não o prazo.** O RPC `register_service_with_reminder` devolve `scheduled_at` e `dias_lembrete`, e a copy do cadastro informa **essa data** (`dd/mm/aaaa`): "Cliente cadastrado. Vou lembrar o {cliente} em 24/07/2028 pra voltar com você.". Antes a copy lia `oficinas.dias_lembrete_padrao` enquanto o RPC agendava pela cadência do **tipo** — o bot prometeu 90 dias tendo gravado 730. Data é conferível pela oficina na hora; "N dias" esconde a divergência.
- **Sem consentimento não há lembrete**: o RPC não insere em `lembretes` e `scheduled_at` volta `null`. Nesse caso o bot diz explicitamente que não vai mandar lembrete, em vez de prometer um aviso que nunca sairia.
- A data é formatada em **UTC**: a sessão do Postgres roda em UTC, então `scheduled_at` é meia-noite UTC do dia pretendido; formatar no fuso da oficina devolveria o dia anterior.
- A data é registrada em `requiredLiterals` da camada de geração: se a reescrita conversacional perder ou alterar a data, a resposta é reprovada (`literal_ausente`) e o bot envia a enlatada.
- Fonte: [PRD §10](./product/PRD-whatsapp-bot.md), [ADR-0014](./adr/0014-cadencia-e-template-por-tipo-de-servico.md), migrations `20260522000000_tipos_servico_default.sql` e `20260725120000_register_service_returns_scheduled_at.sql`.

### 4.2 Estados do lembrete
```
pendente · enfileirado · enviado · respondido · sem_resposta · cancelado · erro_envio · handoff_iniciado
```

Removido (ADR-0009): `agendado`. Bot não confirma agenda.

- Fonte: [Glossário](./glossary.md), [ADR-0009](./adr/0009-confirmacao-vs-pre-agendamento.md).

### 4.3 Regras de envio
Um lembrete só é enfileirado pelo scheduler (`enqueue_due_whatsapp_reminders`) se:
- `lembretes.status in ('pendente', 'erro_envio')`
- `scheduled_at <= now()`
- `oficinas.status = 'ativa'` (não pausada)
- `clientes_finais.status = 'ativo'` (não opt-out, não número errado)
- `consentimento_whatsapp = true`
- `opt_out_at IS NULL`
- Horário atual dentro de `[horario_envio_inicio, horario_envio_fim]` da oficina (timezone-aware)
- Não há outro `outbound_messages` ativo (`pending`, `sent`, `retry_scheduled`) para o mesmo `lembrete_id`

- Fonte: [PRD §11](./product/PRD-whatsapp-bot.md), [Fase 3](./backlog-whatsapp-bot/fase-3-lembretes-reais.md), migration `20260426130513_phase_3_real_reminders.sql`.

### 4.4 Envio via template aprovado
- Lembretes são sempre enviados fora da janela de 24h → **sempre via template Meta**.
- Template e idioma resolvidos pelo `tipo_servico` em `tipos_servico_default` (ver §4.1). Scheduler grava `template_name`, `template_language` e `template_params` em `outbound_messages` por linha — worker apenas lê.
- Parâmetros (todos os tipos no MVP): `[nome_cliente, nome_oficina, descricao_veiculo]`.
- Texto renderizado salvo em `outbound_messages.body` para auditoria (varia por tipo).
- Templates exigidos aprovados na Meta: `lembrete_troca_oleo` (existente), `lembrete_amortecedor` (novo), `lembrete_revisao_geral` (novo).
- Fonte: [ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md), [ADR-0014](./adr/0014-cadencia-e-template-por-tipo-de-servico.md), `lib/whatsapp/reminder-agent.ts`, `lib/whatsapp/reminder-worker.ts`.

### 4.5 Retry com backoff
Falha temporária do provedor → retry escalonado:

| Tentativa | Próximo retry |
|---|---|
| 1ª falha | 15 min |
| 2ª falha | 2 h |
| 3ª falha | 24 h |
| 4ª falha | sem retry (vira `erro_envio`) |

Falha permanente (template inválido, token inválido) → direto para `erro_envio`, sem retry.

- Fonte: [Fase 3 — resumo](./backlog-whatsapp-bot/fases-1-2-e-3-resumo-implementacao.md), `lib/whatsapp/reminder-worker.ts`.

---

## 5. Cliente final responde

### 5.1 Intenções fechadas
9 intenções possíveis, ordem de prioridade (regex determinístico primeiro, OpenAI como fallback):

```
opt_out · numero_errado · pergunta_preco · pergunta_horario ·
quer_agendar · quer_reagendar · ja_fez_servico · nao_tem_interesse · mensagem_indefinida
```

- Fonte: [PRD §12](./product/PRD-whatsapp-bot.md), `lib/whatsapp/reminder-agent.ts`.

### 5.2 Ações por intenção

| Intenção | Ação no banco | Resposta ao cliente |
|---|---|---|
| `opt_out` | `status=opt_out`, `opt_out_at=now`, cancela futuros | "Tudo certo. Vou parar por aqui..." |
| `numero_errado` | `status=numero_errado`, cancela futuros | "Entendi. Vou parar os lembretes..." |
| `quer_agendar` / `quer_reagendar` | handoff `wa.me`, lembrete → `handoff_iniciado` | "Perfeito. Vou avisar a oficina..." |
| `pergunta_preco` | handoff `wa.me` (motivo `pergunta_preco`) | "Vou avisar a oficina sobre valores." |
| `pergunta_horario` | handoff `wa.me` (motivo `pergunta_horario`) | "Vou avisar a oficina pra confirmar horários." |
| `ja_fez_servico` | lembrete → `respondido` | "Perfeito. Obrigado por avisar." |
| `nao_tem_interesse` | lembrete → `sem_resposta` | "Tudo bem. Obrigado por responder." |
| `mensagem_indefinida` | handoff (motivo `mensagem_ambigua`) | "Recebi sua mensagem. Vou avisar a oficina..." |

- Fonte: [ADR-0009](./adr/0009-confirmacao-vs-pre-agendamento.md), [`.codex/prompts/whatsapp-reminder-agent.md`](../.codex/prompts/whatsapp-reminder-agent.md), `replyForIntent()` em `lib/whatsapp/reminder-agent.ts`.

### 5.3 Bot não agenda
- Bot **nunca** confirma horário.
- Bot **nunca** diz "tem horário disponível".
- Quando cliente quer agendar → 2 mensagens `wa.me`:
  1. Para o cliente: link pro WhatsApp do atendente (`oficinas.whatsapp_atendente`, fallback `whatsapp_principal`)
  2. Para o atendente: link pro WhatsApp do cliente
- A partir daí, conversa é direta entre humanos. Bot sai.
- Fonte: [ADR-0009](./adr/0009-confirmacao-vs-pre-agendamento.md).

### 5.4 Ambiguidade de cliente
Se o mesmo WhatsApp aparece como cliente em **mais de uma oficina** e o roteador não consegue desambiguar (sem `contextWhatsappMessageId` confiável) → conversa entra em modo `suporte` com handoff humano. Bot **não escolhe** uma oficina arbitrariamente.

- Fonte: `lib/whatsapp/conversation-router.ts`, [Fase 3 — resumo](./backlog-whatsapp-bot/fases-1-2-e-3-resumo-implementacao.md).

---

## 6. Retorno e receita

### 6.1 Como registrar retorno
1. Oficina informa pelo WhatsApp (texto livre): `"João voltou hoje, serviço R$ 250"`.
2. Oficina marca no painel.

Cria registro em `retornos` com `oficina_id`, `cliente_id`, `servico_id`, `lembrete_id`, `data_retorno`, `valor`, `status = concluido`.

- Fonte: [PRD §13](./product/PRD-whatsapp-bot.md).

### 6.2 Receita só conta depois de retorno
- Bot nunca contabiliza receita automaticamente — só quando há `retornos.valor > 0`.
- `ja_fez_servico` por si só **não** cria retorno (cliente pode ter feito em outra oficina).

### 6.3 Métricas comerciais priorizadas
Ordem de exibição no dashboard:
1. Receita gerada
2. Clientes que voltaram
3. Lembretes enviados
4. Clientes cadastrados

- Fonte: [PRD §13](./product/PRD-whatsapp-bot.md).

---

## 7. Consentimento e opt-out

### 7.1 Consentimento obrigatório
- Lembrete só vai para cliente com `consentimento_whatsapp = true`.
- Campos rastreados: `consentimento_whatsapp`, `origem_consentimento`, `data_consentimento`.
- Default no cadastro via bot: `true` (assume oficina já obteve autorização). Se oficina informar negativa explícita ("cliente não autorizou mensagem"), default vira `false`.

- Fonte: [PRD §18](./product/PRD-whatsapp-bot.md), `lib/whatsapp/onboarding-agent.ts`.

### 7.2 Opt-out
Trigger: cliente envia `parar`, `cancelar`, `não quero`, `remover`, `descadastrar`, `sair`, `pare`.

Sistema **automaticamente**:
- `clientes_finais.status = opt_out`
- `clientes_finais.opt_out_at = now()`
- Cancela todos lembretes futuros (`status = cancelado`)
- Responde: *"Tudo certo. Vou parar por aqui e nao envio mais lembretes."*

- Fonte: [PRD §18](./product/PRD-whatsapp-bot.md), `OPT_OUT_PATTERNS` em `lib/whatsapp/reminder-agent.ts`.

### 7.3 Número errado
Trigger: `número errado`, `não sou`, `telefone errado`.

Sistema:
- `clientes_finais.status = numero_errado`
- Cancela lembretes futuros
- Responde: *"Entendi. Vou parar os lembretes para este numero."*

- Fonte: `WRONG_NUMBER_PATTERNS` em `lib/whatsapp/reminder-agent.ts`.

### 7.4 Reativação de opt-out (admin)
Só o admin humano pode reativar consentimento. O bot **nunca** muda `opt_out → ativo`.

Quando admin reativa via painel:
- `clientes_finais.status = ativo`
- `clientes_finais.opt_out_at = null`
- `clientes_finais.consentimento_whatsapp = true`
- `clientes_finais.origem_consentimento` recebe novo valor obrigatório informado pelo admin (ex: `pedido_verbal_oficina`, `cliente_confirmou_whatsapp`).
- `clientes_finais.data_consentimento = now()`.

- Fonte: `reactivateCliente` em `lib/admin/clientes.ts`, ADR-0001.

### 7.5 Mudança manual de status do cliente (admin)
Admin pode também:
- Marcar cliente `ativo → numero_errado` com motivo. Lembretes pendentes (`pendente|enfileirado|agendado`) são cancelados em cascata.
- Reverter `numero_errado → ativo` (consentimento WhatsApp não muda).

- Fonte: `marcarNumeroErrado`, `marcarNumeroCorreto` em `lib/admin/clientes.ts`.

---

## 8. WhatsApp e Meta (janela, templates)

### 8.1 Janela de 24h
- **Dentro da janela** (último inbound ≤ 24h): mensagem livre permitida.
- **Fora da janela**: só template aprovado pela Meta.

Decisão é feita **no backend antes de enviar**, baseada em `conversas.last_message_at`.

- Fonte: [ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md).

### 8.2 Templates necessários
| Template | Categoria Meta | Quando usar |
|---|---|---|
| `lembrete_troca_oleo` | Utility | Lembrete automático (troca de óleo) |
| `lembrete_amortecedor` | Utility | Lembrete automático (amortecedor) |
| `lembrete_revisao_geral` | Utility | Lembrete automático (revisão/outro) |
| `confirmacao_servico` | Utility | Confirmação ao cliente no cadastro do serviço ([§3.6](#36-confirmação-ao-cliente-no-cadastro)) |
| `WHATSAPP_TEMPLATE_OTP_NAME` | Authentication | OTP do painel (oficina e admin) |
| `WHATSAPP_TEMPLATE_COBRANCA_NAME` | Utility | Aviso de cobrança/vencimento |

Mudar copy de um template = nova versão + aprovação Meta (horas a dias).

- Fonte: [ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md), [ADR-0010](./adr/0010-painel-web-no-mvp.md), [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 8.3 Validação obrigatória do webhook
- `GET`: valida `hub.verify_token`.
- `POST`: valida assinatura `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET`.
- Persiste evento bruto em `whatsapp_events` antes de processar (audit + retry).

- Fonte: [PRD §17, §20](./product/PRD-whatsapp-bot.md), `lib/whatsapp/signature.ts`.

---

## 9. Preço, planos e billing

### 9.0 Oferta pública de entrada
- A oferta padrão publicada para novas oficinas é **14 dias grátis** e, depois, **R$ 59 por mês**.
- O teste não exige cartão e não gera cobrança automática no encerramento.
- Ao final dos 14 dias, sem confirmação de continuidade e pagamento, o serviço deve ficar
  pausado e a conversa comercial deve voltar ao modo `vendas`.
- A assinatura é mensal, sem fidelidade, com cancelamento a qualquer momento.
- A landing apenas comunica esta regra. A automação de expiração, pausa e retorno para `vendas`
  não é alterada pelo ciclo P0 + P1 da landing e deve permanecer determinística no backend.
- Fonte: decisão comercial registrada em
  [`docs/superpowers/specs/2026-07-12-landing-p0-p1-design.md`](./superpowers/specs/2026-07-12-landing-p0-p1-design.md)
  e contrato de apresentação em `lib/landing-offer.ts`.

### 9.1 Plano único, preço variável por oficina
- Tabela `planos`: plano único no MVP ("Quando Trocar Mensal"), com `preco_base`.
- `oficinas.plano_id` referencia o plano.
- `oficinas.preco_negociado` (nullable) sobrescreve `preco_base` para aquela oficina específica.
- Quando `preco_negociado IS NULL` → usa `planos.preco_base`.
- Preço editável só por admin via `/admin/planos` ou `/admin/oficinas/[id]`.

- Fonte: [ADR-0012](./adr/0012-politica-de-preco.md), [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 9.2 Preço negociado não expira
- `preco_negociado` vale até admin editar ou zerar.
- Risco de "promo virar permanente" é aceito — admin pode revisar a qualquer momento.
- Fonte: [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 9.3 Ciclo de cobrança
- Mensal único. Sem opção anual no MVP.
- Cron diário gera **cobrança avulsa** no provedor ativo para oficinas com vencimento em D-3 e envia o link por WhatsApp.
- **Cobrança avulsa por ciclo** (não recorrência nativa): nem Mercado Pago Subscriptions nem ASAAS Subscriptions.
- Idempotência do webhook via índice único `pagamentos(gateway, gateway_payment_id)`; idempotência da geração via pagamento `pendente` do mesmo ciclo.

- Fonte: [ADR-0008](./adr/0008-pagamento-no-mvp.md), [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md), [ADR-0021](./adr/0021-gateway-pagamento-multiplo-asaas.md).

### 9.4 Vencimento e próxima cobrança
- `oficinas.proximo_vencimento date` indica data alvo da próxima cobrança.
- Inicializado quando a oficina ativa o plano pago.

### 9.5 Gateway de pagamento configurável (ADR-0021)
- O **provedor** que gera as cobranças é configurável no painel admin em `/admin/configuracoes/pagamentos`: **Mercado Pago** ou **ASAAS**. Padrão do produto: ASAAS ativo; Mercado Pago fica configurado porém dormente.
- A troca de provedor só vale para **novas** cobranças; pendentes seguem no provedor em que foram criadas.
- **Credenciais** (API keys / tokens) ficam cifradas no **Supabase Vault** (nomes fixos: `asaas_api_key`, `asaas_webhook_token`, `mercado_pago_access_token`, `mercado_pago_webhook_secret`), gravadas/lidas só via funções `SECURITY DEFINER` acessíveis pelo `service_role`. A UI mostra apenas se cada segredo **está configurado** — nunca o valor. Auditoria nunca registra segredo.
- Um provedor só pode ser **ativado** quando tem credencial usável (guard em `validateConfiguracoesPagamentoInput`).
- **ASAAS** exige um *customer* com `oficinas.cpf_cnpj` antes de cobrar; o id fica em `oficinas.asaas_customer_id`. Sem CPF/CNPJ, a geração retorna `missing_cpf_cnpj`. O `cpf_cnpj` é preenchido no cadastro/edição da oficina (§2.3/§2.5); a listagem sinaliza "sem CPF/CNPJ" e o detalhe mostra badge "pronta p/ cobrança". A cobrança usa `billingType: UNDEFINED` (cliente escolhe PIX / boleto / cartão).
- Webhooks: `POST /api/webhooks/mercado-pago` e `POST /api/webhooks/asaas`. Ambos passam pelo mesmo handler idempotente (`lib/payments/process-webhook.ts`). O ASAAS é validado pelo header `asaas-access-token`; o MP pela assinatura `x-signature`.
- Fonte: [ADR-0021](./adr/0021-gateway-pagamento-multiplo-asaas.md), `docs/runbooks/asaas-setup.md`.

---

## 10. Inadimplência e pausa de oficina

### 10.1 Estados de oficina
```
ativa · pausada · cancelada
```

Quando `status = 'pausada'`, campo adicional `motivo_pausa`:
- `inadimplencia` — automático
- `voluntaria` — oficina pediu pausa
- `admin` — admin pausou manualmente

- Fonte: [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 10.2 Auto-pausa por inadimplência
- Cron diário pausa oficinas com vencimento atrasado há `INADIMPLENCIA_DIAS_GRACE` dias (default **7**, configurável via env).
- Seta `motivo_pausa = 'inadimplencia'`.

### 10.3 Comportamento do bot em oficina pausada
Quando inbound chega para uma oficina pausada, o webhook chama `getOficinaPauseState` em `lib/whatsapp/inadimplencia-guard.ts` e roteia:

| `motivo_pausa` | Participant | Comportamento |
|---|---|---|
| `inadimplencia` | `oficina_cliente` | `cobranca-agent` em submode `cobranca_inadimplente` (item 15) |
| `voluntaria` | `oficina_cliente` | `cobranca-agent` em submode `cobranca_winback` (item 15) |
| `admin` | qualquer | Mensagem fixa de suspensão administrativa, bot **não** entra em cobrança |
| `inadimplencia` ou `voluntaria` | `cliente_final` / outro | Mensagem fixa de inadimplência (bot não conversa em cobrança com não-oficina) |

`agent_mode='cobranca'` é um **override de runtime** dentro do webhook — não persiste em `conversas.agent_mode`. Quando a oficina é reativada (webhook do provedor de pagamento confirma o pagamento), a próxima mensagem cai naturalmente no modo `operacao` / `onboarding`.

Inbound sempre é persistido em `mensagens` para auditoria, independentemente do tratamento.

- Fonte: [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md), `lib/whatsapp/inadimplencia-guard.ts`, `lib/whatsapp/cobranca-agent.ts`.

### 10.4 Lembretes pausados
Quando `oficinas.status != 'ativa'`, o scheduler **não enfileira** lembretes dessa oficina (item 4.3).

---

## 11. Painel admin e auditoria

### 11.1 Acesso restrito
- URL: `/admin/*` no mesmo domínio Next.js (não subdomínio).
- Sessão admin via cookie separado da sessão de oficina.
- Auth: OTP WhatsApp resolvido contra `admin_users` (não `oficinas`).
- WhatsApp não cadastrado → não recebe OTP, mensagem genérica.
- OTP de **uso único**: o consumo marca `used_at` via UPDATE condicional (`used_at is null`) e só emite sessão para o request que efetivamente virou a linha. Duas requisições simultâneas com o mesmo código correto emitem **uma única** sessão; a perdedora recebe a mensagem genérica. Mesma garantia do fluxo do representante.

- Fonte: [ADR-0010](./adr/0010-painel-web-no-mvp.md), [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 11.2 Auditoria obrigatória
- Toda mutação no painel admin registra em `admin_audit_log`: `admin_id`, `ação`, `entidade`, `entidade_id`, `payload` (diff antes/depois), `ip`, `created_at`.
- Helper backend `withAdminAudit(...)` envolve a transação.
- Admin com entradas em `admin_audit_log` **não pode ser excluído** — só `ativo = false`. Preserva trilha.

- Fonte: [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 11.3 MRR em tempo real
- Tela `/admin` calcula MRR somando `COALESCE(preco_negociado, planos.preco_base)` onde `status = 'ativa'`.
- Sem snapshot, sem cache. Revisitar acima de ~500 oficinas ativas.

### 11.4 Ações admin sobre lead
Admin pode, no detalhe de um lead, via painel:
- Mudar status entre não-terminais: `novo | em_conversa | qualificado | interessado | teste_aceito`. Para `convertido` ou `perdido` há ações dedicadas (ver abaixo).
- Reabrir lead `perdido` → volta para `em_conversa`, limpa `motivo_perda`.
- Marcar lead como `perdido` com motivo (rota dedicada; já existia).
- Editar dados qualificatórios: `nome`, `nome_responsavel`, `nome_oficina`, `cidade`, `volume_trocas_mes`, `ticket_medio`, `principal_dor`, `melhor_horario_contato`.
- Trocar WhatsApp do lead com confirmação dupla (digitar o número duas vezes) e checagem de unicidade.
- Converter manualmente em oficina (ver §2.4).
- Soft delete (lead some das listagens; auditoria preservada). Bloqueado se status = `convertido` (oficina ficaria órfã visualmente).

LLM **nunca** dispara essas mudanças (ADR-0001). Toda mutação grava em `admin_audit_log`.

- Fonte: `lib/admin/leads.ts`, `app/api/admin/leads/[id]/route.ts`, `components/admin/lead-detail-actions.tsx`.

### 11.5 Ações admin sobre cliente final
Admin pode, no detalhe de um cliente final, via painel:
- Editar `nome`.
- Trocar WhatsApp com confirmação dupla e checagem de unicidade dentro da mesma `oficina_id`.
- Marcar opt-out com motivo (`ativo → opt_out`, já existia).
- Reativar opt-out informando nova `origem_consentimento` (`opt_out → ativo`).
- Marcar número errado com motivo (`ativo → numero_errado`); cancela lembretes pendentes em cascata.
- Reverter número errado (`numero_errado → ativo`); consentimento WhatsApp não muda.
- Soft delete; cancela lembretes pendentes (`pendente | enfileirado | agendado`) em cascata.

Todas as mutações gravam em `admin_audit_log`. LLM continua proibido de mudar status (ADR-0001).

- Fonte: `lib/admin/clientes.ts`, `app/api/admin/clientes/[id]/route.ts`, `components/admin/cliente-detail-actions.tsx`.

### 11.6 Soft delete (lead e cliente)
- Implementado via colunas `deleted_at`, `deleted_by`, `deleted_reason` em `leads_oficina` e `clientes_finais`.
- Registros com `deleted_at IS NOT NULL` ficam ocultos de listagens e detalhes por padrão (`listLeads`, `getLeadById`, `listClientesFinais`, `getClienteById` filtram por padrão; flag `includeDeleted: true` desativa).
- Não há hard delete pelo painel. Para apagar definitivamente: SQL direto no Supabase.
- Fonte: migration `20260520120000_admin_lead_cliente_actions.sql`.

### 11.7 Fora do escopo do admin no MVP
- Impersonate (entrar como oficina) — não tem.
- Mesclar leads ou clientes duplicados — não tem (planejado para depois).
- Bulk actions em listas — não tem.
- Hard delete pelo painel — não tem (sempre soft).
- Edição operacional de veículos, serviços e lembretes individuais — não tem (apenas o cliente).
- Relatórios customizáveis, multi-tenant/agências, módulo de suporte — não tem.

Para suporte profundo: admin acessa Supabase diretamente.

---

## 12. Multi-tenancy e segurança

### 12.1 RLS obrigatório
Toda tabela com dado de oficina tem `oficina_id` + policy RLS:
- `oficinas`, `clientes_finais`, `veiculos`, `servicos`, `lembretes`, `conversas`, `mensagens`, `retornos`, `outbound_messages`, `agent_tool_calls`, `pagamentos`.

`auth.uid()` na policy resolve para a oficina autenticada.

- Fonte: [ADR-0003](./adr/0003-multi-tenancy-via-rls-oficina-id.md).

### 12.2 Service role bypass
- `SUPABASE_SERVICE_ROLE_KEY` **bypassa RLS**. Usar **só server-side**.
- Qualquer código com service role **deve validar `oficina_id` manualmente**.
- Nunca enviar para client component.

### 12.3 Secrets server-only
Variáveis que **nunca** podem vazar para cliente:
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN` (fallback dev; em produção ficam no Vault)
- `INTERNAL_JOB_SECRET`

Prefixo `NEXT_PUBLIC_` é browser-exposed — nunca usar para secrets. Os segredos dos gateways de pagamento, em produção, ficam no **Supabase Vault** e são geridos pelo painel admin (ADR-0021), não em env.

- Fonte: [`AGENTS.md §Environment`](../AGENTS.md), [runbook env-setup](./runbooks/env-setup.md).

### 12.4 Rota interna protegida
- `/api/internal/whatsapp-reminders/consume` exige header `Authorization: Bearer <INTERNAL_JOB_SECRET>` ou `x-internal-job-secret`.

---

## 13. Comportamento do bot (resumo das proibições)

Lista das coisas que o bot **nunca** faz, com fonte:

| Proibição | Fonte |
|---|---|
| Mudar `lead.status`, `agent_mode`, opt-out ou pagamento só com saída de LLM | [ADR-0001](./adr/0001-llm-como-conselheiro-nao-decisor.md) |
| Cotar preço numérico (nem faixa, nem "depende") | [ADR-0012](./adr/0012-politica-de-preco.md) |
| Confirmar horário ou agendar | [ADR-0009](./adr/0009-confirmacao-vs-pre-agendamento.md) |
| Enviar lembrete sem `consentimento_whatsapp = true` | [PRD §18](./product/PRD-whatsapp-bot.md) |
| Enviar lembrete para cliente em `opt_out` ou `numero_errado` | Item 7.2, 7.3 |
| Enviar mensagem fora do horário configurado da oficina | [PRD §11](./product/PRD-whatsapp-bot.md) |
| Operar normalmente quando oficina está pausada com `motivo_pausa='admin'` | Item 10.3 |
| Inventar integrações, endereço, dados de outra oficina | [PRD §16](./product/PRD-whatsapp-bot.md) |
| Enviar mensagem livre fora da janela de 24h | [ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md) |
| Tomar decisão por prompt injection (`ignore`, `system`, etc.) | `lib/whatsapp/onboarding-agent.ts` |
| Cadastrar troca com mensagem neutra (`ok`, `obrigado`) | Item 3.3 |
| Escolher arbitrariamente entre duas oficinas com mesmo cliente | Item 5.4 |
| Expor secret server-only para client component | Item 12.3 |
| Suporte: prometer prazo de retorno, reabrir acesso, mudar `oficinas.status` ou tocar `pagamentos` | Item 14 |
| Cobrança: prometer prazo, parcelamento, desconto ou condição comercial; gerar link MP novo | Item 15 |
| Enviar resposta gerada por LLM sem passar pelo validador determinístico; texto gerado mudar estado | [ADR-0020](./adr/0020-camada-geracao-conversacional.md) |
| Inventar resposta fora do conhecimento fornecido (deve admitir e encaminhar — protocolo "não sei") | [ADR-0020](./adr/0020-camada-geracao-conversacional.md) |

### 13.1 Camada de geração conversacional (ADR-0020)

O bot pode **gerar** o texto de saída via LLM (`OPENAI_MODEL_RESPONDER`), mas dentro de uma camada com garantias determinísticas:

- **Dois modos de geração** ([ADR-0022](./adr/0022-modo-respond-grounded.md)): **rewrite** (CV1) reescreve o tom da enlatada, proibido de adicionar conteúdo; **respond** (CV2) responde a pergunta do usuário grounded **apenas** no bloco de conhecimento fechado (`lib/whatsapp/product-knowledge.ts` + FAQ do banco **filtrada por regex de preço** + link de handoff). Respond exige `userMessage` (sem ela degrada para rewrite) e é acionado pela categoria `pergunta` da operação (§3.3) e pelo caso geral do `fora_escopo` de vendas ([ADR-0024](./adr/0024-respond-em-vendas.md)). O conhecimento varia por modo: operação usa `PRODUCT_FACTS` + nome da oficina (`buildOperationKnowledge`); vendas usa `PRODUCT_FACTS` + `SALES_FACTS` (teste grátis 14 dias etc.), sem nome de oficina (`buildSalesKnowledge`) — fatos de vendas **nunca** entram na operação. O objetivo do momento no prompt muda por `agent_mode` (vendas → ativar o teste; operação → registrar trocas). Protocolo "não sei": fora do conhecimento → `dontKnow=true` → enlatada (que na `pergunta` é handoff para humano; em vendas é o pool de fora_escopo).
- **Fronteira de estado**: a geração produz apenas `string`. Toda decisão de estado (`lead.status`, `participant_type`, `agent_mode`, pagamento, opt-out, status de lembrete) continua determinística ([ADR-0001](./adr/0001-llm-como-conselheiro-nao-decisor.md)). O backend define o esqueleto (fatos permitidos + ação + CTA); o LLM define a redação.
- **Validador de saída** (`lib/whatsapp/reply-validator.ts`): reprova preço ≠ `precoPartida` — numérico (parsing pt-BR distingue milhar de decimal: `R$ 5.9` ≠ `R$ 59`) ou escrito por extenso ("cento e noventa reais") —, promessa de resultado/agenda/prazo, URL fora da allowlist (links são normalizados por NFKC + mapa de confusáveis Unicode antes da checagem: pontos/barras ideográficos e hosts com homóglifo não burlam a allowlist), vazamento cross-tenant e tamanho acima do cap. Em qualquer dúvida, reprova (fail-safe → enlatada).
- **Fallback**: erro, timeout ou reprovação → envia a resposta enlatada padrão (comportamento pré-ADR-0020). Nunca há regressão pior que o bot determinístico.
- **Modo** (`configuracoes_vendedor.geracao_llm_modo`): `off` (idêntico ao histórico) · `sombra` (gera+valida+loga, envia enlatada) · `on` (envia gerada aprovada). Kill switch permanente.
- **Blindagem de respostas transacionais**: mesmo com o modo `on`, o **resumo de confirmação de cadastro** (pré-registro), a **pergunta de campo faltante** e a **captura do nome da oficina** permanecem **determinísticos** (o webhook força `off` via `allowGeneration`). Reescrever o resumo de confirmação poderia adulterar/omitir um campo e derrubar a rede de segurança da [ADR-0017](./adr/0017-confirmacao-antes-de-registrar-troca.md) (a oficina confere o dado exato antes do template irreversível ao cliente frio). Marcação em `OnboardingAgentReply.allowConversationalGeneration`.
- **Moldura gerada com dados literais (CV6)**: o **ack de "cliente cadastrado"** (pós-registro) passa a aceitar geração em **rewrite** — o nome e os dias já estão no texto, então o rewrite só varia a moldura e o validador barra qualquer fato inventado; os dados extraídos seguem literais. As **consultas read-only da operação** (§3.3-bis) devolvem os dados **literais**: a lista de lembretes fica determinística (sem geração, pra não perder item); só respostas curtas (contagem do mês, "cliente não encontrado") aceitam moldura em rewrite.
- **Auditoria**: cada geração registra versão do prompt (`cv2-2`), **`generationMode` (`rewrite|respond`)**, intenção (`pergunta` na operação, `fora_escopo` em vendas), `userMessage` truncado (~300 chars), aprovação/reprovação e uso de fallback em `agent_tool_calls`.
- **Protocolo "não sei"**: fora do conhecimento fornecido, admite e encaminha (no respond, a enlatada de fallback já é um handoff). O gerador distingue `dont_know` de falha operacional: no audit, `dontKnow` registra `rejectionReason: "generation_dont_know"` (`generation_failed_or_null` fica só para erro/timeout).
- **Humanização fina (CV7)**: antes de responder, o webhook marca o inbound como **lido** e mostra **"digitando…"** (`markReadAndTyping`, uma chamada da Cloud API, best-effort). Resposta de texto acima de **~350 chars** é quebrada em até **2 mensagens sequenciais** numa fronteira natural (regra no sender, `splitLongMessage` — não no LLM); cada parte vira uma linha em `mensagens`.
- **`bot_muted` (CV7)**: ao passar pro humano, todo handoff seta `conversas.bot_muted_until = now() + 24h` (dentro de `markConversationHandoff`). Enquanto `bot_muted_until > now()`, o webhook **registra o inbound mas não responde nada** (`isBotMuted` — gate logo após salvar a mensagem) — resolve o bot atropelar o humano no pós-handoff. Expira sozinho em 24h ou é limpo quando o admin resolve o handoff (`resolverHandoff`).
- **Métricas e qualidade do número (CV7)**: `/admin/metricas-conversacional` agrega sobre `agent_tool_calls`/`mensagens`/`conversas` (RPC `get_conversational_metrics`): % gerada×enlatada×reprovada, handoff, mensagens e gerações por intenção. O último evento de qualidade do número Meta (webhook `phone_number_quality_update`/`account_update`) é guardado em `meta_phone_status` e exibido com alerta de cor — o volume do follow-up proativo (CV4) pressiona o rating, que é o ativo mais caro do produto.
- **Volante de aprendizado** ([ADR-0023](./adr/0023-perguntas-sem-resposta.md)): quando o modo **resolvido** foi respond e o LLM devolveu `dontKnow`, a pergunta vira registro em **`perguntas_sem_resposta`** (`agent_mode`, pergunta ≤500 chars, resposta enlatada enviada, `motivo` (v1 só `dont_know`), `geracao_modo`, `prompt_version`, `status` para triagem futura). Grava em `sombra` **e** `on` (sombra também aprende); gravação best-effort (falha nunca derruba a resposta); rewrite+`dontKnow` **não** grava (significa "não consegui reescrever", não "pergunta sem resposta"). O ciclo fecha sem deploy: registro → admin cria FAQ em `faq_vendas` → próxima mensagem já usa a FAQ no bloco de conhecimento.

---

## 14. Modo suporte (`agent_mode='suporte'`)

### 14.1 Entrada e saída
- **Entrada**: oficina-cliente em `agent_mode='operacao'` envia exatamente `/suporte` (case-insensitive, após `trim()`). O webhook flipa o modo e responde uma saudação fixa.
- **Saída pelo cliente**: oficina envia `/voltar` → modo volta a `operacao`.
- **Saída pelo admin**: rota `POST /api/admin/conversas/[id]/resolver-handoff` marca handoff como resolvido e, se o modo atual for `suporte`, volta automaticamente para `operacao`.

### 14.2 Escopo v1
- Só `participant_type='oficina_cliente'`. Cliente final e contato desconhecido ficam fora.

### 14.3 Intenções fechadas
- `duvida_uso` → responde direto, sem handoff.
- `bug_ou_travamento` → responde + handoff (`handoff_reason='bug_ou_travamento'`).
- `cobranca` → responde encaminhando + handoff (`handoff_reason='duvida_cobranca'`).
- `outro` → resposta neutra + handoff (`handoff_reason='mensagem_ambigua'`).

### 14.4 Proibições adicionais do suporte
- Nunca prometer prazo de retorno ("respondo em 5 minutos").
- Nunca reabrir acesso, mudar `oficinas.status` ou tocar `pagamentos`.
- Nunca prometer correção de bug — apenas escalar.
- Nunca oferecer desconto, parcelamento ou condição comercial.

- Fonte: `lib/whatsapp/support-agent.ts`, `.codex/prompts/whatsapp-suporte.md`.

---

## 15. Modo cobrança (`agent_mode='cobranca'`)

### 15.1 Entrada e saída
- **Entrada**: webhook detecta `oficinas.status='pausada'` em uma conversa de `participant_type='oficina_cliente'` e roteia conforme `motivo_pausa` (ver tabela em item 10.3).
- `agent_mode='cobranca'` é override de runtime no webhook — **não** é persistido em `conversas.agent_mode`.
- **Saída**: pagamento confirmado pelo webhook do Mercado Pago reativa a oficina (`status='ativa'`). Próxima mensagem cai no modo `operacao` / `onboarding` naturalmente.

### 15.2 Submodes
- `cobranca_inadimplente` — `motivo_pausa='inadimplencia'`. Foco em pagamento.
- `cobranca_winback` — `motivo_pausa='voluntaria'`. Foco em entender por que pausou e oferecer ponte com humano.

### 15.3 Intenções fechadas
- `pediu_link` (inadimplente) → responde com link MP se houver pagamento pendente, senão handoff `link_indisponivel`.
- `vai_pagar` → mesma resposta de `pediu_link`.
- `ja_paguei` → **sempre handoff** (`verificar_pagamento`). Humano confere e reativa.
- `negocia_prazo` → **sempre handoff** (`negocia_prazo` / `negocia_winback`). Sem exceção.
- `quer_voltar` (winback) → handoff `reativacao_voluntaria`.
- `nao_quer_voltar` (winback) → resposta cordial, sem handoff.
- `disputa` → handoff (`disputa_cobranca` / `disputa_winback`).
- `outro` → inadimplente: manda valor + vencimento + link; winback: pergunta o que faltou.

### 15.4 Link de pagamento
- Sempre lê `mp_preference_id` do `pagamentos` mais recente com `status='pendente'` da oficina (`getLatestPendingPagamento`).
- Formato: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id={mp_preference_id}`.
- Agente **nunca** gera preference nova. Se não houver, handoff.

### 15.5 Proibições adicionais da cobrança
- Nunca prometer prazo (`"pode pagar dia 25"` está proibido).
- Nunca prometer desconto, parcelamento ou condição comercial.
- Nunca confirmar pagamento sem o webhook MP — `ja_paguei` é sempre handoff.
- Nunca mudar `oficinas.status`, `oficinas.motivo_pausa` ou qualquer campo de `pagamentos`.
- Nunca gerar link de pagamento novo. Só reusa o existente.

- Fonte: `lib/whatsapp/cobranca-agent.ts`, `lib/whatsapp/inadimplencia-guard.ts`, `.codex/prompts/whatsapp-cobranca.md`.

---

## 16. Inteligência de mercado

### 16.1 Escopo
- Painel `/admin/inteligencia-mercado` mostra agregações de cadastros (não de receita) extraídas de `servicos.tipo_servico` e `servicos.marca_peca`.
- Quatro cards: mix por tipo, market-share de amortecedor, top cidades, cohort Perfect.
- Filtro de período (default últimos 90 dias) e cidade (afeta apenas market-share).
- Fonte: `lib/admin/inteligencia-mercado.ts`, `app/admin/(autenticado)/inteligencia-mercado/page.tsx`.

### 16.2 Regras anti-viés Perfect
- Market-share renderizado em **ordem alfabética** (Cofap, Monroe, Nakata, outra, Perfect). Perfect **nunca** aparece primeiro em UI ou em qualquer pergunta do bot.
- Pergunta do `onboarding-agent` quando `tipo='amortecedor'` segue a mesma ordem (ver §3.2).
- Lista fechada com `'outra'` explícito reduz pressão de escolher Perfect quando a oficina não sabe a marca.

### 16.3 Política de uso externo
- **Admin-only**. Dados de cadastros são internos do Quando Trocar.
- **Não compartilhar relatórios externos** (ex: enviar pra Perfect ou outro fabricante) sem revisão jurídica/contratual. Mesmo agregado, market-share pode revelar oficinas individuais em cidades pequenas (re-identificação).
- Decisão de monetizar dado de mercado (vender relatório) exige nova ADR antes da primeira venda.

### 16.4 Performance
- Queries usam o índice `servicos_tipo_servico_idx` `(oficina_id, tipo_servico, data_servico desc)` criado na Fase 1 (`20260521000000_tipo_servico_marca_peca.sql`).
- Agregações in-memory no Node (não SQL `group by`) — vale até ~100k linhas de `servicos`. Acima disso, mover para RPC.

---

## 17. Áudio e transcrição

Fonte canônica: [ADR-0015](./adr/0015-suporte-audio-whisper.md), [Fase 5 do backlog](./backlog-whatsapp-bot/fase-5-audio.md).

### 17.1 Aceitação de áudio
- O bot **aceita** mensagens com `type === "audio"` (notas de voz e arquivos de áudio) de qualquer participante (`lead_oficina`, `oficina_cliente`, `cliente_final`, `contato_desconhecido`). Lead e oficina são tratados igualmente.
- Outros tipos de mídia (`image`, `document`, `sticker`, `video`, `location`, `contacts`, ou tipos desconhecidos) **não são mais descartados em silêncio** — o bot responde com um fallback contextual por agente em cena. Veja **17.7**.

### 17.2 Transcrição
- Áudios são transcritos via **OpenAI Whisper** (`model: whisper-1`, `language: "pt"`) de forma **síncrona** dentro do webhook.
- **Timeout duro de 15s**. Acima disso a transcrição é abandonada e o bot envia um fallback.
- A transcrição é tratada exatamente como uma mensagem de texto — passa por `conversation-router` e chega ao agente em cena (vendas/onboarding/operação/lembrete/suporte/cobrança) como `inbound.body`.

### 17.3 Fallback contextual
- Quando a transcrição falha (`failed`, `empty`, `timeout`), o bot envia uma mensagem fixa **no tom do agente em cena**, definida em `lib/whatsapp/audio-fallbacks.ts`. O agente **não** é chamado nesses casos.
- Mensagens nunca expõem termos técnicos ("Whisper", "OpenAI", "timeout"); sempre pedem que o cliente mande por texto.

### 17.4 Retenção e privacidade
- **O áudio bruto não é armazenado**. Apenas a transcrição é persistida em `mensagens.transcription`. O `media_id` Meta original fica em `mensagens.raw_payload` para auditoria — mas a URL Meta expira em ~5min, então recuperação do áudio original não é possível depois disso.
- Transcrição **nunca** vai para logs estruturados (PII). Logs registram apenas `transcription_status` e `audio_duration_ms`.

### 17.5 Persistência
- Colunas em `mensagens` (migration `20260524000000_phase_5_audio_transcription.sql`): `media_type` (`text`|`audio`, default `text`), `media_id`, `transcription`, `transcription_status` (`success`|`failed`|`empty`|`timeout`), `transcription_error`, `audio_duration_ms`.
- `body` continua sendo `not null`: recebe a transcrição em caso de sucesso, ou string vazia em caso de falha (com `transcription_status` indicando o motivo).

### 17.6 Idempotência
- Áudio reentregue pelo Meta cai no mesmo `provider_event_id` UNIQUE — **não há segunda chamada ao Whisper**. Comportamento idêntico ao texto.

### 17.7 Pipeline de imagem e documento PDF

Fonte canônica: [ADR-0016](./adr/0016-suporte-imagem-pdf-sem-storage.md).

- **Imagem** (`mediaType === "image"`): o bot baixa o arquivo, chama `gpt-4o-mini` em modo vision com prompt contextualizado de oficina pt-BR, timeout 12s. Resultado vira `inbound.body = "[imagem] <descrição>"` (com legenda do usuário concatenada, se houver) e segue para o agente em cena, como faz com áudio. Em falha, empty, ou timeout, cai no fallback contextual abaixo.
- **Documento** (`mediaType === "document"`): apenas `application/pdf`. Texto extraído com `unpdf` (local, sem custo OpenAI), timeout 8s, truncado em 2000 chars. PDFs escaneados ou com menos de 50 caracteres úteis caem em `empty` e disparam fallback (não roteiam para vision). Sucesso vira `inbound.body = "[documento] <texto>"`.
- **Mídia bruta nunca é armazenada** — confirma ADR-0015 ponto 2. Apenas a transcrição/descrição/texto extraído fica em `mensagens.transcription`. `media_id` original em `raw_payload` para rastreabilidade.
- A coluna `transcription` (nome herdado da Fase 5) comporta também imagem e PDF — não foi renomeada para evitar churn.

### 17.8 Fallback para mídia sem pipeline próprio

- O parser em `lib/whatsapp/payload.ts` emite `mediaType` para **todos** os tipos conhecidos do WhatsApp Cloud API. Nenhum tipo conhecido cai mais em descarte silencioso.
- Quando o pipeline próprio (vision/PDF) falha, ou quando `mediaType` é `sticker`, `video`, `location`, `contacts` ou `unsupported`, o webhook **não chama agente**: envia um fallback contextual escolhido por `(agentMode, mediaType)` definido em `lib/whatsapp/unsupported-media-fallbacks.ts` e persiste a mensagem com `mediaType` correspondente.
- A linha em `mensagens` é gravada normalmente — `media_type` corresponde ao tipo recebido, `body = ""`, e o `raw_payload` preserva o evento original para auditoria.
- A constraint `mensagens_media_type_check` foi ampliada pela migration `20260525000000_mensagens_media_types_extra.sql` para aceitar todos os tipos.

### 17.9 Rate limit de mídia paga

- Imagem + documento combinados são limitados a **`WHATSAPP_MEDIA_DAILY_LIMIT` (default 50)** mensagens inbound por número de WhatsApp, em janela rolling de 24h.
- Excedido o limite, o webhook **não chama** o pipeline (sem custo de vision/OpenAI), grava a mensagem com `transcription_status = 'failed'` e `transcription_error = 'rate_limit'`, e dispara o fallback contextual.
- Áudio (Whisper) **não** tem rate limit — custo é uma ordem de magnitude menor.
- Métricas para acompanhar: [runbook `whatsapp-media-metrics.md`](./runbooks/whatsapp-media-metrics.md).

---

## 18. Representantes e comissão

Fonte canônica: [ADR-0019](./adr/0019-representantes-e-comissao.md) (supersede a [ADR-0011](./adr/0011-visibilidade-de-representante.md)), plano [fase-representantes-comissao](./backlog-whatsapp-bot/fase-representantes-comissao.md).

### 18.1 Cadastro de representante
- Tabela `representantes`: `nome`, `whatsapp` (E.164, único), `codigo` (único, curto, case-insensitive), `ativo`, override opcional de comissão (`comissao_tipo`, `comissao_valor`, `comissao_duracao_meses`), soft delete (`deleted_at`).
- Gerenciado em `/admin/representantes`. Exclusão exige confirmar o nome exato (mesmo padrão de oficinas §2.6); representante com comissões registradas não pode ser excluído — só desativado.
- Fonte: `lib/admin/representantes.ts`, migration `20260709000000_representantes_comissao.sql`.

### 18.2 Atribuição de lead a representante
- O representante divulga link `wa.me` cuja primeira mensagem carrega `#REP-<codigo>` (ex.: `Oi quero testar o Quando Trocar #REP-CARLOS`).
- `extractRepresentanteCodigo()` (determinístico, sem LLM — ADR-0001) extrai o código e o **remove** da mensagem antes de `detectLeadOrigin()` (o match da frase-gatilho é exato) e antes do agente vendedor processar o texto.
- `upsertLead` resolve o código para `leads_oficina.representante_id` **apenas se** o lead ainda não tem representante e o representante está ativo e não deletado. Código desconhecido/inativo → ignorado em silêncio (lead entra sem atribuição).
- Fonte: `lib/whatsapp/sales-agent.ts`, `lib/whatsapp/conversation-router.ts`, `lib/whatsapp/repository.ts`.

### 18.3 Atribuição da oficina
- Na conversão (bot `convertLeadToOficina` ou admin RPC `convert_lead_to_oficina_manual`), `representante_id` do lead é copiado para `oficinas.representante_id`.
- Admin pode definir/alterar/remover o representante de uma oficina pelo modal de edição — auditoria `oficina.update_representante`.
- Atribuição posterior **não** gera comissão retroativa: só pagamentos confirmados depois da atribuição.

### 18.4 Política de comissão (tudo configurável no painel)
- Singleton `configuracoes_comissao` (seção "Comissão de representantes" em `/admin/configuracoes`): `comissao_tipo` (`percentual | fixo`), `comissao_valor`, `comissao_duracao_meses` (null = vitalícia), `comissao_base` (`valor_pago | preco_tabela`).
- Override por representante: `representantes.comissao_tipo/valor/duracao_meses` — quando preenchidos, vencem o default global (mesmo padrão `preco_negociado ?? preco_base`). O override é atômico: `comissao_tipo` + `comissao_valor` andam juntos.
- Defaults seedados: percentual, 20%, vitalícia, base `valor_pago`.
- Risco aceito: `comissao_base = 'preco_tabela'` com `preco_negociado` abaixo da tabela pode gerar comissão maior que a receita — a UI avisa ao selecionar.

### 18.5 Geração da comissão
- Disparo: webhook Mercado Pago confirma `pagamentos.status = 'pago'` de oficina com representante ativo → cria linha em `comissoes` com **snapshot** da regra vigente (`tipo`, `taxa_aplicada`, `base_valor`, `valor`). Mudança de configuração não altera comissões já geradas.
- Idempotência: `comissoes.pagamento_id UNIQUE` — webhook repetido não duplica.
- `comissao_duracao_meses = N` → só os N primeiros pagamentos `pago` da oficina geram comissão.
- **Não bloqueante**: falha na geração é logada mas nunca derruba o processamento do pagamento nem a reativação da oficina (mesmo princípio da §3.6).
- Fonte: `gerarComissaoParaPagamento` em `lib/admin/comissoes.ts`, `app/api/webhooks/mercado-pago/route.ts`.

### 18.6 Ciclo de vida e payout
```
prevista · paga · cancelada
```
- `prevista → paga`: admin marca ao transferir o valor ao representante (Pix por fora do sistema), individual ou em lote por representante/período. Auditoria `comissao.marcar_paga`.
- `prevista → cancelada`: estorno/erro, com motivo. Comissão `paga` não pode ser cancelada nem voltar a `prevista`.
- Extrato em `/admin/comissoes`; card de comissão prevista no mês no dashboard `/admin`.
- Sem split automático de pagamento no MVP (ADR-0019).

### 18.7 Portal do representante
Fonte canônica: [ADR-0025](./adr/0025-portal-do-representante.md) (estende a ADR-0019), plano [fase-representante-portal](./backlog-whatsapp-bot/fase-representante-portal.md). Módulo `portal-representante`.

- **Área própria e read-only** em `app/representante`, separada do painel admin. O representante faz login e **apenas consulta**: carteira de oficinas, leads atribuídos, extrato de comissões, playbook de vendas e novidades. Nenhuma ação que muda estado (marcar comissão paga/cancelada continua exclusiva do admin, §18.6).
- **Login por OTP-no-WhatsApp contra `representantes`** (não há tabela `rep_users`): busca por `whatsapp` + `ativo = true` + `deleted_at is null`. Reaproveita o template Meta de OTP de oficina/admin (`WHATSAPP_TEMPLATE_OTP_NAME`). `auth_otps.target` passa a aceitar `'representante'`; `representantes.ultimo_acesso_em` registra o último login. Herda o hardening do admin: rate-limit, hash HMAC-SHA256, expiração 5 min, máx. 5 tentativas, uso único (consumo atômico), resposta genérica (sem enumeração).
- **Sessão isolada do admin**: cookie `qt_rep_session`, secret `REP_SESSION_SECRET`, claim `isRepresentante`, TTL 14 dias. Cookie de admin não acessa `/representante` e vice-versa.
- **Escopo imposto no código** (não há RLS por tenant — ADR-0003 estado real): toda query de `lib/representante/*` recebe `representante_id` **da sessão**, nunca do request. Rep A nunca vê dados de rep B. O guard re-verifica `ativo`/`deleted_at` **a cada request** (rep desativado mid-sessão perde acesso). Comissões reaproveitam `listComissoes` do admin via wrapper que injeta o `representante_id` da sessão.
- **LGPD — sem PII de cliente final**: as telas de carteira mostram a oficina (contato comercial legítimo do rep: responsável, WhatsApp da oficina, cidade, plano) e **números agregados** (qtd. de clientes finais cadastrados, lembretes enviados/respondidos), nunca nome/WhatsApp de cliente final.
- **Playbook e novidades são conteúdo estático** no código (`lib/representante/content/*`), curados no repositório; publicar = editar constante + deploy (runbook `docs/runbooks/publicar-novidade-representante.md`). Playbook não traz preço/condição comercial (ADR-0012). A visão geral também mostra o código e o link `wa.me` próprio do rep com botão copiar.
- Fonte: `lib/representante/{session,otp,api-guard,carteira,leads,comissoes,dashboard}.ts`, `app/representante/**`, migration `20260718120000_portal_representante.sql`.

### 18.8 Convite do representante por WhatsApp (manual)
- Em `/admin/representantes`, cada representante tem um botão **"Convidar pelo WhatsApp"** (ícone) que dispara um template com o link do portal (`/representante`). Serve para dar o primeiro acesso: o representante clica, entra com o próprio WhatsApp e recebe o OTP (§18.7).
- **Template obrigatório** (`WHATSAPP_TEMPLATE_CONVITE_REP_NAME`, categoria Marketing — boas-vindas/convite, `pt_BR`): o representante quase nunca está na janela de 24h, então texto livre seria rejeitado pela Meta. Variáveis **nomeadas** `{{nome}}` = primeiro nome, `{{link}}` = link do portal. Copy no runbook `docs/runbooks/meta-whatsapp-setup.md §12`. Enquadrar como aviso/boas-vindas: evitar termos de acesso/login no corpo ("código", "acesse", "entrar", "seu número de WhatsApp", "portal"), que a Meta lê como template de OTP. Categoria não afeta o código de envio.
- **Só representante ativo** pode ser convidado — inativo não loga no portal; a rota recusa (409) e o botão fica desabilitado. Sem template configurado → 503 (não envia).
- Ação iniciada por admin humano (ADR-0001), auditada como `representante.convite_enviado`. O convite **não** cria sessão nem muda estado do representante — é só a mensagem.
- Fonte: `app/api/admin/representantes/[id]/convidar/route.ts`, `lib/admin/convite-representante.ts`, `components/admin/representantes-client.tsx`.

---

## Como manter este doc

- **Regra mudou na fonte canônica** (ADR/PRD/código) → atualize a entrada aqui e registre no [Context Changelog](./CONTEXT_CHANGELOG.md) se for mudança estrutural.
- **Regra nova** → adicione na seção correta e cite a fonte. Se não tem fonte canônica ainda, crie ADR antes.
- **Conflito entre fontes** → a fonte canônica vence. Atualize a fonte mais recente para coincidir, não duplique a regra com versões diferentes.
- **Este doc nunca é a única fonte** — sempre cite o documento original.
