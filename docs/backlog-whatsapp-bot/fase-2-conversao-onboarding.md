# Fase 2 - Conversao e onboarding

## Objetivo

Converter um lead interessado em oficina em teste e permitir que a oficina registre a primeira troca pelo WhatsApp, criando cliente final, veiculo, servico e lembrete.

Ao final da fase, o bot deixa de ser apenas um respondedor comercial mensagem a mensagem e passa a ter estado de conversa suficiente para conduzir conversao, onboarding e registro da primeira troca.

## Estado de partida da Fase 1

A Fase 1 ja entregou:

- webhook real `GET /api/webhooks/whatsapp` e `POST /api/webhooks/whatsapp`;
- validacao de assinatura da Meta;
- persistencia de eventos brutos em `whatsapp_events`;
- criacao e atualizacao de `leads_oficina`;
- criacao e atualizacao de `conversas`;
- persistencia de mensagens inbound e outbound em `mensagens`;
- outbox em `outbound_messages`;
- auditoria de decisoes em `agent_tool_calls`;
- agente vendedor com `agent_mode = vendas`;
- protecao contra duplicidade basica;
- registro de falhas de processamento em `whatsapp_events`.

Restricoes atuais que a Fase 2 precisa alterar:

- `leads_oficina.status` aceita apenas `novo`, `em_conversa`, `qualificado`, `interessado` e `perdido`;
- `conversas.agent_mode` aceita apenas `vendas`;
- `conversas.participant_type` aceita apenas `lead_oficina` e `contato_desconhecido`;
- `conversas` nao possui `oficina_id`, `cliente_id` nem contexto persistido;
- `leads_oficina` nao possui `oficina_id`, `converted_at` nem campos comerciais estruturados;
- o repositorio atual cria conversa sempre em modo `vendas`;
- o webhook atual sempre trata o remetente como lead de oficina.

## Escopo

Inclui:

- Compatibilizacao do schema da Fase 1 para suportar oficina convertida.
- Conversao de `lead_oficina` para `oficina_cliente`.
- Criacao de registro em `oficinas`.
- Mudanca de `agent_mode` para `onboarding`.
- Persistencia de estado de onboarding e follow-up.
- Instrucao de cadastro da primeira troca.
- Extracao estruturada de dados de troca.
- Perguntas de follow-up quando faltar dado obrigatorio.
- Criacao transacional de cliente final, veiculo, servico e lembrete.
- Mudanca para `agent_mode = operacao` apos o primeiro registro bem-sucedido.

Nao inclui:

- Envio real do lembrete ao cliente final.
- Scheduler diario.
- Dashboard completo.
- Confirmacao real de agenda.
- Importacao de planilhas.
- Login da oficina na area web.
- RLS final para usuarios autenticados de oficina.
- Fila/worker assincrono obrigatorio. A Fase 2 pode continuar sincronica, desde que preserve auditoria e idempotencia.

## Dependencias

- Fase 1 concluida.
- Lead com status `interessado` ou `teste_aceito`.
- Schema inicial com tabelas `leads_oficina`, `conversas`, `mensagens`, `whatsapp_events`, `agent_tool_calls` e `outbound_messages`.
- Prompt de agente vendedor separado do prompt de onboarding.
- Uso de `SUPABASE_SERVICE_ROLE_KEY` somente no backend.

## Dados

### Tabelas novas

- `oficinas`
- `oficina_members`
- `clientes_finais`
- `veiculos`
- `servicos`
- `lembretes`

### Tabelas ampliadas

`leads_oficina`:

```text
nome_responsavel
nome_oficina
cidade
volume_trocas_mes
ticket_medio
principal_dor
melhor_horario_contato
interesse_declarado_at
motivo_perda
oficina_id
converted_at
```

`conversas`:

```text
oficina_id
cliente_id
context jsonb
```

### Status e modos

`leads_oficina.status` deve aceitar:

```text
novo
em_conversa
qualificado
interessado
teste_aceito
convertido
perdido
```

`conversas.participant_type` deve aceitar:

```text
lead_oficina
oficina_cliente
cliente_final
contato_desconhecido
```

`conversas.agent_mode` deve aceitar:

```text
vendas
onboarding
operacao
cliente_final_lembrete
suporte
```

Na Fase 2, implementar apenas `vendas`, `onboarding` e `operacao`. Os demais valores podem entrar no check para evitar nova migration imediata nas proximas fases.

### Campos importantes

