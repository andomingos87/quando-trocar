# Fases 1, 2 e 3 - Resumo Consolidado da Implementacao

## Objetivo Geral

As Fases 1, 2 e 3 transformaram o bot de WhatsApp do Quando Trocar de um fluxo comercial inicial em um ciclo operacional real:

- a oficina entra em contato e vira lead;
- o lead pode ser convertido em oficina ativa;
- a oficina registra uma troca pelo WhatsApp;
- o sistema cria cliente, veiculo, servico e lembrete;
- o lembrete pode ser enfileirado, enviado e rastreado pela Meta;
- o cliente final pode responder sem cair por engano no fluxo comercial;
- opt-out, numero errado, handoff e erros de provedor ficam auditados.

Ao final desse consolidado, a base do produto cobre:

- webhook real da Meta;
- persistencia auditavel de eventos e mensagens;
- agente vendedor;
- onboarding e operacao para cadastro de troca;
- scheduler, fila e consumer de lembretes;
- envio de template aprovado fora da janela de 24h;
- status `sent`, `delivered`, `read` e `failed`;
- interpretacao de respostas simples do cliente final;
- preservacao de consentimento, opt-out e handoff.

Nao ha Edge Function nessas fases. Os dois entrypoints implementados continuam sendo rotas Next.js:

```txt
app/api/webhooks/whatsapp/route.ts
app/api/internal/whatsapp-reminders/consume/route.ts
```

## Estado Atual Consolidado

Depois da Fase 3, o sistema consegue:

- receber mensagens reais pelo WhatsApp;
- validar webhook e assinatura da Meta;
- persistir eventos em `whatsapp_events`;
- manter conversas com `participant_type` e `agent_mode`;
- salvar mensagens inbound e outbound em `mensagens`;
- criar e atualizar `outbound_messages` como trilha operacional;
- criar e atualizar leads de oficina;
- converter lead em oficina ativa em plano teste;
- executar onboarding e operacao para cadastro de troca;
- criar `clientes_finais`, `veiculos`, `servicos` e `lembretes`;
- enfileirar lembretes elegiveis com Supabase Cron + `pgmq`;
- consumir fila pela rota interna protegida;
- enviar `lembrete_troca_oleo` pela WhatsApp Cloud API;
- persistir `template_name`, `template_language`, `template_params`, texto renderizado e `whatsapp_message_id`;
- atualizar status de entrega da Meta sem chamar agentes;
- tratar respostas de cliente final em `agent_mode = cliente_final_lembrete`;
- aplicar `opt_out`, `numero_errado` e handoff;
- evitar associacao automatica incorreta quando o mesmo WhatsApp existir em mais de uma oficina.

Importante:

- as migrations das Fases 2 e 3 foram criadas e aplicadas no Supabase cloud;
- o consumer de lembretes depende da rota interna estar deployada e do `INTERNAL_JOB_SECRET` estar configurado no app e no Vault do Supabase;
- a Fase 3 ja tem correcao de fila/retry e permissao de `pgmq`, mas a validacao final do fluxo real ainda depende de testes operacionais com lembrete elegivel e template/credenciais validas na Meta.

## Fase 1 - Bot Vendedor no WhatsApp

### O que foi implementado

Webhook:

- `GET /api/webhooks/whatsapp`;
- `POST /api/webhooks/whatsapp`;
- validacao de `hub.verify_token`;
- validacao de assinatura `X-Hub-Signature-256`.

Persistencia:

- eventos brutos em `whatsapp_events`;
- conversas em `conversas`;
- mensagens inbound/outbound em `mensagens`;
- outbox em `outbound_messages`;
- decisoes em `agent_tool_calls`.

Fluxo comercial:

- criacao e atualizacao de `leads_oficina`;
- classificacao estruturada com OpenAI Responses API;
- respostas curtas em portugues;
- envio pela WhatsApp Cloud API;
- deduplicacao basica por `provider_event_id` e `whatsapp_message_id`;
- marcacao de evento processado ou falho.

### Banco e modelagem

Foram criadas:

