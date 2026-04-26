# Fase 1 - Resumo da Implementacao

## Objetivo

A Fase 1 implementou o primeiro fluxo real de atendimento e venda via WhatsApp para o Quando Trocar.

O fluxo atual permite que um lead envie uma mensagem pelo WhatsApp, o webhook receba o evento da Meta, valide a assinatura, persista os dados no Supabase, crie ou atualize lead e conversa, execute um agente vendedor simples, envie resposta pela WhatsApp Cloud API e registre o processamento para auditoria.

## Estado Atual

O fluxo esta funcionando em producao:

- mensagens reais chegam pelo WhatsApp;
- eventos brutos sao salvos em `whatsapp_events`;
- leads sao criados ou atualizados em `leads_oficina`;
- conversas sao mantidas em `conversas`;
- mensagens inbound e outbound sao salvas em `mensagens`;
- respostas sao enviadas pela WhatsApp Cloud API;
- falhas de processamento ficam registradas no banco;
- mensagens repetidas sao tratadas com idempotencia basica.

## Banco de Dados

Foram criadas as tabelas:

- `leads_oficina`;
- `conversas`;
- `mensagens`;
- `whatsapp_events`;
- `agent_tool_calls`;
- `outbound_messages`.

Tambem foram criados indices e constraints para suportar a Fase 1:

- `leads_oficina.whatsapp` unico;
- `whatsapp_events.provider_event_id` unico;
- `mensagens.whatsapp_message_id` unico;
- `outbound_messages.whatsapp_message_id` unico;
- checks para status e tipos usados no fluxo.

RLS foi habilitado nas tabelas publicas. Nesta fase, o acesso operacional acontece apenas pelo backend usando `SUPABASE_SERVICE_ROLE_KEY`.

## Webhook WhatsApp

Foi implementado:

- `GET /api/webhooks/whatsapp`;
- `POST /api/webhooks/whatsapp`.

O `GET` valida o webhook da Meta usando:

- `hub.mode`;
- `hub.verify_token`;
- `hub.challenge`.

O `POST` faz:

- validacao da assinatura `X-Hub-Signature-256`;
- persistencia do payload bruto;
- deduplicacao de evento e mensagem;
- extracao de mensagem inbound;
- normalizacao do telefone;
- criacao ou atualizacao de lead;
- criacao ou atualizacao de conversa;
- persistencia da mensagem inbound;
- execucao do agente vendedor;
- criacao de outbox;
- envio da resposta pela Cloud API;
- persistencia da mensagem outbound;
- marcacao do evento como processado ou falho.

## Agente Vendedor

Foi criado um agente simples para classificar mensagens comerciais com as intencoes:

- `pergunta_funcionamento`;
- `informa_volume_ticket`;
- `quer_testar`;
- `sem_interesse`;
- `fora_escopo`.

Tambem foi implementado o calculo de ROI:

```txt
receita_recuperada = volume_mensal * ticket_medio * 0.10
```

Para a pergunta "como funciona?", o agente deve sempre explicar que:

- a oficina cadastra a troca;
- o sistema chama o cliente depois;
- o cliente volta para a proxima troca.

## Origem do Lead

A mensagem inicial da landing:

```txt
Oi, quero testar o Quando Trocar
```

e tratada como:

```txt
origem = landing_page
```

Outras mensagens novas entram como:

```txt
origem = manual_whatsapp
```

Tambem foi corrigido o comportamento de atualizacao de lead existente para nao sobrescrever `origem` e `status` em mensagens seguintes.

## OpenAI

A OpenAI foi integrada como classificador estruturado usando a Responses API.

Aprendizado importante: a OpenAI nao deve decidir sozinha mudancas criticas de status. Ela pode sugerir intencao, mas a regra de negocio precisa validar a transicao.

Foi corrigido o caso em que uma mensagem neutra, como:

```txt
Ok obrigado
```

poderia ser classificada como `sem_interesse` e marcar o lead como `perdido`.

Regra atual:

- `perdido` so acontece com recusa explicita;
- mensagens neutras preservam o status atual;
- se o lead demonstrar novo interesse, ele pode voltar para o funil.

Exemplos que podem marcar `perdido`:

- "nao tenho interesse";
- "nao quero";
- "sem interesse";
- "cancelar";
- "remover";
- "pare".

Exemplos que nao podem marcar `perdido`:

- "ok";
- "obrigado";
- "valeu";
- "beleza";
- "e ai".

## Observabilidade e Debug

Durante os testes reais ficou claro que salvar apenas inbound e outbound nao era suficiente para debug.

Foram adicionados campos em `whatsapp_events`:

- `processing_status`;
- `processing_error_type`;
- `processing_error_message`;
- `processing_error_context`;
- `processed_at`.

Status possiveis:

- `received`;
- `processed`;
- `failed`.

Isso permite identificar se uma falha aconteceu na OpenAI, na WhatsApp API, no Supabase, na assinatura, no parsing do payload ou na regra do agente.

Tambem usamos `agent_tool_calls` para registrar decisoes relevantes do agente, como:

- mudanca de status;
- calculo de ROI;
- entradas e saidas de ferramentas internas.

## Configuracao da Meta

Foi criada documentacao em:

```txt
docs/meta-whatsapp-configuracao.md
```

Ela cobre:

- configuracao do webhook;
- obtencao do `WHATSAPP_APP_SECRET`;
- obtencao do `WHATSAPP_ACCESS_TOKEN`;
- identificacao do `WHATSAPP_PHONE_NUMBER_ID`;
- produto correto no painel da Meta;
- assinatura do campo correto.

