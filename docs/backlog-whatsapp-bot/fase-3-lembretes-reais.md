# Fase 3 - Lembretes reais

## Objetivo

Enviar lembretes reais pelo WhatsApp para clientes finais com consentimento, registrar status de entrega, interpretar respostas simples e tratar opt-out.

A Fase 3 fecha o primeiro ciclo operacional do produto: a oficina cadastra uma troca, o sistema agenda um lembrete, envia uma mensagem aprovada pela Meta quando o lembrete vence e registra a resposta do cliente final sem transformar essa conversa em lead comercial.

## Contexto depois das Fases 1 e 2

As Fases 1 e 2 ja criaram a base operacional minima:

- webhook real em `app/api/webhooks/whatsapp/route.ts`;
- validacao de assinatura da Meta;
- persistencia auditavel em `whatsapp_events`;
- conversas com `participant_type` e `agent_mode`;
- mensagens inbound/outbound em `mensagens`;
- outbox inicial em `outbound_messages`;
- oficinas ativas em `oficinas`;
- clientes finais em `clientes_finais`;
- veiculos em `veiculos`;
- servicos em `servicos`;
- lembretes iniciais em `lembretes`;
- registro de decisoes em `agent_tool_calls`;
- guardrails deterministicos para vendas, onboarding e operacao.

Portanto, a Fase 3 nao deve recriar essas tabelas. Ela deve estender o modelo existente para envio programado, templates da Meta, status de provedor, fila/retry, resposta de cliente final e opt-out.

## Escopo

Inclui:

- Scheduler diario de lembretes.
- Fila de mensagens de saida.
- Envio de template aprovado pela Meta.
- Controle de horario comercial usando configuracao da oficina.
- Controle de consentimento.
- Bloqueio por opt-out.
- Deduplicacao de envio por lembrete.
- Registro de status do provedor.
- Retry para erro temporario.
- Interpretacao de respostas simples do cliente final.
- Opt-out automatico.
- Handoff para oficina quando a resposta exigir atendimento humano.

Nao inclui:

- Campanhas promocionais.
- Calendario externo.
- Confirmacao definitiva de agenda.
- Segmentacao avancada.
- Multiatendente complexo.
- Dashboard operacional completo.

## Dependencias

- Fase 2 concluida e deployada.
- Migrations da Fase 2 aplicadas no Supabase cloud.
- Guardrails da Fase 2 disponiveis no app em producao.
- Template `lembrete_troca_oleo` aprovado na Meta.
- Token estavel da Meta, preferencialmente via System User no Business Manager.
- Tabela `lembretes` populada pela RPC `register_service_with_reminder`.
- Cliente final com `consentimento_whatsapp = true`.
- Cliente final com `status = ativo`.
- Oficina com `status = ativa`.
- Configuracao de horario ja existente em:
  - `oficinas.timezone`;
  - `oficinas.horario_envio_inicio`;
  - `oficinas.horario_envio_fim`.

## Dados

### Tabelas ja existentes

- `oficinas`
- `clientes_finais`
- `veiculos`
- `servicos`
- `lembretes`
- `conversas`
- `mensagens`
- `outbound_messages`
- `whatsapp_events`
- `agent_tool_calls`

### Campos ja existentes relevantes

`oficinas`:

```text
status
timezone
dias_lembrete_padrao
horario_envio_inicio
horario_envio_fim
mensagem_lembrete_padrao
```

`clientes_finais`:

```text
oficina_id
whatsapp
consentimento_whatsapp
origem_consentimento
data_consentimento
opt_out_at
status
```

`lembretes`:

```text
oficina_id
cliente_id
veiculo_id
servico_id
scheduled_at
sent_at
status
whatsapp_message_id
attempts
last_error
```

`conversas`:

```text
participant_whatsapp
participant_type
agent_mode
oficina_id
cliente_id
context
handoff_required
handoff_reason
```

`outbound_messages`:

```text
conversa_id
lead_id
oficina_id
cliente_id
to_whatsapp
body
status
whatsapp_message_id
provider_response
error_message
sent_at
```

### Extensoes recomendadas na Fase 3

`outbound_messages` deve ser estendida para diferenciar respostas livres, mensagens operacionais e templates de lembrete:

```text
lembrete_id uuid references public.lembretes(id)
message_kind text -- text, template
template_name text
template_language text
template_params jsonb
provider_error_code text
provider_error_message text
attempts integer
next_attempt_at timestamptz
```

Criar um indice unico parcial para impedir duplicidade de envio aceito para o mesmo lembrete:

```text
unique (lembrete_id)
where lembrete_id is not null
  and status in ('pending', 'sent')
```

`lembretes` pode receber campos adicionais para facilitar observabilidade de envio:

```text
last_attempt_at timestamptz
provider_status text
provider_error_code text
```