```text
oficinas.status = ativa
oficinas.plano = teste
oficinas.origem = landing_whatsapp
oficinas.whatsapp_principal = telefone do lead convertido
oficinas.dias_lembrete_padrao = 90
clientes_finais.status = ativo
clientes_finais.consentimento_whatsapp = true
clientes_finais.origem_consentimento = oficina_informou_cliente
lembretes.status = pendente
lembretes.scheduled_at = servicos.data_servico + oficinas.dias_lembrete_padrao
```

Regra de consentimento para o MVP:

- quando a oficina informa o WhatsApp do cliente final para lembrete de servico, assumir `consentimento_whatsapp = true` e registrar `origem_consentimento = oficina_informou_cliente`;
- se a oficina disser explicitamente que o cliente nao autorizou, salvar `consentimento_whatsapp = false` e nao criar lembrete;
- a Fase 3 deve implementar opt-out real do cliente final.

## Tarefas tecnicas

### Schema e migrations

- [ ] Expandir check de `leads_oficina.status` para incluir `teste_aceito` e `convertido`.
- [ ] Adicionar campos comerciais estruturados em `leads_oficina`: `nome_responsavel`, `nome_oficina`, `cidade`, `volume_trocas_mes`, `ticket_medio`, `principal_dor`, `melhor_horario_contato`, `interesse_declarado_at`, `motivo_perda`.
- [ ] Adicionar `leads_oficina.oficina_id` e `leads_oficina.converted_at`.
- [ ] Criar tabela `oficinas`.
- [ ] Criar tabela `oficina_members`.
- [ ] Criar tabela `clientes_finais`.
- [ ] Criar tabela `veiculos`.
- [ ] Criar tabela `servicos`.
- [ ] Criar tabela `lembretes`.
- [ ] Adicionar `conversas.oficina_id`, `conversas.cliente_id` e `conversas.context jsonb not null default '{}'::jsonb`.
- [ ] Expandir check de `conversas.participant_type` para incluir `oficina_cliente` e `cliente_final`.
- [ ] Expandir check de `conversas.agent_mode` para incluir `onboarding`, `operacao`, `cliente_final_lembrete` e `suporte`.
- [ ] Criar indices por `oficina_id` em `clientes_finais`, `veiculos`, `servicos`, `lembretes`, `conversas` e `mensagens` quando aplicavel.
- [ ] Criar unique index em `clientes_finais (oficina_id, whatsapp)`.
- [ ] Criar unique index em `oficinas (whatsapp_principal)`.
- [ ] Criar indice `lembretes (status, scheduled_at)` filtrado para lembretes pendentes.
- [ ] Habilitar RLS nas novas tabelas publicas, mantendo acesso operacional pelo backend com service role nesta fase.

### Repositorio e ferramentas internas

- [ ] Atualizar tipos em `lib/whatsapp/types.ts` para novos status, participantes e modos.
- [ ] Criar ferramenta `create_oficina`.
- [ ] Criar ferramenta `get_oficina_by_whatsapp`.
- [ ] Criar ferramenta `convert_lead_to_oficina`.
- [ ] Criar ferramenta `create_cliente_final`.
- [ ] Criar ferramenta `create_veiculo`.
- [ ] Criar ferramenta `create_servico`.
- [ ] Criar ferramenta `create_lembrete`.
- [ ] Criar ferramenta transacional `register_service_with_reminder`.
- [ ] Registrar todas as ferramentas relevantes em `agent_tool_calls`.

### Resolucao de identidade e modo

- [ ] Substituir o `upsertConversation` fixo em `vendas` por uma etapa de resolucao de participante.
- [ ] Buscar primeiro oficina ativa por `whatsapp_principal`.
- [ ] Se encontrar oficina ativa, usar `participant_type = oficina_cliente`.
- [ ] Se a conversa da oficina estiver em `onboarding`, chamar agente de onboarding.
- [ ] Se a conversa da oficina estiver em `operacao`, chamar agente operacional de registro de troca.
- [ ] Se nao encontrar oficina, buscar ou criar `lead_oficina` e manter `agent_mode = vendas`.
- [ ] Manter idempotencia de inbound por `mensagens.whatsapp_message_id`.

### Conversao de lead

- [ ] Detectar aceite de teste com regra deterministica e/ou classificacao estruturada.
- [ ] Coletar dados minimos da oficina antes de converter: nome da oficina quando possivel, cidade quando possivel e WhatsApp do lead.
- [ ] Criar `oficinas` com `status = ativa`, `plano = teste`, `origem = landing_whatsapp`, `whatsapp_principal = lead.whatsapp`.
- [ ] Atualizar `leads_oficina.status = convertido`, `converted_at = now()` e `oficina_id`.
- [ ] Atualizar conversa para `participant_type = oficina_cliente`, `oficina_id` e `agent_mode = onboarding`.
- [ ] Enviar mensagem inicial de onboarding com exemplo de cadastro da troca.