- `leads_oficina`;
- `conversas`;
- `mensagens`;
- `whatsapp_events`;
- `agent_tool_calls`;
- `outbound_messages`.

Tambem foram criados:

- unicidade em `leads_oficina.whatsapp`;
- unicidade em `whatsapp_events.provider_event_id`;
- unicidade em `mensagens.whatsapp_message_id`;
- unicidade em `outbound_messages.whatsapp_message_id`;
- checks de status e tipos usados no fluxo.

### Agente vendedor

Intencoes implementadas:

- `pergunta_funcionamento`;
- `informa_volume_ticket`;
- `quer_testar`;
- `sem_interesse`;
- `fora_escopo`.

Regras importantes:

- a IA sugere intencao, mas nao comanda sozinha status critico;
- `perdido` so ocorre com recusa explicita;
- mensagens neutras preservam o status atual;
- leads podem voltar ao funil se demonstrarem novo interesse.

### Aprendizados da Fase 1

- o produto/campo da Meta precisava ser o de WhatsApp, assinando `messages`;
- token temporario expirado deixava inbound funcionando e outbound falhando;
- sem persistencia de erro, ficava dificil separar problema de OpenAI, Meta, Supabase ou regra;
- `outbound_messages` salvo antes do envio foi essencial para rastrear falha antes/depois da chamada para a Meta.

## Fase 2 - Conversao, Onboarding e Operacao

### O que foi implementado

Conversao:

- lead interessado pode virar `oficina` ativa;
- `leads_oficina.status = convertido`;
- a conversa muda para `participant_type = oficina_cliente`;
- o `agent_mode` muda para `onboarding`.

Onboarding e operacao:

- resolucao de identidade por telefone antes do agente;
- novos modos `vendas`, `onboarding`, `operacao`, `cliente_final_lembrete`, `suporte`;
- contexto persistido em `conversas.context`;
- agente para extrair dados de troca;
- perguntas de follow-up quando faltar campo;
- RPC transacional para criar cliente, veiculo, servico e lembrete;
- guardrails para mensagem neutra, pergunta, prompt injection e resposta curta invalida.

### Banco e modelagem

Foram criadas:

- `oficinas`;
- `oficina_members`;
- `clientes_finais`;
- `veiculos`;
- `servicos`;
- `lembretes`.

Foram ampliadas:

- `leads_oficina`;
- `conversas`;
- `mensagens`;
- `outbound_messages`;
- `agent_tool_calls`.

`conversas` passou a suportar:

```txt
participant_type:
- lead_oficina
- oficina_cliente
- cliente_final
- contato_desconhecido

agent_mode:
- vendas
- onboarding
- operacao
- cliente_final_lembrete
- suporte
```

### RPC transacional

Foi criada a funcao:

```txt
public.register_service_with_reminder(...)
```

Ela:

- valida oficina ativa;
- cria ou reutiliza `clientes_finais` por `(oficina_id, whatsapp)`;
- cria ou reutiliza `veiculos`;
- cria um novo `servicos`;
- cria `lembretes` quando houver consentimento;
- calcula `scheduled_at` com base em `oficinas.dias_lembrete_padrao`;
- retorna ids criados/reutilizados.

### Guardrails operacionais

Protecoes implementadas:

- nao iniciar cadastro com `ok`, `bom dia`, `obrigado`;
- nao aceitar pergunta como valor de campo;
- nao enviar prompt injection para a OpenAI;
- nao criar rascunho sem sinal minimo de cadastro;
- limpar contexto apos sucesso.

### Aprendizados da Fase 2

- mensagens curtas ou curiosas nao podem acionar extracao estruturada;
- pergunta do usuario nao pode preencher campo faltante;
- `conversas.context` e util, mas pode contaminar a conversa se for aberto cedo demais;
- a oficina testa limites do bot, entao guardrails precisam ser parte do produto, nao excecao.

## Fase 3 - Lembretes Reais

### Arquitetura implementada

A Fase 3 foi implementada na arquitetura alvo:

- scheduler com Supabase Cron;
- fila com `pgmq` / Supabase Queues;
- consumer como rota interna protegida do app Next.js;
- envio de template aprovado pela WhatsApp Cloud API;
- atualizacao de status de provedor via webhook da Meta.