Se for usada uma tabela relacional de jobs em vez de Supabase Queues, criar `outbound_message_jobs` com vinculo para `outbound_messages` e `lembretes`. Se for usada Supabase Queues, documentar o nome da fila e o payload.

## Arquitetura de scheduler e fila

A arquitetura alvo da Fase 3 deve usar Supabase Cron e Supabase Queues:

1. Um job agendado executa a selecao de lembretes vencidos.
2. A selecao aplica regras de elegibilidade e marca o lembrete como `enfileirado`.
3. Um job de envio e criado na fila de saida.
4. O consumer processa a fila, envia template pela WhatsApp Cloud API e atualiza `outbound_messages`, `mensagens` e `lembretes`.
5. O webhook da Meta atualiza status de provedor e roteia respostas do cliente final.

Para um MVP temporario, a mesma separacao pode ser implementada com rotas Next.js protegidas e Vercel Cron:

- `POST /api/jobs/schedule-reminders`
- `POST /api/jobs/send-outbound`

Mesmo nesse MVP, as regras precisam manter idempotencia por `lembrete_id` e nao podem depender apenas de memoria do processo.

## Status principais

`lembretes.status`:

```text
pendente
enfileirado
enviado
respondido
agendado
sem_resposta
cancelado
erro_envio
```

`clientes_finais.status`:

```text
ativo
opt_out
numero_errado
```

`outbound_messages.status` atual:

```text
pending
sent
failed
```

Se a Fase 3 precisar representar retry explicitamente, manter `status = failed` com `next_attempt_at` preenchido ou ampliar o check para incluir:

```text
retry_scheduled
```

## Tarefas tecnicas

- [ ] Estender `outbound_messages` com `lembrete_id`, tipo de mensagem, template, erro de provedor, tentativas e proxima tentativa.
- [ ] Criar indice unico parcial para deduplicacao por `lembrete_id`.
- [ ] Avaliar campos adicionais em `lembretes` para status e erro do provedor.
- [ ] Definir e implementar Supabase Queue ou tabela `outbound_message_jobs`.
- [ ] Criar funcao de selecao de lembretes vencidos.
- [ ] Implementar regra de horario comercial por `oficinas.timezone`, `horario_envio_inicio` e `horario_envio_fim`.
- [ ] Implementar regra de consentimento.
- [ ] Implementar bloqueio para cliente `opt_out`.
- [ ] Implementar bloqueio para cliente `numero_errado`.
- [ ] Implementar deduplicacao por `lembrete_id`.
- [ ] Criar job `schedule-reminders`.
- [ ] Criar consumer `send-outbound`.
- [ ] Adicionar `sendTemplateMessage` ao cliente da WhatsApp Cloud API.
- [ ] Implementar montagem dos parametros do template `lembrete_troca_oleo`.
- [ ] Persistir texto renderizado do template em `mensagens.body`.
- [ ] Persistir `whatsapp_message_id` em `outbound_messages`, `mensagens` e `lembretes`.
- [ ] Atualizar `lembretes.status = enviado` quando o envio for aceito pela Meta.
- [ ] Registrar erro do provedor em `provider_error_code`, `provider_error_message` e `last_error`.
- [ ] Implementar retry com limite de tentativas e `next_attempt_at`.
- [ ] Interpretar webhook de status da Meta sem descartar atualizacoes legitimas como duplicadas.
- [ ] Atualizar mensagem/outbox/lembrete com status `sent`, `delivered`, `read` e `failed` quando recebidos.
- [ ] Resolver conversa de cliente final sem criar lead comercial.
- [ ] Implementar agente/classificador de resposta em `agent_mode = cliente_final_lembrete`.
- [ ] Implementar opt-out por palavras-chave.
- [ ] Cancelar lembretes futuros de cliente em opt-out.
- [ ] Garantir que novo cadastro da oficina nao reative automaticamente cliente em `opt_out`.
- [ ] Registrar handoff quando houver pergunta especifica.
- [ ] Notificar oficina quando o cliente pedir preco, horario, disponibilidade ou atendimento humano.
- [ ] Registrar tool calls relevantes em `agent_tool_calls`.

## Regras de envio

Um lembrete so pode ser enviado quando:

- `lembretes.status` for `pendente` ou `erro_envio` elegivel para retry.
- `scheduled_at <= now()`.
- `oficinas.status = ativa`.
- `clientes_finais.status = ativo`.
- `clientes_finais.consentimento_whatsapp = true`.
- `clientes_finais.opt_out_at is null`.
- Horario local da oficina estiver entre `horario_envio_inicio` e `horario_envio_fim`.
- Nao houver `outbound_messages` pendente ou enviado para o mesmo `lembrete_id`.
- O servico, veiculo e cliente vinculados ainda existirem.

