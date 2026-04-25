# PRD — Bot WhatsApp com Agente IA para o Quando Trocar

**Versão:** 1.0 — Implementação Real  
**Data:** 2026-04-25  
**Produto:** Quando Trocar  
**Objetivo:** Implementar o agente real no WhatsApp que vende o produto para oficinas, cadastra oficinas convertidas e opera a recorrência automática com clientes finais.

---

## 1. Visão do Produto

O bot do Quando Trocar é o agente comercial e operacional da máquina de recorrência da oficina.

Ele atua em dois momentos:

1. Antes da contratação: atende a oficina interessada, explica o produto, tira dúvidas, calcula valor potencial e tenta fechar.
2. Depois da contratação: trabalha para a oficina, registrando trocas, criando lembretes e acompanhando retornos.

Resumo:

```text
Landing page
→ WhatsApp
→ Agente vendedor
→ Oficina vira cliente
→ Agente operacional
→ Registro de trocas
→ Lembretes automáticos
→ Retorno do cliente
→ Receita contabilizada
```

---

## 2. Objetivo da Implementação

Construir uma versão real do bot WhatsApp capaz de:

- Receber leads vindos da landing page.
- Conversar com oficinas interessadas.
- Explicar o produto de forma simples.
- Responder objeções comerciais.
- Qualificar a oficina.
- Conduzir para teste ou contratação.
- Registrar a oficina no banco.
- Reconhecer quando a oficina já é cliente.
- Operar o fluxo de recorrência com clientes finais.
- Enviar lembretes automáticos no WhatsApp.
- Registrar respostas, agendamentos, retornos e receita.

---

## 3. Personas

### 3.1 Dono da Oficina

Perfil:

- 35-55 anos.
- Usa WhatsApp todos os dias.
- Não quer aprender sistema complexo.
- Quer cliente voltando e dinheiro no caixa.

Necessidade:

```text
"Quero que meus clientes voltem sem eu ter que lembrar um por um."
```

### 3.2 Recepcionista ou Mecânico

Perfil:

- Operacional.
- Precisa cadastrar rápido.
- Pode preferir mandar mensagem no WhatsApp em vez de abrir painel.

Necessidade:

```text
"Preciso registrar a troca sem atrapalhar o atendimento."
```

### 3.3 Representante Comercial

Perfil:

- Vende para oficinas.
- Quer produto fácil de explicar.
- Pode enviar a landing ou link do WhatsApp para o dono da oficina.

Necessidade:

```text
"Preciso mostrar valor rápido e deixar o agente continuar a venda."
```

---

## 4. Escopo do Produto Real

### Dentro do escopo

- Integração real com WhatsApp.
- Agente IA com modos de atendimento.
- Banco de dados persistente.
- Cadastro de leads.
- Cadastro de oficinas.
- Cadastro de clientes finais.
- Registro de serviços/trocas.
- Agendamento automático de lembretes.
- Envio automático de mensagens.
- Interpretação de respostas.
- Registro de status da conversa.
- Registro de retorno e receita.
- Dashboard operacional básico.
- Logs e auditoria de mensagens.
- Fila de envio para evitar perda de mensagens.

### Fora do escopo inicial

- ERP completo.
- CRM completo.
- Emissão de nota fiscal.
- Controle financeiro da oficina.
- Estoque.
- App mobile nativo.
- Multiatendente complexo.
- Importação massiva de planilhas.
- Campanhas promocionais genéricas.
- IA tomando decisões financeiras ou legais.
- Agendamento com calendário externo na primeira versão.

---

## 5. Princípio Central do Agente

O agente deve sempre saber quem está falando e em qual contexto.

Estados principais:

```text
lead_oficina
oficina_cliente
cliente_final
contato_desconhecido
```

Modos do agente:

```text
vendas
onboarding
operacao
suporte
cliente_final_lembrete
```

Regra principal:

```text
Antes da contratação, o agente vende para a oficina.
Depois da contratação, o agente trabalha para a oficina.
```

---

## 6. Fluxo 0 — Aquisição pela Landing Page

### Descrição

A oficina acessa a landing page, entende a proposta e clica no botão principal de WhatsApp.

CTA principal:

```text
Quero testar na minha oficina
```

O botão abre uma conversa com mensagem pré-preenchida:

```text
Oi, quero entender como funciona o Quando Trocar para minha oficina.
```

### Entrada no sistema

Quando a mensagem chega:

1. Webhook do WhatsApp recebe o evento.
2. Sistema identifica o número como desconhecido.
3. Cria ou atualiza um `lead_oficina`.
4. Define `agent_mode = vendas`.
5. Agente inicia atendimento comercial.

### Dados gravados

```text
lead_id
nome_inferido
whatsapp
origem = landing_page
status = novo
agent_mode = vendas
created_at
last_interaction_at
```

---

## 7. Fluxo 1 — Agente Vendedor

### Objetivo

Transformar um lead de oficina em uma oficina cadastrada ou cliente em teste.

### Comportamentos esperados

O agente deve:

- Explicar o produto em linguagem simples.
- Fazer perguntas curtas.
- Evitar jargão técnico.
- Mostrar valor financeiro.
- Usar exemplos de troca de óleo.
- Responder dúvidas comuns.
- Conduzir para cadastro.
- Não parecer robô genérico.

### Roteiro base

Quando perguntarem como funciona:

```text
Funciona assim: quando sua oficina troca o óleo de um cliente, você cadastra nome, WhatsApp e carro. Depois de 90 dias, o sistema chama esse cliente automaticamente para voltar na sua oficina.
```

Quando perguntarem o benefício:

```text
O objetivo é fazer o cliente voltar para você, em vez de esquecer e trocar óleo em outro lugar.
```

Quando o lead demonstrar interesse:

```text
Posso fazer uma conta rápida com você? Quantas trocas de óleo sua oficina faz por mês, mais ou menos?
```

### Dados de qualificação

Campos mínimos:

```text
nome_oficina
nome_responsavel
cidade
whatsapp_oficina
volume_trocas_mes
ticket_medio
principal_servico
interesse
objeção_principal
```

### Cálculo simples de ROI

Regra inicial:

```text
receita_potencial = clientes_recuperados_estimados * ticket_medio
clientes_recuperados_estimados = volume_trocas_mes * taxa_conversao_estimada
taxa_conversao_estimada_default = 10%
```

Exemplo:

```text
Se você faz 80 trocas por mês e recuperar só 8 clientes, com ticket médio de R$ 250, são R$ 2.000 voltando para a oficina.
```

---

## 8. Fluxo 2 — Conversão da Oficina

### Descrição

Quando a oficina aceita testar ou contratar, o agente deve mudar o status do lead.

Estados comerciais:

```text
novo
em_conversa
qualificado
interessado
teste_aceito
cliente_ativo
perdido
```

### Critérios para virar cliente

Uma oficina vira cliente quando:

- Aceita iniciar teste.
- Aceita contratar.
- Informa dados mínimos da oficina.
- Confirma que deseja começar a cadastrar clientes.

### Ação do sistema

Quando convertido:

```text
lead_oficina
→ oficina_cliente
```

Criar registro em `oficinas`:

```text
oficina_id
nome
responsavel
whatsapp_principal
cidade
ticket_medio
volume_trocas_mes
status = ativa
plano = teste
origem = landing_whatsapp
created_at
```

Atualizar lead:

```text
status = convertido
converted_at
oficina_id
```

Atualizar agente:

```text
agent_mode = onboarding
```

---

## 9. Fluxo 3 — Onboarding da Oficina

### Objetivo

Ensinar rapidamente a oficina a registrar a primeira troca.

### Mensagem inicial após conversão

```text
Pronto, sua oficina está cadastrada.

Para registrar uma troca, me mande assim:

Nome do cliente, carro, serviço feito hoje e WhatsApp do cliente.

Exemplo:
João Silva, Civic 2018, troca de óleo hoje, 41999990000.
```

### Primeiro sucesso esperado

A oficina registra pelo menos um cliente final.

Quando isso acontecer:

```text
Cliente cadastrado. Vou lembrar o João em 90 dias para voltar trocar óleo com você.
```

Depois do primeiro registro:

```text
agent_mode = operacao
```

---

## 10. Fluxo 4 — Registro de Trocas

### Entrada

A oficina pode registrar uma troca por:

1. Mensagem no WhatsApp.
2. Painel web.
3. Futuramente, importação.

### Exemplo via WhatsApp

```text
Registrar João, Civic 2018, troca de óleo hoje, WhatsApp 41999990000
```

