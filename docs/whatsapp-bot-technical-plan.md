# Quando Trocar - Levantamento Tecnico do Bot WhatsApp

Data: 2026-04-25
Base: `PRD_WHATSAPP_BOT_REAL.md`
Status: recomendacao tecnica para implementacao real

## 1. Decisao de stack recomendada

Stack principal:

- Aplicacao web e dashboard: Next.js 15, React 19, TypeScript e Vercel.
- Banco transacional: Supabase Postgres.
- Autenticacao da area logada: Supabase Auth.
- Controle de acesso: Row Level Security por oficina.
- Fila duravel: Supabase Queues, baseada em `pgmq`.
- Agendamentos recorrentes: Supabase Cron, baseada em `pg_cron`.
- IA: OpenAI Responses API com Structured Outputs e chamadas de ferramentas.
- WhatsApp: Meta WhatsApp Business Cloud API.

Motivo da recomendacao:

- O repositorio ja usa Next.js, React e Vercel, entao a camada web deve permanecer nessa base.
- O PRD precisa de banco, fila, auditoria, cron, webhooks e dados multi-oficina. Supabase cobre isso com baixa friccao operacional.
- A Cloud API da Meta reduz risco de bloqueio e da suporte nativo a templates, webhooks, status de entrega e `message_id`.
- O agente precisa gerar dados estruturados, nao apenas texto. Structured Outputs e tool calling reduzem erro de parsing e impedem parte das alucinacoes.

Alternativas avaliadas:

- Z-API ou Evolution API: uteis para prototipos rapidos, mas menos adequadas como base de produto SaaS com compliance, templates e previsibilidade.
- Redis/Upstash para fila: bom tecnicamente, mas adiciona outro provedor antes de ser necessario.
- Vercel Cron: aceitavel para acionar jobs HTTP simples, mas Supabase Cron fica mais proximo do banco e simplifica consultas diarias de lembretes.
- Backend separado em NestJS/Fastify: pode fazer sentido em escala posterior, mas o MVP consegue operar com Route Handlers do Next.js e jobs pequenos.

## 2. Arquitetura do MVP

Componentes:

- Landing page publica: ja existente no projeto.
- Webhook WhatsApp: endpoint HTTP que valida a requisicao, persiste o payload e enfileira processamento.
- Inbox processor: consome mensagens recebidas, resolve identidade, define modo do agente e decide a proxima acao.
- Agent orchestrator: aplica regras deterministicas, chama IA quando precisa interpretar texto livre e executa ferramentas internas.
- Outbox sender: envia mensagens pelo WhatsApp e atualiza status com `message_id`.
- Scheduler de lembretes: roda diariamente, busca lembretes pendentes e enfileira envios.
- Dashboard operacional: mostra metricas, conversas, lembretes, clientes e retornos.

Fluxo de mensagem recebida:

```text
WhatsApp Cloud API
-> POST /api/webhooks/whatsapp
-> valida assinatura/token
-> grava em mensagens e whatsapp_events
-> enfileira inbound_message_jobs
-> processa identidade e conversa
-> chama agente/regras
-> grava acoes e mensagens de saida
-> enfileira outbound_message_jobs
-> envia pelo WhatsApp
-> grava message_id/status
```

Fluxo de lembrete:

```text
Supabase Cron diario
-> chama funcao SQL ou Edge Function
-> busca lembretes pendentes vencidos
-> respeita horario comercial, consentimento e opt-out
-> enfileira outbound_message_jobs
-> outbox sender envia template
-> atualiza status para enviado ou erro_envio
```

Regra central:

O LLM nao deve comandar diretamente o banco. Ele retorna uma intencao estruturada ou solicita uma ferramenta permitida. O backend valida a acao, aplica regras de seguranca e so entao grava ou envia mensagens.

## 3. APIs necessarias

### Meta WhatsApp Business Cloud API

Usos obrigatorios:

- Receber mensagens via webhook.
- Enviar mensagens livres dentro da janela de atendimento.
- Enviar templates aprovados fora da janela de 24 horas.
- Receber status de entrega, falha e leitura quando disponivel.
- Persistir `wamid` ou identificador equivalente como `whatsapp_message_id`.

Templates iniciais:

```text
lembrete_troca_oleo
Oi {{1}}, aqui e da {{2}}.
Ja esta na hora da proxima troca de oleo do seu {{3}}.
Quer agendar?
```

```text
reativacao_oficina
Oi {{1}}, sua oficina ainda pode recuperar clientes com lembretes automaticos.
Quer registrar uma troca agora?
```

Recomendacao:

- Comecar com templates de categoria utilitaria quando o conteudo for lembrete de servico.
- Evitar linguagem promocional nos lembretes de clientes finais.
- Guardar a versao textual renderizada do template em `mensagens.body`, porque a API pode retornar apenas o identificador da mensagem enviada.

### OpenAI

Usos obrigatorios:

- Classificar mensagem recebida.
- Extrair dados de lead.
- Extrair dados de registro de troca.
- Classificar resposta de cliente final.
- Gerar resposta curta em linguagem simples.

Padrao recomendado:

- Usar um classificador estruturado por modo do agente.
- Usar schemas com enums fechados.
- Rejeitar ou pedir confirmacao quando a confianca for baixa.
- Separar prompts de `vendas`, `onboarding`, `operacao`, `suporte` e `cliente_final_lembrete`.

Exemplo de saida estruturada para registro de troca:

```json
{
  "intent": "registrar_troca",
  "confidence": 0.91,
  "missing_fields": [],
  "data": {
    "nome_cliente": "Joao Silva",
    "whatsapp_cliente": "5541999990000",
    "veiculo": "Civic 2018",
    "servico": "troca de oleo",
    "data_servico": "2026-04-25",
    "valor": null
  }
}
```

### Supabase

Usos obrigatorios:

- Postgres para dados de negocio.
- RLS em tabelas expostas para area logada.
- Service role somente no servidor.
- Queues para jobs de entrada e saida.
- Cron para lembretes diarios.

Regras de seguranca:

- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Habilitar RLS nas tabelas de dados de oficina.
- Usar `oficina_members` para vincular usuarios autenticados a oficinas.
- Guardar payloads brutos em tabela de auditoria com acesso restrito.

## 4. Modelo de dados recomendado

O PRD ja define as tabelas principais. Abaixo esta o refinamento tecnico para o MVP.

Tabelas de negocio:

- `leads_oficina`
- `oficinas`
- `oficina_members`
- `clientes_finais`
- `veiculos`
- `servicos`
- `lembretes`
- `conversas`
- `mensagens`
- `retornos`
- `audit_events`

Tabelas/fila operacional:

- `whatsapp_events`
- `agent_tool_calls`
- `outbound_messages`
- Supabase Queue: `inbound_message_jobs`
- Supabase Queue: `outbound_message_jobs`

Campos adicionais importantes:

```sql
alter table oficinas
  add column timezone text not null default 'America/Sao_Paulo',
  add column horario_envio_inicio time not null default '08:00',
  add column horario_envio_fim time not null default '18:00',
  add column mensagem_lembrete_padrao text,
  add column dias_lembrete_padrao integer not null default 90;

alter table clientes_finais
  add column origem_consentimento text,
  add column data_consentimento timestamptz,
  add column opt_out_at timestamptz;

alter table conversas
  add column handoff_required boolean not null default false,
  add column handoff_reason text;

alter table mensagens
  add column provider_status text,
  add column provider_error_code text,
  add column provider_error_message text;
```

Indices e restricoes:

```sql
create unique index clientes_finais_oficina_whatsapp_uidx
  on clientes_finais (oficina_id, whatsapp);

create index lembretes_due_idx
  on lembretes (status, scheduled_at)
  where status in ('pendente', 'erro_envio');

create unique index mensagens_whatsapp_message_id_uidx
  on mensagens (whatsapp_message_id)
  where whatsapp_message_id is not null;

create unique index whatsapp_events_provider_event_uidx
  on whatsapp_events (provider_event_id)
  where provider_event_id is not null;
```