O scheduler deve marcar o lembrete como `enfileirado` antes de criar o job de envio. Reexecucoes do scheduler nao podem criar dois jobs para o mesmo lembrete.

## Template WhatsApp

Template padrao planejado:

```text
Oi {{1}}, aqui e da {{2}}.
Ja esta na hora da proxima troca de oleo do seu {{3}}.
Quer agendar?
```

Parametros:

```text
{{1}} nome do cliente final
{{2}} nome da oficina
{{3}} descricao do veiculo
```

A Fase 3 deve salvar:

- nome do template;
- idioma do template;
- parametros enviados;
- texto renderizado;
- resposta bruta da Meta;
- `whatsapp_message_id` retornado pela Meta.

O cliente WhatsApp atual envia apenas texto livre. A Fase 3 precisa adicionar envio de template pela Cloud API para mensagens fora da janela de 24 horas.

## Roteamento de respostas do cliente final

Respostas de cliente final nao podem ser processadas pelo agente vendedor nem criar lead de oficina por engano.

Ao receber uma mensagem inbound de um numero que pode ser cliente final, o roteamento deve tentar resolver nesta ordem:

1. Conversa existente com `participant_whatsapp` e `agent_mode = cliente_final_lembrete`.
2. Lembrete/outbound recente relacionado ao `whatsapp_message_id` de contexto quando a Meta fornecer esse relacionamento.
3. Cliente final por `clientes_finais.whatsapp`, usando `outbound_messages` e `lembretes` recentes para desambiguar `oficina_id`.
4. Se houver ambiguidade entre mais de uma oficina, marcar para handoff ou responder de forma neutra sem alterar estado critico.

Quando a conversa for de cliente final, usar:

```text
participant_type = cliente_final
agent_mode = cliente_final_lembrete
cliente_id = clientes_finais.id
oficina_id = clientes_finais.oficina_id
```

O mesmo telefone pode existir em mais de uma oficina porque `clientes_finais` e unico por `(oficina_id, whatsapp)`, nao globalmente. Por isso a Fase 3 deve preferir vinculo pelo lembrete enviado, nao apenas pelo numero.

## Webhook de status da Meta

Eventos de status da Meta devem atualizar registros existentes e nao chamar agentes.

Status esperados:

```text
sent
delivered
read
failed
```

Regras:

- Status deve atualizar `mensagens.provider_status` quando houver `whatsapp_message_id`.
- Status deve atualizar `outbound_messages.provider_response`.
- Status `failed` deve preencher codigo e mensagem de erro quando a Meta enviar esses campos.
- Status `failed` deve colocar o lembrete em `erro_envio` quando o erro for de envio de lembrete.
- Status `sent`, `delivered` ou `read` nao deve duplicar mensagem outbound.

Atencao de idempotencia:

O `provider_event_id` de eventos de status nao deve ser apenas `status.id`, porque o mesmo `whatsapp_message_id` pode gerar varios status diferentes. Usar uma chave composta logica, por exemplo:

```text
whatsapp_message_id:status:timestamp
```

Isso evita descartar eventos legitimos como duplicados.

## Regras de resposta do cliente

Intencoes esperadas:

```text
quer_agendar
quer_reagendar
pergunta_preco
pergunta_horario
nao_tem_interesse
ja_fez_servico
numero_errado
mensagem_indefinida
opt_out
```

Condutas:

- `quer_agendar`: marcar como `agendado` somente quando houver data/horario claro, usando linguagem de pre-agendamento.
- `quer_reagendar`: registrar interesse e acionar handoff se depender de disponibilidade real.
- `pergunta_preco`: acionar handoff para oficina.
- `pergunta_horario`: acionar handoff para oficina quando exigir disponibilidade real.
- `nao_tem_interesse`: marcar lembrete como `sem_resposta` ou `cancelado`, conforme texto.
- `ja_fez_servico`: marcar lembrete como `respondido` e deixar retorno financeiro para Fase 4.
- `numero_errado`: marcar cliente como `numero_errado` e cancelar lembretes futuros.
- `opt_out`: marcar cliente como `opt_out`, preencher `opt_out_at`, cancelar lembretes futuros e confirmar remocao.
- `mensagem_indefinida`: responder curto ou acionar handoff se houver risco de promessa indevida.

O bot nao deve confirmar agenda real. Ele pode dizer que vai avisar a oficina ou que a oficina vai confirmar o melhor horario.

## Opt-out

Palavras e frases que devem acionar opt-out:

```text
parar
cancelar
remover
nao quero receber
nao me mande
pare
sair
descadastrar
```

Ao detectar opt-out:

- atualizar `clientes_finais.status = opt_out`;
- preencher `clientes_finais.opt_out_at`;
- cancelar lembretes futuros pendentes ou enfileirados do cliente;
- salvar mensagem inbound;
- salvar resposta de confirmacao;
- registrar tool call de opt-out.