Erro aprendido: no painel da Meta, o produto `User` nao era o correto para receber mensagens do WhatsApp. O produto/campo precisa ser relacionado ao WhatsApp Business Account, com assinatura do campo `messages`.

Outro aprendizado: o token temporario da WhatsApp API expira. Quando `WHATSAPP_ACCESS_TOKEN` estava vencido, o inbound chegava, mas o outbound falhava. Apos renovar o token e fazer redeploy, o envio voltou a funcionar.

## Testes

Foram adicionados testes com Vitest cobrindo:

- normalizacao de telefone;
- calculo de ROI;
- deteccao de origem `landing_page`;
- classificacao deterministica;
- validacao do webhook `GET`;
- rejeicao de assinatura invalida;
- persistencia de evento, lead, conversa e mensagem inbound;
- idempotencia;
- preservacao de status e origem do lead existente;
- fallback quando OpenAI falha;
- protecao contra lead virar `perdido` por mensagem neutra.

Ultima verificacao executada:

```txt
npm test
npm run build
```

Ambas passaram.

## Commits Relevantes

- `f964869` - implementacao do processamento WhatsApp com persistencia, erro, agente e merge de lead.
- `4c45775` - correcao para impedir mensagens neutras de marcarem lead como perdido.

## Erros e Aprendizados

### Produto incorreto no webhook da Meta

O produto `User` nao servia para o fluxo de mensagens WhatsApp. A configuracao correta precisa usar o produto/campo de WhatsApp e assinar `messages`.

### Token temporario expirado

O webhook continuava recebendo mensagens, mas o envio de resposta falhava quando o token da Cloud API estava invalido.

Para proximas fases, e importante configurar um token mais estavel via System User no Business Manager.

### Falta de persistencia de erro

Quando a conversa parou, inicialmente nao havia informacao suficiente para saber se a falha era OpenAI, Meta, Supabase ou regra do agente.

A solucao foi persistir status e contexto de erro em `whatsapp_events`.

### OpenAI nao deve controlar status critico sozinha

Classificacao por IA e uma sugestao. Transicao de funil precisa ser validada por regra deterministica.

### `perdido` precisa ser reversivel

Um lead marcado como `perdido` pode voltar a demonstrar interesse. O status deve representar o momento atual do relacionamento, nao uma sentenca definitiva.

### Idempotencia e obrigatoria

Webhooks podem repetir eventos. Sem deduplicacao, o sistema poderia duplicar mensagens, leads ou respostas.

### Outbox ajuda muito no debug

Salvar a mensagem planejada antes do envio permite saber se a falha ocorreu antes ou depois da chamada para a Meta.

## O Que Considerar Para a Fase 2

### 1. Estado de conversa

Hoje o agente responde mensagem a mensagem. A Fase 2 deve considerar historico e etapa atual da conversa.

Exemplo:

- bot pergunta cidade;
- lead responde "Guarulhos";
- sistema registra cidade;
- bot avanca para a proxima pergunta.

### 2. Campos comerciais estruturados

Persistir dados de qualificacao:

- cidade;
- nome da oficina;
- volume mensal;
- ticket medio;
- principal dor;
- melhor horario para contato;
- interesse declarado;
- motivo de perda, quando houver.

### 3. Maquina de estados do funil

Formalizar transicoes:

```txt
novo -> em_conversa -> qualificado -> interessado
qualquer status -> perdido somente com recusa explicita
perdido -> em_conversa / qualificado / interessado se houver novo interesse
```

Registrar sempre:

- status anterior;
- status novo;
- motivo da transicao;
- mensagem que disparou a mudanca.

### 4. Handoff humano

Definir quando o bot deve parar e quando um humano deve assumir.

Exemplos:

- lead interessado;
- lead qualificado;
- lead pediu contato humano;
- erro repetido no agente;
- mensagem fora de escopo sensivel.

### 5. Processamento assincrono

A Fase 1 usa processamento sincronico simples. Para a Fase 2, considerar fila ou worker quando o fluxo crescer.

Opcoes:

- Supabase Queues;
- Edge Function;
- worker separado;
- job processor externo.

### 6. Monitoramento operacional

Criar consultas, views ou painel para acompanhar:

- eventos `failed`;
- outbound `failed`;
- inbound sem resposta;
- leads interessados sem follow-up;
- leads qualificados;
- erros recorrentes da OpenAI ou Meta.

### 7. Templates WhatsApp

Para falar fora da janela de 24h, sera necessario criar e aprovar templates na Meta.

### 8. Token permanente da Meta

Trocar o token temporario por uma configuracao mais adequada via System User no Business Manager.

### 9. Fixtures reais da Meta

Guardar payloads reais para testes:

- mensagem inbound;
- status event;
- evento duplicado;
- erro de outbound;
- payload sem texto;
- payload de contato desconhecido.

## Recomendacao Para Comecar a Fase 2

Comecar pela continuidade da conversa.

O proximo passo mais importante e criar uma camada de estado para o agente saber:

- o que ele perguntou;
- o que o lead respondeu;
- qual dado deve ser extraido;
- qual proxima pergunta deve ser feita;
- quando parar e passar para humano.

Antes de adicionar recursos maiores, a Fase 2 deve transformar o bot de um respondedor mensagem a mensagem em um fluxo comercial guiado e auditavel.
