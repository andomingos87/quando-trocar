# Fase 1 - Bot vendedor

## Objetivo

Receber leads vindos da landing page pelo WhatsApp, registrar a conversa com auditoria e operar um agente vendedor capaz de explicar o produto, qualificar a oficina e marcar interesse.

## Escopo

Inclui:

- Webhook real do WhatsApp.
- Validacao inicial de webhook da Meta.
- Persistencia de eventos recebidos e mensagens.
- Criacao ou atualizacao de `leads_oficina`.
- Criacao ou atualizacao de `conversas`.
- Agente em modo `vendas`.
- Qualificacao basica da oficina.
- Calculo simples de ROI.
- Envio de resposta pelo WhatsApp dentro da janela de atendimento.

Nao inclui:

- Criacao de oficina cliente.
- Registro de troca.
- Envio de templates fora da janela de 24 horas.
- Dashboard completo.
- Pagamento ou assinatura.

## Dependencias

- Conta Meta Developer configurada.
- WhatsApp Business Cloud API habilitada.
- Numero de WhatsApp conectado.
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`.
- Projeto Supabase criado.
- Chaves `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.
- `OPENAI_API_KEY`.

## Dados

Tabelas necessarias nesta fase:

- `leads_oficina`
- `conversas`
- `mensagens`
- `whatsapp_events`
- `agent_tool_calls`
- `outbound_messages`

Enums/status usados:

```text
leads_oficina.status:
novo, em_conversa, qualificado, interessado, perdido

conversas.participant_type:
lead_oficina, contato_desconhecido

conversas.agent_mode:
vendas

mensagens.direction:
inbound, outbound
```

## Tarefas tecnicas

- [ ] Criar migration inicial com tabelas da fase.
- [ ] Habilitar RLS nas tabelas expostas.
- [ ] Criar policies para acesso por servidor e futura area logada.
- [ ] Criar endpoint `GET /api/webhooks/whatsapp` para validacao da Meta.
- [ ] Criar endpoint `POST /api/webhooks/whatsapp`.
- [ ] Validar assinatura ou token do webhook.
- [ ] Persistir payload bruto em `whatsapp_events`.
- [ ] Tornar o recebimento idempotente por `provider_event_id` ou `whatsapp_message_id`.
- [ ] Normalizar telefone para formato E.164.
- [ ] Criar ou atualizar lead por telefone.
- [ ] Criar ou atualizar conversa por telefone.
- [ ] Persistir mensagem recebida em `mensagens`.
- [ ] Criar classificador de vendas com saida estruturada.
- [ ] Implementar ferramenta `calculate_roi`.
- [ ] Implementar ferramentas `create_lead` e `update_lead`.
- [ ] Implementar geracao de resposta curta para venda.
- [ ] Criar outbox para mensagens de saida.
- [ ] Enviar resposta pela Cloud API.
- [ ] Persistir `whatsapp_message_id` retornado pela Meta.
- [ ] Registrar tool calls e mudancas de status em auditoria.

## Regras do agente

O agente deve:

- Explicar que a oficina cadastra a troca e o sistema chama o cliente depois.
- Fazer perguntas curtas.
- Pedir volume mensal de trocas e ticket medio quando houver interesse.
- Calcular ROI com taxa padrao de 10%.
- Marcar lead como `interessado` quando o usuario aceitar testar ou pedir proximos passos.

O agente nao deve:

- Prometer integracoes inexistentes.
- Inventar preco, plano ou prazo comercial.
- Criar oficina cliente nesta fase.
- Fazer disparos promocionais.

## Criterios de aceite

- Dado um clique na landing, quando o lead envia a primeira mensagem, o sistema cria `leads_oficina` com `origem = landing_page`.
- Dado um lead perguntando "como funciona?", o agente responde mencionando cadastro da troca, lembrete automatico e retorno do cliente.
- Dado um lead informando volume mensal e ticket medio, o sistema calcula uma estimativa de receita recuperada.
- Dado um evento repetido do WhatsApp, o sistema nao duplica mensagem nem lead.
- O webhook responde em menos de 2 segundos em fluxo normal.

## Testes recomendados

- Teste unitario de normalizacao de telefone.
- Teste unitario do calculo de ROI.
- Teste de idempotencia de evento recebido.
- Teste de classificacao estruturada para mensagens comerciais comuns.
- Teste de endpoint `GET /api/webhooks/whatsapp`.
- Teste de endpoint `POST /api/webhooks/whatsapp` com payload exemplo.

## Riscos

- Configuracao da Meta atrasar validacao do webhook.
- LLM classificar interesse cedo demais.
- Eventos duplicados gerarem conversa duplicada.
- Lead sem origem quando vier de mensagem manual fora da landing.

## Saida esperada

Ao final da fase, uma oficina interessada consegue iniciar conversa real pelo WhatsApp, entender o produto, responder perguntas de qualificacao e ficar registrada como lead interessado.