Novo cadastro feito pela oficina nao pode reativar automaticamente cliente em `opt_out`. A RPC de registro ou a camada de repositorio deve preservar o opt-out existente. Reativacao futura exige confirmacao explicita do cliente ou acao manual auditavel.

## Handoff

Usar os campos existentes em `conversas`:

```text
handoff_required = true
handoff_reason = motivo
```

Motivos iniciais:

```text
pergunta_preco
pergunta_horario
pedido_agendamento
mensagem_ambigua
cliente_final_ambiguo
```

Quando houver handoff, o sistema deve:

- registrar a conversa como pendente de humano;
- avisar o cliente final com resposta curta e sem promessa de agenda;
- notificar a oficina quando houver canal confiavel para isso;
- registrar `agent_tool_calls` com input e decisao.

## Criterios de aceite

- Dado um lembrete pendente vencido, quando o scheduler roda, o lembrete muda para `enfileirado`.
- Dado o scheduler rodando duas vezes, apenas um job/outbox e criado para o mesmo `lembrete_id`.
- Dado um lembrete enfileirado elegivel, o sistema envia template pela Cloud API e grava `whatsapp_message_id`.
- Dado um envio aceito pela Meta, `outbound_messages`, `mensagens` e `lembretes` ficam vinculados pelo `whatsapp_message_id`.
- Dado um cliente sem consentimento, nenhum envio e feito.
- Dado um cliente com `status = opt_out`, nenhum envio e feito.
- Dado um cliente respondendo "parar", o sistema marca `opt_out`, cancela lembretes futuros e responde confirmando remocao.
- Dado uma oficina cadastrando novo servico para cliente em `opt_out`, o cliente nao volta automaticamente para `ativo`.
- Dado um cliente final respondendo ao lembrete, o sistema nao cria lead comercial.
- Dado um cliente perguntando preco, o sistema registra handoff e notifica a oficina.
- Dado um status `delivered` da Meta depois de `sent`, o sistema atualiza status sem considerar duplicado indevido.
- Dado um erro temporario de provedor, o sistema agenda retry ate o limite configurado.

## Testes recomendados

- Teste de selecao de lembretes vencidos.
- Teste de bloqueio fora do horario comercial.
- Teste de bloqueio por falta de consentimento.
- Teste de bloqueio por cliente `opt_out`.
- Teste de bloqueio por cliente `numero_errado`.
- Teste de deduplicacao de envio por `lembrete_id`.
- Teste de montagem de template.
- Teste de persistencia de `template_name`, `template_language`, `template_params` e texto renderizado.
- Teste de persistencia de `whatsapp_message_id`.
- Teste de status webhook `sent`, `delivered`, `read` e `failed`.
- Teste de idempotencia de status da Meta com status diferentes para o mesmo `whatsapp_message_id`.
- Teste de resposta de cliente final sem criacao de lead comercial.
- Teste de ambiguidade quando o mesmo WhatsApp pertence a clientes de oficinas diferentes.
- Teste de opt-out.
- Teste para garantir que opt-out nao e revertido por novo cadastro operacional.
- Teste de classificacao de resposta do cliente final.
- Teste de handoff para preco e horario.
- Teste de retry em erro temporario.

## Riscos

- Template ser recusado pela Meta.
- Token temporario da Meta expirar e bloquear envios.
- Envio fora de horario gerar experiencia ruim.
- Cliente sem consentimento receber mensagem.
- Cliente em opt-out ser reativado por novo cadastro da oficina.
- Reenvio duplicado parecer spam.
- Resposta de cliente final ser roteada como lead comercial.
- Mesmo WhatsApp de cliente final existir em mais de uma oficina.
- Status da Meta ser deduplicado de forma incorreta.
- Variavel invalida no template causar falha de envio.
- Resposta ambigua ser marcada como agendamento real.

## Estado esperado para iniciar implementacao

Antes de implementar, a Fase 3 deve estar fechada nestas decisoes:

- estrategia de fila: Supabase Queues ou tabela `outbound_message_jobs`;
- estrategia de agendamento: Supabase Cron ou rota protegida chamada por Vercel Cron no MVP;
- campos exatos a adicionar em `outbound_messages` e `lembretes`;
- nome, idioma e parametros do template aprovado na Meta;
- regra de idempotencia para status da Meta;
- regra de roteamento para `cliente_final_lembrete`;
- regra para preservar opt-out existente;
- comportamento de handoff para perguntas de preco, horario e agenda.

## Saida esperada

Ao final da fase, o sistema envia lembretes reais com controle de consentimento, horario, idempotencia e opt-out; registra status da Meta; interpreta respostas simples do cliente final; e aciona a oficina quando a conversa exigir atendimento humano.