Mensagem inicial apos conversao:

```text
Pronto, sua oficina esta cadastrada.

Para registrar uma troca, me mande assim:

Nome do cliente, carro, servico feito hoje e WhatsApp do cliente.

Exemplo:
Joao Silva, Civic 2018, troca de oleo hoje, 41999990000.
```

### Estado de onboarding e follow-up

- [ ] Usar `conversas.context` para guardar rascunho da troca em andamento.
- [ ] Persistir `context.pending_action = registrar_primeira_troca` quando o bot estiver esperando dados da primeira troca.
- [ ] Persistir `context.service_draft` com campos extraidos parcialmente.
- [ ] Persistir `context.missing_field` quando o bot fizer pergunta de follow-up.
- [ ] Quando a proxima mensagem chegar, combinar a resposta com o `service_draft` antes de validar novamente.
- [ ] Limpar `context.service_draft`, `context.missing_field` e `context.pending_action` apos cadastro bem-sucedido.

### Agente de onboarding e operacao

- [ ] Implementar prompt de onboarding separado do agente vendedor.
- [ ] Criar schema estruturado para extracao de troca.
- [ ] Implementar extracao deterministica basica antes da OpenAI quando a mensagem seguir o exemplo.
- [ ] Implementar fallback com OpenAI usando JSON schema estrito.
- [ ] Implementar validacao deterministica dos campos obrigatorios.
- [ ] Implementar perguntas de follow-up para dado faltante.
- [ ] Enviar confirmacao de cadastro da primeira troca.
- [ ] Atualizar `agent_mode = operacao` depois do primeiro sucesso.

Schema esperado da extracao:

```json
{
  "intent": "registrar_troca",
  "confidence": 0.91,
  "missing_fields": [],
  "data": {
    "nome_cliente": "Joao Silva",
    "whatsapp_cliente": "+5541999990000",
    "veiculo": "Civic 2018",
    "servico": "troca de oleo",
    "data_servico": "2026-04-25",
    "valor": null,
    "consentimento_whatsapp": true
  }
}
```

### Transacao de registro da troca

- [ ] Criar uma operacao unica para inserir ou reutilizar cliente final, inserir veiculo quando necessario, inserir servico e criar lembrete.
- [ ] Preferir RPC Postgres ou funcao server-side equivalente para garantir atomicidade.
- [ ] Reutilizar cliente existente por `clientes_finais (oficina_id, whatsapp)`.
- [ ] Reutilizar veiculo existente quando houver descricao igual para o mesmo cliente e oficina.
- [ ] Criar novo servico para cada troca registrada.
- [ ] Criar lembrete somente quando `consentimento_whatsapp = true`.
- [ ] Calcular `scheduled_at` com base em `data_servico + oficinas.dias_lembrete_padrao`.

## Regras do agente

Dados obrigatorios para registrar troca:

- Nome do cliente final.
- WhatsApp do cliente final.
- Veiculo.
- Servico.
- Data do servico.

Quando faltar dado:

- Faltou WhatsApp: perguntar somente pelo WhatsApp.
- Faltou nome do cliente: perguntar somente o nome do cliente.
- Faltou veiculo: perguntar somente qual e o carro.
- Faltou servico: perguntar se foi troca de oleo ou outro servico.
- Faltou data: assumir hoje somente quando a mensagem indicar "hoje"; caso contrario, perguntar a data.

Regras de data:

- "hoje" usa a data local em `America/Sao_Paulo`.
- "ontem" usa a data local menos 1 dia.
- Data ambigua como "segunda" deve gerar pergunta de confirmacao.
- Sem data explicita e sem palavra relativa nao deve assumir hoje.

Regra de agendamento:

- Default de lembrete: `data_servico + oficinas.dias_lembrete_padrao`.
- Se a oficina nao tiver configuracao, usar 90 dias.
- O lembrete nasce como `pendente`.
- Nao criar lembrete sem consentimento quando `consentimento_whatsapp = false`.

Regra de status:

- IA pode sugerir intent e dados extraidos.
- Mudancas de `lead.status`, `participant_type` e `agent_mode` devem ser validadas por regras deterministicas.
- `perdido` continua exigindo recusa explicita, como definido na Fase 1.