Status recomendados:

```text
leads_oficina.status:
novo, em_conversa, qualificado, interessado, teste_aceito, convertido, perdido

oficinas.status:
ativa, pausada, cancelada

clientes_finais.status:
ativo, opt_out, numero_errado

lembretes.status:
pendente, enfileirado, enviado, respondido, agendado, sem_resposta, cancelado, erro_envio

conversas.agent_mode:
vendas, onboarding, operacao, suporte, cliente_final_lembrete
```

## 5. Contratos de endpoints

### `GET /api/webhooks/whatsapp`

Responsabilidade:

- Validar desafio inicial de webhook da Meta.

Entrada esperada:

- `hub.mode`
- `hub.verify_token`
- `hub.challenge`

Saida:

- `200` com `hub.challenge` quando o token for valido.
- `403` quando o token for invalido.

### `POST /api/webhooks/whatsapp`

Responsabilidade:

- Receber evento do WhatsApp.
- Validar origem.
- Persistir payload bruto.
- Enfileirar processamento.
- Responder em menos de 2 segundos.

Saida:

- `200` quando o evento foi aceito para processamento.
- `401` ou `403` em falha de validacao.
- `500` apenas quando nao foi possivel persistir o evento.

### `POST /api/jobs/process-inbound`

Responsabilidade:

- Consumir mensagens recebidas.
- Resolver identidade.
- Rodar agente/regras.
- Criar mensagens de saida ou acoes internas.

Protecao:

- Endpoint interno protegido por segredo de job.

### `POST /api/jobs/send-outbound`

Responsabilidade:

- Consumir fila de saida.
- Enviar mensagem ou template pela Cloud API.
- Atualizar status e registrar erro.

### `POST /api/jobs/schedule-reminders`

Responsabilidade:

- Buscar lembretes pendentes vencidos.
- Aplicar regras de consentimento, horario comercial e duplicidade.
- Enfileirar envio.

## 6. Orquestracao do agente

Ordem de decisao:

1. Normalizar telefone.
2. Buscar conversa aberta pelo telefone.
3. Resolver participante: oficina, lead, cliente final ou desconhecido.
4. Aplicar regras deterministicas de alta prioridade.
5. Escolher `agent_mode`.
6. Classificar mensagem com IA somente quando necessario.
7. Executar ferramenta interna validada.
8. Gerar resposta.
9. Persistir mensagem, tool call e mudanca de status.

Regras deterministicas de alta prioridade:

- Opt-out: `parar`, `cancelar`, `nao quero`, `remover`.
- Mensagem de status do provedor: nao chamar IA.
- Oficina pausada ou cancelada: nao enviar lembretes.
- Cliente sem consentimento: nao enviar template.
- Lembrete ja enviado para o mesmo servico: nao duplicar.

Ferramentas internas permitidas:

```text
create_lead
update_lead
create_oficina
get_oficina_by_whatsapp
create_cliente_final
create_servico
create_lembrete
update_lembrete_status
create_retorno
handoff_to_human
calculate_roi
```

Handoff humano:

- Acionar quando o cliente perguntar preco especifico, disponibilidade real de agenda ou algo fora do escopo.
- Acionar quando a confianca da classificacao ficar abaixo de `0.70`.
- Acionar quando houver conflito de identidade do telefone.

## 7. Variaveis de ambiente

```text
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_WHATSAPP_NUMBER

SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

OPENAI_API_KEY
OPENAI_MODEL_CLASSIFIER
OPENAI_MODEL_RESPONDER

WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID

INTERNAL_JOB_SECRET
CRON_SECRET
```

Regras:

- Variaveis com `NEXT_PUBLIC_` podem ir ao browser.
- Chaves de service role, OpenAI e WhatsApp ficam apenas no servidor.
- `CRON_SECRET` protege chamadas vindas de cron HTTP, caso Vercel seja usado para algum job.