Fluxo final implementado:

```txt
lembrete vencido
-> enqueue_due_whatsapp_reminders
-> outbound_messages pending
-> fila whatsapp_outbound
-> POST /api/internal/whatsapp-reminders/consume
-> sendTemplateMessage
-> mensagens/outbound_messages/lembretes atualizados
-> webhook de status sent/delivered/read/failed
-> resposta de cliente final roteada para cliente_final_lembrete
```

### O que foi implementado detalhadamente

#### 1. Extensao de dados de envio

`outbound_messages` foi estendida com:

```txt
lembrete_id
message_kind
template_name
template_language
template_params
provider_error_code
provider_error_message
attempts
next_attempt_at
```

`lembretes` foi estendida com:

```txt
last_attempt_at
provider_status
provider_error_code
```

Tambem foi criado indice unico parcial para impedir duplicidade de envio ativo por `lembrete_id`.

#### 2. Scheduler de lembretes

Foi criada a funcao:

```txt
public.enqueue_due_whatsapp_reminders(p_limit integer)
```

Ela:

- seleciona `lembretes.status in ('pendente', 'erro_envio')`;
- exige `scheduled_at <= now()`;
- exige `oficinas.status = ativa`;
- exige `clientes_finais.status = ativo`;
- exige `consentimento_whatsapp = true`;
- bloqueia `opt_out_at is not null`;
- respeita `oficinas.timezone`, `horario_envio_inicio` e `horario_envio_fim`;
- impede novo envio quando ja existe `pending`, `sent` ou `retry_scheduled` para o mesmo `lembrete_id`;
- cria/atualiza conversa `cliente_final_lembrete`;
- cria `outbound_messages` com `status = pending`;
- marca `lembretes.status = enfileirado`;
- publica payload minimo na fila `whatsapp_outbound`.

Payload da fila:

```json
{
  "outbound_message_id": "...",
  "lembrete_id": "...",
  "oficina_id": "...",
  "cliente_id": "..."
}
```

#### 3. Consumer de fila

Foi criada a rota:

```txt
POST /api/internal/whatsapp-reminders/consume
```

Protecao:

- `Authorization: Bearer <INTERNAL_JOB_SECRET>`; ou
- `x-internal-job-secret`.

O consumer:

- busca itens com `dequeue_whatsapp_reminder_messages`;
- monta o template `lembrete_troca_oleo`;
- chama `sendTemplateMessage`;
- persiste `whatsapp_message_id` e resposta bruta;
- grava mensagem outbound em `mensagens`;
- atualiza `outbound_messages` e `lembretes`.

#### 4. Retry real com backoff

Inicialmente, o retry estava incompleto: marcava `retry_scheduled`, mas dependia do `visibility_timeout` da fila, o que fazia a mensagem voltar cedo demais.

Isso foi corrigido.

Modelo final:

- falha retryable:
  - incrementa `outbound_messages.attempts`;
  - grava `next_attempt_at`;
  - marca `status = retry_scheduled`;
  - grava `lembretes.last_attempt_at`;
  - arquiva a mensagem atual da fila;
  - reenfileira nova mensagem com atraso real.
- falha permanente:
  - marca `outbound_messages.status = failed`;
  - grava `provider_error_code`, `provider_error_message` e `provider_response`;
  - marca `lembretes.status = erro_envio`;
  - arquiva a mensagem atual;
  - nao reenfileira.

Backoff acordado e implementado:

```txt
1a tentativa falha -> 15 min
2a tentativa falha -> 2 h
3a tentativa falha -> 24 h
4a falha -> sem retry
```

Para isso foi criada a funcao:

```txt
public.requeue_whatsapp_reminder_message(...)
```

#### 5. Webhook de status da Meta

O webhook agora trata status da Meta sem chamar agentes.

Status suportados:

- `sent`
- `delivered`
- `read`
- `failed`

Regra de idempotencia implementada:

```txt
whatsapp_message_id:status:timestamp
```

Atualizacoes feitas:

