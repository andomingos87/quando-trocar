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
pergunta_funcionamento · informa_volume_ticket · pergunta_preco · pergunta_faq · small_talk · quer_testar · sem_interesse · fora_escopo
```

**Ordem de detecção em `classifySalesMessage`:**
1. `isExplicitLossMessage` → `sem_interesse` (com confidence alta).
2. **`detectPain` → `pergunta_funcionamento`** (override forte: dor relatada sempre vira explicação do produto, exceto quando explicit loss).
3. `detectPriceQuestion` → `pergunta_preco`.
4. `extractVolumeOrTicket` → `informa_volume_ticket`.
5. Regex de funcionamento ("como funciona", etc.) → `pergunta_funcionamento`.
6. Regex de interesse ("quero testar", etc.) → `quer_testar`.
7. **`detectSmallTalk` → `small_talk`** (mensagens humanas tipo "que time você torce").
8. `matchFaq` → `pergunta_faq`.
9. Default → `fora_escopo`.

Há um segundo gate dentro de `WhatsappSalesAgent.generateReply`: se o OpenAI fallback classificar como `sem_interesse` mas a mensagem disparar `detectPain` sem `isExplicitLossMessage`, o agente sobrescreve para `pergunta_funcionamento`.

Transições válidas (decisão determinística, não LLM):

| Intent classificado | Status resultante | Regra determinística |
|---|---|---|
| `pergunta_funcionamento` | `em_conversa` | sempre; copy curta na 2ª aparição (`funcionamento_explained`) |
| `informa_volume_ticket` | `qualificado` | quando há volume + ticket válidos (memorizados ao longo de várias mensagens) |
| `pergunta_preco` | mantém status atual | nunca rebaixa lead; incrementa contador; se memória tem volume+ticket, conecta com ROI |
| `pergunta_faq` | mantém status atual | resposta vem de `faq_vendas` por match de palavra-chave |
| `small_talk` | mantém status atual | resposta curta de redirect; não conta como fallback |
| `quer_testar` | `teste_aceito` | dispara conversão |
| `sem_interesse` | `perdido` | **só** se mensagem passa em `isExplicitLossMessage()` |
| `fora_escopo` | mantém status atual | nunca rebaixa lead `interessado`; copy curta na 2ª aparição |

**Saudação no primeiro turno:** quando `context.sales.greeted !== true`, as respostas de `pergunta_funcionamento` e `fora_escopo` (que são os "explicadores") recebem o prefixo *"Fala chefe! Aqui e do Quando Trocar — a gente faz o cliente que troca oleo (ou faz revisao) voltar pro proximo servico."*. Flag persistida no contexto.

- Fonte: [PRD §8](./product/PRD-whatsapp-bot.md), [`.codex/prompts/whatsapp-sales-agent.md`](../.codex/prompts/whatsapp-sales-agent.md), `lib/whatsapp/sales-agent.ts`.

### 1.3 Cálculo de ROI exibido ao lead
- Fórmula: `receita_recuperada = trocas_mês × ticket_médio × taxa_recuperacao_roi`.
- **Taxa default: 15%**, configurável no painel em `configuracoes_vendedor.taxa_recuperacao_roi`.
- Bot apresenta como tendência ("oficinas do seu tamanho costumam trazer de volta uns X%"), não como promessa.
- Volume + ticket podem ser informados em mensagens separadas — o bot memoriza no `conversas.context.sales`.
- Registrado em `agent_tool_calls` como `calculate_roi`.
- Fonte: [PRD §7](./product/PRD-whatsapp-bot.md), `calculateRoi()` em `lib/whatsapp/sales-agent.ts`, `/admin/configuracoes`.

### 1.4 Bot vendedor — política de preço
- Bot **fala valor de partida** ("a partir de R$ X"), nunca o valor final. Fonte do número: `planos.preco_base` do plano default (gerenciado em `/admin/planos`). Default seedado: R$ 59,00.
- Primeira pergunta de preço → resposta com "a partir de R$ X" + redirect pro teste grátis. Contador `sales.price_mentions` é incrementado.
- Segunda pergunta de preço (insistência) → handoff `wa.me` para WhatsApp comercial. Número configurado em `configuracoes_vendedor.whatsapp_handoff_comercial`.
- Bot nunca diz "depende", nunca dá faixa, nunca compromete o valor final.
- Fonte: [ADR-0012](./adr/0012-politica-de-preco.md), [`.codex/prompts/whatsapp-sales-agent.md`](../.codex/prompts/whatsapp-sales-agent.md).

### 1.5 FAQ do vendedor
- Perguntas comuns vivem em `faq_vendas` (gerenciada em `/admin/faq`).
- Match por palavra-chave: para cada FAQ ativa, conta quantas `palavras_chave` aparecem na mensagem normalizada (sem acento, lower-case). FAQ com mais matches vence; empate desempata pela menor `ordem`.
- Cache de 60s no agente (`SupabaseWhatsappRepository.listActiveFaqs`). Edições no admin demoram até 1 minuto pra refletir no bot.
- Tool call registrada como `faq_lookup`.
- Fonte: `lib/whatsapp/sales-agent.ts`, `lib/admin/faq.ts`.

### 1.6 Handoff comercial direto
O vendedor faz handoff (mantém status e marca `conversas.handoff_required = true`) nos seguintes casos:
- Pergunta de preço com `sales.price_mentions ≥ 1` → reason `preco_insistente`.
- Mensagem cita rede/franquia/matriz/filial → reason `rede_ou_franquia`.
- Volume informado > 300 trocas/mês → reason `volume_alto`.
- Em todos os casos, envia link `wa.me` para `configuracoes_vendedor.whatsapp_handoff_comercial`.
- Fonte: `lib/whatsapp/sales-agent.ts`, `lib/whatsapp/webhook-handler.ts`.

---

## 2. Conversão (lead → oficina)

### 2.1 Critérios para virar cliente
Uma oficina vira `cliente_ativo` quando:
- aceita iniciar teste, **ou**
- aceita contratar, **ou**
- confirma que quer começar a cadastrar clientes.

Dados mínimos coletados no fluxo: `nome_oficina`, `whatsapp_principal`.

- Fonte: [PRD §8](./product/PRD-whatsapp-bot.md).

### 2.2 Ações no banco na conversão
- Cria registro em `oficinas` com `status = ativa`, `plano = teste`, `origem = landing_whatsapp`.
- `leads_oficina.status = convertido`, preenche `converted_at` e `oficina_id`.
- Conversa transita: `participant_type = oficina_cliente`, `agent_mode = onboarding`.
- Tudo via RPC transacional `convertLeadToOficina` (`lib/whatsapp/repository.ts`).

### 2.3 Cadastro manual de oficina (painel admin)
- Admin pode criar oficina pelo painel com `origem = 'manual'` (pula bot vendedor).
- Útil para captação offline, eventos, indicações.
- Fonte: [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

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
5. `data_servico`

Opcional: `valor`.

Se faltar algum, o bot pergunta **só o primeiro faltante**, persiste o draft parcial em `conversas.context.service_draft`, e completa multi-turn.

- Fonte: [PRD §10](./product/PRD-whatsapp-bot.md), [`.codex/prompts/whatsapp-onboarding-agent.md`](../.codex/prompts/whatsapp-onboarding-agent.md), `lib/whatsapp/onboarding-agent.ts`.

### 3.3 Guardrails operacionais
Bot **não** inicia cadastro nem preenche campo quando:
- mensagem é neutra (`ok`, `obrigado`, `bom dia`, `valeu`);
- mensagem é uma pergunta (começa com `qual`, `como`, contém `?`);
- mensagem tem padrão de prompt injection (`ignore`, `instrucoes`, `drop table`, etc.) — registra `blocked_prompt_injection` em `agent_tool_calls`.

- Fonte: `lib/whatsapp/onboarding-agent.ts`.

### 3.4 Criação automática quando draft completo
Quando todos os campos obrigatórios estão preenchidos, RPC `register_service_with_reminder` cria atomicamente:
- `clientes_finais` (ou reusa se já existe por `(oficina_id, whatsapp)`)
- `veiculos` (ou reusa)
- `servicos` (sempre novo)
- `lembretes` (apenas se `consentimento_whatsapp = true`)

- Fonte: [PRD §10](./product/PRD-whatsapp-bot.md), migration `20260426021529_phase_2_conversion_onboarding.sql`.

### 3.5 Preservação de status do cliente
RPC `register_service_with_reminder` **não reativa** cliente que já está em:
- `opt_out`
- `numero_errado`

Mesmo se a oficina mandar novo cadastro do mesmo número.

- Fonte: migration `20260426130513_phase_3_real_reminders.sql`.

---

## 4. Lembretes automáticos

### 4.1 Prazo padrão
- `proximo_lembrete = data_servico + dias_lembrete_padrao` (default 90 dias, por oficina).
- Configurável por oficina em `oficinas.dias_lembrete_padrao`.
- Fonte: [PRD §10](./product/PRD-whatsapp-bot.md).

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
- Template: `lembrete_troca_oleo` (parâmetros: nome cliente, nome oficina, veículo).
- Texto renderizado salvo em `outbound_messages` para auditoria.
- Fonte: [ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md), `lib/whatsapp/reminder-agent.ts`.

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
| `lembrete_troca_oleo` | Utility | Lembrete automático |
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
- Cron diário gera **preferência avulsa** Mercado Pago para oficinas com vencimento em D-3 e envia link por WhatsApp.
- **Não usa** Mercado Pago Subscriptions (não suporta Pix recorrente).
- Idempotência via `pagamentos.mp_payment_id UNIQUE`.

- Fonte: [ADR-0008](./adr/0008-pagamento-no-mvp.md), [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 9.4 Vencimento e próxima cobrança
- `oficinas.proximo_vencimento date` indica data alvo da próxima cobrança.
- Inicializado quando a oficina ativa o plano pago.

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

`agent_mode='cobranca'` é um **override de runtime** dentro do webhook — não persiste em `conversas.agent_mode`. Quando a oficina é reativada (webhook MP confirma pagamento), a próxima mensagem cai naturalmente no modo `operacao` / `onboarding`.

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

- Fonte: [ADR-0010](./adr/0010-painel-web-no-mvp.md), [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 11.2 Auditoria obrigatória
- Toda mutação no painel admin registra em `admin_audit_log`: `admin_id`, `ação`, `entidade`, `entidade_id`, `payload` (diff antes/depois), `ip`, `created_at`.
- Helper backend `withAdminAudit(...)` envolve a transação.
- Admin com entradas em `admin_audit_log` **não pode ser excluído** — só `ativo = false`. Preserva trilha.

- Fonte: [ADR-0013](./adr/0013-painel-admin-escopo-billing-auditoria.md).

### 11.3 MRR em tempo real
- Tela `/admin` calcula MRR somando `COALESCE(preco_negociado, planos.preco_base)` onde `status = 'ativa'`.
- Sem snapshot, sem cache. Revisitar acima de ~500 oficinas ativas.

### 11.4 Fora do escopo do admin no MVP
- Impersonate (entrar como oficina) — não tem.
- Edição direta de dados operacionais (clientes, lembretes, serviços) — não tem.
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
- `INTERNAL_JOB_SECRET`

Prefixo `NEXT_PUBLIC_` é browser-exposed — nunca usar para secrets.

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

---

## Como manter este doc

- **Regra mudou na fonte canônica** (ADR/PRD/código) → atualize a entrada aqui e registre no [Context Changelog](./CONTEXT_CHANGELOG.md) se for mudança estrutural.
- **Regra nova** → adicione na seção correta e cite a fonte. Se não tem fonte canônica ainda, crie ADR antes.
- **Conflito entre fontes** → a fonte canônica vence. Atualize a fonte mais recente para coincidir, não duplique a regra com versões diferentes.
- **Este doc nunca é a única fonte** — sempre cite o documento original.