### O agente deve extrair

```text
nome_cliente
whatsapp_cliente
veiculo
servico
data_servico
oficina_id
```

### Campos obrigatórios

- Nome do cliente final.
- WhatsApp do cliente final.
- Veículo.
- Serviço.
- Data do serviço.

### Comportamento se faltar dado

Se faltar WhatsApp:

```text
Faltou o WhatsApp do cliente. Pode me mandar o número dele?
```

Se faltar veículo:

```text
Qual é o carro do cliente?
```

Se faltar serviço:

```text
Qual serviço foi feito? Troca de óleo?
```

### Regra de agendamento

Default:

```text
proximo_lembrete = data_servico + 90 dias
```

No futuro, o serviço poderá ter frequência própria:

```text
troca_oleo = 90 dias
alinhamento = 180 dias
revisao = 180 dias
```

---

## 11. Fluxo 5 — Lembretes Automáticos

### Objetivo

Enviar WhatsApp para clientes finais quando estiverem próximos da próxima troca.

### Scheduler

Rodar diariamente.

Consulta:

```text
Buscar lembretes onde:
status = pendente
scheduled_at <= agora
oficina.status = ativa
```

### Mensagem padrão

```text
Oi [nome], aqui é da [oficina].
Já está na hora da próxima troca de óleo do seu [veiculo].
Quer agendar?
```

### Status do lembrete

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

### Regras de envio

- Não enviar fora de horário comercial configurado.
- Não enviar para cliente sem consentimento.
- Não enviar duplicado para o mesmo serviço.
- Registrar o `message_id` retornado pela API do WhatsApp.
- Reprocessar erros temporários.

---

## 12. Fluxo 6 — Cliente Final Responde

### Objetivo

Interpretar a resposta do cliente e avançar o status.

### Intenções esperadas

```text
quer_agendar
quer_reagendar
pergunta_preco
pergunta_horario
nao_tem_interesse
ja_fez_servico
numero_errado
mensagem_indefinida
```

### Exemplo

Cliente:

```text
Opa, pode ser quinta 14h?
```

Agente:

```text
Perfeito. Vou deixar pré-agendado para quinta às 14h na [oficina].
```

Banco:

```text
status_conversa = agendado
data_agendada = quinta 14h
```

### Quando o agente não souber responder

Encaminhar para a oficina:

```text
O cliente perguntou algo específico. Vou avisar a oficina para confirmar com você.
```

E notificar a oficina:

```text
O cliente João perguntou sobre preço/horário. Pode assumir a conversa?
```

---

## 13. Fluxo 7 — Retorno e Receita

### Objetivo

Fechar o ciclo de valor: cliente voltou e gerou receita.

### Formas de registrar retorno

1. Oficina informa no WhatsApp:

```text
João voltou hoje, serviço R$ 250
```

2. Oficina marca no painel.

### Dados gravados

```text
retorno_id
oficina_id
cliente_id
servico_id
lembrete_id
data_retorno
valor
status = concluido
```

### Impacto no dashboard

Atualizar:

```text
clientes_cadastrados
lembretes_enviados
clientes_que_voltaram
receita_gerada
taxa_de_conversao
```

Observação: para a comunicação comercial, priorizar sempre:

```text
Receita gerada
Clientes que voltaram
Lembretes enviados
Clientes cadastrados
```

---

## 14. Modelo de Dados

### Tabela: leads_oficina

```text
id
whatsapp
nome_responsavel
nome_oficina
cidade
volume_trocas_mes
ticket_medio
status
agent_mode
origem
oficina_id
created_at
updated_at
converted_at
last_interaction_at
```

### Tabela: oficinas

```text
id
nome
responsavel
whatsapp_principal
cidade
ticket_medio
volume_trocas_mes
status
plano
origem
created_at
updated_at
```

### Tabela: clientes_finais

```text
id
oficina_id
nome
whatsapp
consentimento_whatsapp
status
created_at
updated_at
```

### Tabela: veiculos

```text
id
cliente_id
oficina_id
descricao
placa
created_at
updated_at
```

### Tabela: servicos

```text
id
oficina_id
cliente_id
veiculo_id
tipo
descricao
data_servico
valor
created_at
```

### Tabela: lembretes

```text
id
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
created_at
updated_at
```

