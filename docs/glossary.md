# Glossário · Quando Trocar

Vocabulário de domínio do produto. Se você não reconhece um termo num PRD, ADR, código ou conversa, é provável que esteja aqui.

Sempre que um termo novo aparecer em mais de um doc, adicione aqui antes de espalhar. Fonte única de verdade.

## Participantes da conversa

### oficina
A empresa cliente do Quando Trocar — uma oficina mecânica, troca de óleo, centro automotivo. É o comprador e operador do produto. Identificada por `oficinas.id` no banco. Multi-tenancy é escopada por `oficina_id` (ver [ADR-0003](./adr/0003-multi-tenancy-via-rls-oficina-id.md)).

### cliente_final
O cliente da oficina — pessoa física que troca óleo, faz revisão, etc. Recebe lembretes automáticos para voltar à oficina. Identificado por `clientes_finais.id`. Sempre escopado a uma `oficina_id`.

### lead_oficina
Uma oficina que ainda não comprou o produto. Veio pela landing page ou outra origem e está em conversa com o agente vendedor. Quando converte, vira `oficina_cliente` e cria um registro em `oficinas`. Tabela: `leads_oficina`.

### contato_desconhecido
WhatsApp que mandou mensagem para o número da empresa mas ainda não foi identificado como oficina nem cliente final. Estado transitório — agente pergunta ou infere e depois classifica.

### participant_type
Enum que classifica quem está na conversa: `oficina` · `cliente_final` · `lead_oficina` · `contato_desconhecido`. Resolvido pelo `conversation-router` antes de invocar o LLM. Ver [ADR-0002](./adr/0002-roteamento-via-agent-mode.md).

## Modos do agente

### agent_mode
Estado de roteamento que define qual agente atende e com qual prompt/regras. Resolvido deterministicamente antes do LLM. Cinco modos:

- **vendas** — atende `lead_oficina`. Explica produto, qualifica, calcula ROI, conduz para teste/contratação.
- **onboarding** — atende `oficina` recém-convertida. Ensina a registrar a primeira troca. Após o primeiro serviço com sucesso, transita para `operacao`.
- **operacao** — atende `oficina` ativa. Registra serviços, cria lembretes, atualiza dados.
- **cliente_final_lembrete** — atende `cliente_final` que respondeu a um lembrete. Interpreta intenções (agendar, reagendar, opt-out).
- **suporte** — handoff humano. Encaminha conversa para representante quando o agente não consegue resolver.

Ver [ADR-0002](./adr/0002-roteamento-via-agent-mode.md) e `AGENTS.md §Architecture Rules`.

## Operação e ciclo de vida

### lembrete
Mensagem automática agendada para um `cliente_final` no momento em que se aproxima da próxima troca de óleo (ou outro serviço). Default: data do serviço + 90 dias. Tabela: `lembretes`. Statuses: `pendente · enfileirado · enviado · respondido · agendado · sem_resposta · cancelado · erro_envio`.

### retorno
Evento de cliente final voltando à oficina e gerando receita. Fecha o ciclo de valor do produto. Tabela: `retornos`. Pode ser registrado via WhatsApp pela oficina ou via painel.

### consentimento_whatsapp
Flag explícita em `clientes_finais.consentimento_whatsapp` indicando que a oficina obteve autorização para enviar lembretes via WhatsApp. Sem consentimento, nenhum lembrete é enviado. Campos relacionados: `origem_consentimento`, `data_consentimento`.

### opt_out
Cliente final pediu para parar de receber mensagens (`parar`, `cancelar`, `não quero`, `remover`). Sistema marca `clientes_finais.status = opt_out`, cancela lembretes futuros e confirma a remoção.

## WhatsApp e infraestrutura

### template_name
Nome de um template aprovado pela Meta para mensagens fora da janela de 24h. Exemplo: `lembrete_troca_oleo`. Mensagens iniciais ou de reativação precisam ser templates aprovados. Dentro da janela de 24h, mensagens livres são permitidas. Ver [ADR-0005](./adr/0005-templates-meta-vs-mensagem-livre.md).

### whatsapp_message_id
ID retornado pela Cloud API da Meta quando uma mensagem é enviada (campo `messages[0].id` na resposta). Persistido em `mensagens.whatsapp_message_id` e `lembretes.whatsapp_message_id` para tracking de status e idempotência. Ver [ADR-0006](./adr/0006-idempotencia-via-provider-ids.md).

### webhook_event_id
ID único do evento recebido no webhook da Meta. Usado para evitar processamento duplicado (idempotência). Persistido em `whatsapp_events`.

### janela de atendimento (24h)
Período de 24h após a última mensagem do usuário em que a oficina pode responder com mensagem de texto livre. Fora da janela, só templates aprovados. Regra da Meta WhatsApp Business Cloud API.

### pgmq / Supabase Queues
Sistema de filas baseado em Postgres usado para processamento assíncrono (envio de WhatsApp, processamento de webhooks). `pgmq` é a extensão Postgres; Supabase Queues é a interface gerenciada. Ver [ADR-0004](./adr/0004-padrao-webhook-persist-fila-worker.md).

### pg_cron / Supabase Cron
Agendador baseado em Postgres usado para o scheduler diário de lembretes. Roda `pg_cron` por baixo dos panos. Configurado no projeto Supabase.

## Estados comerciais (lead/oficina)

### status do lead
Ciclo de vida do `lead_oficina`: `novo · em_conversa · qualificado · interessado · teste_aceito · cliente_ativo · perdido · convertido`. Transições controladas por regras determinísticas (não pelo LLM). Ver [ADR-0001](./adr/0001-llm-como-conselheiro-nao-decisor.md).

### plano da oficina
Tier comercial de uma `oficina` ativa. Hoje: `teste`. Política definitiva ainda em aberto — ver [ADR-0012](./adr/0012-politica-de-preco.md).