- `mensagens.provider_status`;
- `mensagens.provider_error_code`;
- `mensagens.provider_error_message`;
- `outbound_messages.provider_response`;
- `outbound_messages.provider_error_code`;
- `outbound_messages.provider_error_message`;
- `lembretes.provider_status`;
- `lembretes.provider_error_code`;
- `lembretes.last_error`.

#### 6. Roteamento de cliente final

Foi implementado roteamento com prioridade:

1. conversa existente em `agent_mode = cliente_final_lembrete`
2. vinculo por `contextWhatsappMessageId`
3. fallback por numero usando `outbound_messages` recentes
4. handoff quando ambiguo

Tambem foi corrigido um gap importante:

- antes, o fallback por numero escolhia a primeira oficina;
- agora, quando o mesmo WhatsApp tem lembretes recentes em mais de uma oficina e nao ha contexto confiavel, o sistema cria/usa conversa em `agent_mode = suporte` e registra handoff em vez de atribuir automaticamente.

#### 7. Respostas do cliente final

Foi criado o agente de lembretes com classificador hibrido:

- regras deterministicas primeiro;
- OpenAI como fallback estruturado.

Intencoes cobertas:

- `quer_agendar`
- `quer_reagendar`
- `pergunta_preco`
- `pergunta_horario`
- `nao_tem_interesse`
- `ja_fez_servico`
- `numero_errado`
- `mensagem_indefinida`
- `opt_out`

Condutas implementadas:

- `opt_out`:
  - `clientes_finais.status = opt_out`
  - `opt_out_at` preenchido
  - cancelamento de lembretes futuros
  - resposta de confirmacao
- `numero_errado`:
  - `clientes_finais.status = numero_errado`
  - cancelamento de lembretes futuros
- `pergunta_preco`, `pergunta_horario`, `quer_agendar`:
  - handoff para oficina
  - sem prometer agenda real

#### 8. Preservacao de opt-out

A RPC `register_service_with_reminder` foi ajustada para nao reativar automaticamente:

- cliente em `opt_out`
- cliente em `numero_errado`

Novo cadastro operacional preserva:

- `status`
- `consentimento_whatsapp`
- `origem_consentimento`
- `data_consentimento`
- `opt_out_at`

#### 9. Permissoes do `pgmq`

Na operacao real, o consumer falhou com:

```txt
permission denied for schema pgmq
```

Foi criada migration corretiva para conceder o minimo necessario a:

- `authenticator`
- `service_role`
- `postgres`

Resultado validado:

- `USAGE` no schema `pgmq` para os papeis usados pelo app;
- `EXECUTE` nas funcoes `pgmq.send`, `pgmq.read` e `pgmq.archive`;
- `public.requeue_whatsapp_reminder_message` criada e executavel.

### Banco, rotas e migrations da Fase 3

Migrations:

- `supabase/migrations/20260426130513_phase_3_real_reminders.sql`
- `supabase/migrations/20260426193031_phase_3_reminder_queue_fixes.sql`

Rotas:

- `app/api/internal/whatsapp-reminders/consume/route.ts`
- `app/api/webhooks/whatsapp/route.ts`

Arquivos centrais:

- `lib/whatsapp/reminder-agent.ts`
- `lib/whatsapp/reminder-worker.ts`
- `lib/whatsapp/repository.ts`
- `lib/whatsapp/conversation-router.ts`
- `lib/whatsapp/webhook-handler.ts`
- `lib/whatsapp/whatsapp-client.ts`

### Erros e aprendizados da Fase 3

#### Retry incompleto parece implementado, mas nao esta

O primeiro desenho de retry gravava `retry_scheduled`, mas sem reenfileirar com delay real.

Aprendizado:

- em fila duravel, `next_attempt_at` sozinho nao adianta se o mecanismo de consumo nao respeita esse tempo;
- retry precisa ser tratado como operacao de fila, nao apenas campo de banco.

#### Permissao de schema quebra o fluxo inteiro

O cron e a rota estavam certos, mas o caminho via RPC falhava porque `authenticator` nao tinha acesso ao schema `pgmq`.