## Criterios de aceite

- Dado um lead `interessado` que aceita testar e informa dados minimos, o sistema cria uma oficina ativa em plano teste.
- Dado um lead convertido, `leads_oficina.status` vira `convertido`, `converted_at` e `oficina_id` sao preenchidos.
- Dada uma conversa convertida, `participant_type` vira `oficina_cliente` e `agent_mode` vira `onboarding`.
- Dada uma oficina ativa enviando "Joao, Civic 2018, troca de oleo hoje, 41999990000", o sistema cria cliente final, veiculo, servico e lembrete pendente.
- Dado cliente ja existente pelo telefone na mesma oficina, o sistema reutiliza o cliente e cria novo servico/lembrete.
- Dada uma mensagem sem WhatsApp do cliente, o agente pede apenas o WhatsApp e persiste o rascunho da troca em `conversas.context`.
- Dada a resposta do WhatsApp faltante, o sistema combina a resposta com o rascunho e conclui o cadastro.
- Dada uma primeira troca cadastrada com sucesso, a conversa muda para `agent_mode = operacao`.
- Dado `consentimento_whatsapp = false`, o sistema cria cliente/servico, mas nao cria lembrete.
- Dado erro na extracao, transacao ou envio da resposta, `whatsapp_events` registra falha com tipo, mensagem e contexto.

## Testes recomendados

- Teste de migration validando checks novos de `leads_oficina.status`, `conversas.participant_type` e `conversas.agent_mode`.
- Teste de conversao de lead em oficina.
- Teste de resolucao de identidade para telefone de oficina ativa.
- Teste de preservacao do fluxo de venda para telefone ainda nao convertido.
- Teste transacional de criacao de cliente, veiculo, servico e lembrete.
- Teste de rollback quando uma etapa da transacao falhar.
- Teste de deduplicacao de cliente por telefone dentro da mesma oficina.
- Teste permitindo o mesmo WhatsApp de cliente final em oficinas diferentes.
- Teste de extracao estruturada para mensagem completa de troca.
- Teste de follow-up para cada campo obrigatorio faltante.
- Teste de continuidade: pergunta por WhatsApp, recebe apenas telefone e conclui o cadastro.
- Teste de calculo de `scheduled_at`.
- Teste de nao criacao de lembrete sem consentimento.
- Teste de idempotencia para mensagem inbound repetida.
- Teste de regressao garantindo que mensagens neutras nao marcam lead como `perdido`.

## Arquivos provaveis

- `supabase/migrations/*_phase_2_conversion_onboarding.sql`
- `lib/whatsapp/types.ts`
- `lib/whatsapp/repository.ts`
- `lib/whatsapp/webhook-handler.ts`
- `lib/whatsapp/sales-agent.ts`
- `lib/whatsapp/onboarding-agent.ts`
- `lib/whatsapp/service-registration.ts`
- `tests/whatsapp-route.test.ts`
- `tests/whatsapp-repository.test.ts`
- `tests/whatsapp-onboarding-agent.test.ts`
- `tests/whatsapp-service-registration.test.ts`

## Riscos

- Cadastro incompleto gerar lembrete invalido.
- Mesmo cliente ser criado duplicado por variacao de telefone.
- Agente assumir data errada quando a mensagem for ambigua.
- Oficina confundir o formato de cadastro no primeiro uso.
- Conversa continuar presa em `vendas` por causa do upsert atual.
- Constraint do banco bloquear novos modos se a migration nao expandir checks antes do codigo.
- Falta de estado de follow-up fazer o bot perder contexto entre mensagens.
- Criacao parcial de cliente/servico/lembrete se o registro nao for transacional.
- Assumir consentimento de WhatsApp sem registrar origem do consentimento.

## Ordem recomendada de implementacao

1. Migration de compatibilidade do schema.
2. Tipos e contratos internos.
3. Repositorio e ferramentas transacionais.
4. Resolver de identidade e modo da conversa.
5. Conversao de lead para oficina.
6. Estado de onboarding em `conversas.context`.
7. Extracao e validacao de troca.
8. Follow-up de campos faltantes.
9. Registro transacional de cliente, veiculo, servico e lembrete.
10. Confirmacao e transicao para `agent_mode = operacao`.
11. Testes de regressao da Fase 1.

## Saida esperada

Ao final da fase, uma oficina convertida consegue registrar uma troca pelo WhatsApp e o sistema cria automaticamente a base operacional para lembrar esse cliente no futuro, sem quebrar o fluxo comercial ja entregue na Fase 1.