### Tabela: conversas

```text
id
whatsapp
participant_type
lead_id
oficina_id
cliente_id
agent_mode
status
last_message_at
created_at
updated_at
```

### Tabela: mensagens

```text
id
conversa_id
direction
sender_type
body
whatsapp_message_id
raw_payload
intent
created_at
```

### Tabela: retornos

```text
id
oficina_id
cliente_id
veiculo_id
servico_id
lembrete_id
data_retorno
valor
status
created_at
```

---

## 15. Arquitetura Técnica

### Componentes

```text
Landing page
WhatsApp Provider
Webhook API
Message Queue
Agent Orchestrator
LLM
Database
Scheduler
Dashboard
Admin/Logs
```

### Fluxo técnico de mensagem recebida

```text
WhatsApp Provider
→ Webhook API
→ Validação de assinatura
→ Persistência da mensagem
→ Identificação do contato
→ Definição do agent_mode
→ Agente IA gera resposta ou ação
→ Banco atualiza estado
→ Fila envia resposta
→ WhatsApp Provider
```

### Fluxo técnico de lembrete

```text
Scheduler diário
→ Busca lembretes pendentes
→ Enfileira envios
→ WhatsApp Provider envia
→ Atualiza status
→ Aguarda resposta do cliente
```

---

## 16. Requisitos do Agente IA

### O agente deve

- Manter contexto da conversa.
- Identificar se está falando com oficina ou cliente final.
- Extrair dados estruturados de mensagens livres.
- Fazer perguntas de follow-up quando faltarem dados.
- Responder com linguagem simples.
- Não inventar preços, planos ou promessas não configuradas.
- Registrar eventos importantes no banco.
- Transferir para humano quando necessário.

### O agente não deve

- Prometer integração que não existe.
- Confirmar horário impossível.
- Inventar endereço da oficina.
- Enviar mensagem promocional sem permissão.
- Discutir assuntos fora do produto.
- Expor dados de outros clientes ou oficinas.

### Ferramentas internas do agente

O agente deve ter acesso controlado a funções:

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

---

## 17. Integração WhatsApp

### Opções possíveis

- Meta WhatsApp Business Cloud API.
- Z-API.
- Evolution API.
- Outro BSP homologado.

### Requisitos mínimos

- Receber mensagens via webhook.
- Enviar mensagens de sessão.
- Enviar templates aprovados para conversas fora da janela de 24h.
- Receber status de entrega.
- Persistir `message_id`.
- Suportar retries.
- Validar origem do webhook.

### Templates necessários

Template de lembrete:

```text
Oi {{1}}, aqui é da {{2}}.
Já está na hora da próxima troca de óleo do seu {{3}}.
Quer agendar?
```

Template de reativação de oficina:

```text
Oi {{1}}, sua oficina ainda pode recuperar clientes com lembretes automáticos.
Quer registrar uma troca agora?
```

---

## 18. Regras de Consentimento e Compliance

### Cliente final

A oficina deve ter autorização para usar o WhatsApp do cliente para lembretes de serviço.

O sistema deve registrar:

```text
consentimento_whatsapp = true/false
origem_consentimento
data_consentimento
```

### Opt-out

Se o cliente responder:

```text
parar
cancelar
não quero
remover
```

O sistema deve:

```text
clientes_finais.status = opt_out
cancelar lembretes futuros
confirmar remoção
```

Mensagem:

```text
Tudo certo. Você não receberá novos lembretes por aqui.
```

---

## 19. Dashboard MVP

### Métricas principais

```text
Clientes cadastrados
Lembretes enviados
Clientes que voltaram
Receita gerada
```

### Telas mínimas

1. Visão geral.
2. Clientes cadastrados.
3. Lembretes.
4. Conversas.
5. Retornos.
6. Configurações da oficina.

### Configurações da oficina

```text
nome da oficina
responsável
WhatsApp
cidade
ticket médio
horário permitido para envio
mensagem padrão
```

---

## 20. Requisitos Não Funcionais

### Confiabilidade

- Nenhuma mensagem recebida pode ser perdida.
- Webhook deve responder rápido e processar pesado em fila.
- Envio deve ter retry.
- Erros devem ser logados.

### Segurança

- Validar webhooks.
- Separar dados por oficina.
- Não vazar clientes entre oficinas.
- Proteger chaves de API.
- Registrar ações do agente.