Aprendizado:

- em Supabase, nao basta criar extensao e funcao;
- o papel que executa a RPC precisa do privilegio exato no schema e nas funcoes da extensao.

#### O mesmo WhatsApp pode existir em mais de uma oficina

Esse caso era previsto no documento, mas a primeira implementacao ainda resolvia pelo primeiro candidato recente.

Aprendizado:

- telefone nao e identidade global de cliente final;
- quando nao houver contexto confiavel de outbound, o sistema precisa ser conservador e abrir handoff.

#### Erro da Meta precisa ser persistido por inteiro

Persistir apenas `error_message` nao e suficiente.

Aprendizado:

- `provider_error_code`
- `provider_error_message`
- `provider_response`

sao necessarios para separar erro temporario, erro permanente, template invalido, token invalido e problema de configuracao.

#### Token da Meta e problema operacional recorrente

Nos testes reais, o webhook seguia recebendo inbound, mas outbound falhava com:

```txt
Authentication Error
```

Aprendizado:

- receber mensagem nao prova que o envio esta saudavel;
- o token de envio precisa ser estavel e coerente com `WHATSAPP_PHONE_NUMBER_ID`;
- depois de trocar env na Vercel, e preciso garantir que o deploy em producao realmente pegou o valor novo.

#### Vault e secrets de Edge Function sao coisas diferentes

A Fase 3 usa:

- Vault do Supabase para `whatsapp_consumer_url` e `internal_job_secret`;
- env vars do app Next.js para `INTERNAL_JOB_SECRET`, `WHATSAPP_ACCESS_TOKEN` e afins.

Aprendizado:

- secret de Edge Function nao resolve cron SQL;
- `pg_cron` + `pg_net` precisam ler do Vault.

## Verificacao Executada

Fase 1:

```txt
npm test
npm run build
```

Fase 2:

```txt
npm test
npm run build
```

Resultado registrado na epoca:

```txt
6 arquivos de teste passaram
27 testes passaram
build passou
```

Fase 3 e correcao de fechamento:

```txt
npm test
npm run build
npm run lint
```

Resultado atual:

```txt
9 arquivos de teste passaram
39 testes passaram
build passou
lint passou
```

Validacoes adicionais no Supabase:

- migrations da Fase 3 aplicadas;
- jobs `whatsapp-reminders-enqueue` e `whatsapp-reminders-consume` criados;
- secrets no Vault criados para dispatch do consumer;
- permissao de `pgmq` corrigida para o caminho atual via RPC;
- funcao `public.requeue_whatsapp_reminder_message` criada.

## Estado Consolidado para a Fase 4

Antes de avancar para retorno e dashboard, confirmar:

- template `lembrete_troca_oleo` aprovado e valido;
- token da Meta estavel;
- rota interna do consumer deployada;
- `INTERNAL_JOB_SECRET` consistente entre app e Vault;
- fluxo real `enqueue -> consume -> sent` validado no ambiente;
- fluxo real de retry validado com erro temporario;
- respostas de cliente final ja auditadas em producao sem cair em vendas.

Fase 4 deve partir de:

- `oficinas.status = ativa`;
- `servicos` e `lembretes` sendo criados pelo fluxo operacional;
- `outbound_messages` contendo historico real de envio;
- `cliente_final_lembrete` funcionando como trilha de resposta;
- base pronta para registrar retorno e exibir metricas.

## Resumo Final

A Fase 1 entregou o fluxo comercial auditavel no WhatsApp.

A Fase 2 entregou a base operacional minima para transformar conversa em cadastro real de troca.

A Fase 3 fechou o primeiro ciclo de retencao: lembrete real, envio por template, status da Meta, resposta de cliente final, opt-out, handoff e retry operacional.

O principal aprendizado consolidado das tres fases foi este:

- a IA sugere;
- regras deterministicas validam;
- banco e fila executam;
- logs e persistencia precisam contar exatamente onde o fluxo falhou.

Sem isso, o bot parece funcionar em demo, mas quebra no primeiro caso real de token vencido, evento repetido, ambiguidade de cliente ou erro de fila.