## 8. Plano por fases

### Fase 1 - Bot vendedor

Entrega:

- Webhook real do WhatsApp.
- Persistencia de eventos e mensagens.
- Criacao/atualizacao de lead.
- Agente em modo `vendas`.
- Qualificacao basica.
- Marcacao de lead como `interessado`.

Teste de aceite:

- Um lead vindo da landing envia a primeira mensagem e aparece em `leads_oficina` com origem `landing_page`.
- Pergunta "como funciona?" recebe resposta mencionando cadastro da troca, lembrete automatico e retorno do cliente.

### Fase 2 - Conversao e onboarding

Entrega:

- Conversao de lead em oficina.
- Criacao de `oficinas`.
- Mudanca para `agent_mode = onboarding`.
- Registro da primeira troca por WhatsApp.
- Criacao de cliente final, veiculo, servico e lembrete.

Teste de aceite:

- Uma mensagem com nome, carro, servico e WhatsApp cria os quatro registros necessarios.
- Se faltar dado obrigatorio, o agente pergunta apenas o dado faltante.

### Fase 3 - Lembretes reais

Entrega:

- Scheduler diario.
- Fila de envios.
- Envio de template aprovado.
- Registro de `whatsapp_message_id`.
- Tratamento de status e retry.
- Opt-out funcional.

Teste de aceite:

- Um lembrete vencido muda de `pendente` para `enfileirado` e depois para `enviado`.
- Cliente que responde "parar" vira `opt_out` e tem lembretes futuros cancelados.

### Fase 4 - Retorno e dashboard

Entrega:

- Registro de retorno por WhatsApp.
- Calculo de receita gerada.
- Dashboard com metricas principais.
- Telas basicas de clientes, lembretes, conversas e retornos.

Teste de aceite:

- Oficina informa "Joao voltou hoje, R$ 250" e o sistema cria retorno vinculado ao cliente/lembrete.
- Dashboard aumenta receita gerada e clientes que voltaram.

## 9. Riscos tecnicos e mitigacoes

WhatsApp bloquear ou limitar mensagens:

- Usar Cloud API oficial.
- Usar templates aprovados.
- Controlar opt-out.
- Evitar disparos promocionais.
- Registrar consentimento.

Agente confundir oficina e cliente final:

- Resolver identidade antes de chamar IA.
- Usar `participant_type` e `agent_mode`.
- Bloquear acesso cruzado por `oficina_id`.

Custo de IA crescer:

- Classificar por regras antes de chamar o modelo.
- Usar modelos menores para classificacao e extracao.
- Guardar resumo de conversa quando a conversa ficar longa.

Perda de mensagem:

- Persistir payload bruto antes de processar.
- Processar via fila.
- Usar idempotencia por `whatsapp_message_id` e `provider_event_id`.

Confirmacao de agenda sem calendario real:

- Usar texto de pre-agendamento no MVP.
- Encaminhar para oficina quando o cliente pedir horario especifico.

## 10. Ordem de implementacao recomendada

1. Criar schema inicial e policies RLS.
2. Criar webhook WhatsApp com persistencia idempotente.
3. Criar filas `inbound_message_jobs` e `outbound_message_jobs`.
4. Implementar resolvedor de identidade.
5. Implementar agente vendedor com ferramentas limitadas.
6. Implementar conversao e onboarding.
7. Implementar extracao estruturada de troca.
8. Implementar scheduler e envio de templates.
9. Implementar opt-out e handoff.
10. Implementar dashboard operacional minimo.

## 11. Fontes tecnicas consultadas

- Supabase Queues: https://supabase.com/docs/guides/queues
- Supabase Cron: https://supabase.com/docs/guides/cron
- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel Cron usage and pricing: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Meta WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- Meta WhatsApp Webhooks: https://developers.facebook.com/docs/graph-api/webhooks
- Meta WhatsApp Message Templates: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