### Performance

- Webhook deve responder em até 2 segundos.
- Resposta do agente deve ser enviada em até 15 segundos em cenário normal.
- Scheduler deve suportar lotes diários de lembretes.

### Observabilidade

Registrar:

```text
mensagem recebida
mensagem enviada
intenção detectada
ferramenta chamada
erro do provedor WhatsApp
erro do LLM
mudança de status
handoff humano
```

---

## 21. MVP Recomendado

### Fase 1 — Bot vendedor

- Landing abre WhatsApp.
- Webhook recebe mensagens.
- Lead é criado.
- Agente responde dúvidas.
- Agente qualifica.
- Agente marca lead como interessado.

### Fase 2 — Conversão e onboarding

- Criar oficina pelo WhatsApp.
- Mudar agente para onboarding.
- Registrar primeira troca.
- Criar cliente final, serviço e lembrete.

### Fase 3 — Lembretes reais

- Scheduler diário.
- Envio real de template WhatsApp.
- Registro de status.
- Interpretação de respostas simples.

### Fase 4 — Retorno e dashboard

- Registrar retorno pelo WhatsApp.
- Calcular receita.
- Dashboard com métricas principais.

---

## 22. Critérios de Aceite

### Aquisição

- Dado um clique na landing, quando o lead envia a primeira mensagem, então o sistema cria um lead com origem `landing_page`.

### Vendas

- Dado um lead perguntando como funciona, quando o agente responde, então a explicação deve mencionar cadastro da troca, lembrete automático e retorno do cliente.

### Conversão

- Dado um lead que aceita testar, quando os dados mínimos são coletados, então o sistema cria uma oficina ativa em modo teste.

### Operação

- Dada uma oficina ativa, quando ela envia uma mensagem com dados de troca, então o sistema cria cliente, serviço e lembrete.

### Lembrete

- Dado um lembrete pendente vencido, quando o scheduler roda, então a mensagem é enviada e o status muda para `enviado`.

### Resposta do cliente

- Dado um cliente respondendo com data e horário, quando o agente interpreta a mensagem, então o status muda para `agendado`.

### Retorno

- Dada uma oficina informando que o cliente voltou e pagou, quando o agente processa, então um retorno é criado e a receita do dashboard aumenta.

---

## 23. Riscos

### Risco: WhatsApp bloquear mensagens

Mitigação:

- Usar templates aprovados.
- Respeitar opt-out.
- Controlar frequência.
- Evitar linguagem promocional agressiva.

### Risco: agente confundir oficina com cliente final

Mitigação:

- Resolver identidade antes de gerar resposta.
- Manter `participant_type`.
- Usar modos explícitos do agente.

### Risco: dados incompletos no registro de troca

Mitigação:

- Agente pergunta apenas o dado faltante.
- Não cria lembrete sem dados mínimos.

### Risco: confirmação de agenda sem controle real da oficina

Mitigação:

- Usar linguagem de pré-agendamento no MVP.
- Permitir confirmação humana.

### Risco: custo de IA por mensagem

Mitigação:

- Usar regras determinísticas para mensagens simples.
- Chamar LLM apenas quando necessário.
- Cachear contexto resumido da conversa.

---

## 24. Decisões em Aberto

- Qual provedor WhatsApp será usado na primeira versão?
- O pagamento será feito dentro do fluxo ou manualmente no MVP?
- O agente pode confirmar agenda ou apenas pré-agendar?
- Haverá painel para a oficina na primeira versão ou tudo começa pelo WhatsApp?
- O representante comercial terá visão própria dos leads?
- Qual será a política de preço/plano usada pelo agente vendedor?

---

## 25. Definição de Sucesso

O bot será considerado bem-sucedido quando:

- Um lead vindo da landing conseguir entender o produto sem atendimento humano.
- Uma oficina conseguir virar cliente/teste pelo WhatsApp.
- A oficina conseguir registrar uma troca pelo WhatsApp.
- O sistema enviar um lembrete real para cliente final.
- O cliente final responder e o sistema interpretar corretamente.
- A oficina conseguir registrar retorno e receita.

Resultado esperado:

```text
O WhatsApp deixa de ser apenas canal de conversa
e vira a operação comercial e recorrente da oficina.
```
