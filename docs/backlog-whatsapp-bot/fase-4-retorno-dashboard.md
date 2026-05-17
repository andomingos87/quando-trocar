# Fase 4 - Retorno e dashboard

> **Atualizada em 2026-05-17.** Mudancas decorrentes das ADRs 0008, 0010, 0012:
>
> - **Login do painel da oficina**: passou de Supabase Auth Phone OTP por SMS para **OTP enviado via WhatsApp** usando template Meta categoria "Authentication" (ADR-0010). Sem Twilio, sem SMS.
> - **Painel admin separado** para devs/fundadores/donos gerenciarem planos, precos e oficinas (ADR-0012). Mesmo fluxo OTP via WhatsApp, mas resolvido contra `admin_users`.
> - **Modelagem de planos**: tabela `planos` + `oficinas.plano_id` + `oficinas.preco_negociado` para suportar preco variavel por oficina (ADR-0012).
> - **Pagamento via Mercado Pago** (ADR-0008) entra como sub-fase desta Fase 4 (Fase 4F).

## Objetivo

Fechar o ciclo de valor do produto registrando retornos, receita gerada e exibindo as metricas principais em um dashboard operacional simples para a oficina. Adicionalmente, entregar painel admin minimo para gerencia de planos/precos e iniciar billing via Mercado Pago.

A Fase 4 parte do estado consolidado das Fases 1, 2 e 3:

- leads ja podem virar oficinas ativas;
- oficinas ja registram trocas pelo WhatsApp;
- `clientes_finais`, `veiculos`, `servicos` e `lembretes` ja sao criados pelo fluxo operacional;
- lembretes ja podem ser enfileirados, enviados e rastreados pela Meta;
- respostas de cliente final ja caem em `agent_mode = cliente_final_lembrete`;
- opt-out, numero errado, handoff e erro de provedor ja ficam auditados.

O objetivo agora nao e criar um CRM completo. O objetivo e mostrar valor financeiro claro: quais clientes voltaram, quanto isso gerou e quais proximas acoes a oficina precisa tomar.

## Escopo

Inclui:

- Area logada basica da oficina.
- **Login passwordless via OTP enviado por WhatsApp** (template Meta categoria Authentication) — ADR-0010.
- Primeiro acesso criando ou confirmando o vinculo entre usuario autenticado e oficina.
- Vinculo de usuario autenticado com oficina via `oficina_members`.
- RLS real por `oficina_id` nas tabelas exibidas no painel.
- Registro de retorno pelo WhatsApp da oficina.
- Registro de retorno pelo painel.
- Vinculo entre retorno, cliente, veiculo, servico original, lembrete e novo servico de retorno.
- Confirmacao de retorno como operacao transacional.
- Criacao do proximo lembrete quando um retorno concluido gerar novo servico.
- Calculo de receita gerada.
- Dashboard com metricas principais.
- Telas basicas de inicio, registrar troca, clientes, lembretes, conversas e retornos.
- Configuracoes essenciais da oficina (incluindo `whatsapp_atendente` para handoff da Fase 3).
- **Painel admin separado** (URL distinta, ex.: `/admin`) para devs/fundadores/donos — gerencia de planos, precos e oficinas (ADR-0012).
- **Modelo de planos** com tabela `planos` e preco negociado por oficina (ADR-0012).
- **Cobranca via Mercado Pago** (ADR-0008): geracao de link de pagamento, webhook de confirmacao, atualizacao de status da oficina.

Nao inclui:

- ERP completo.
- Financeiro completo.
- Nota fiscal.
- Estoque.
- CRM avancado.
- Gestao completa de equipe, permissoes e multiplos membros por oficina.
- Relatorios complexos.
- Agenda com calendario externo.
- Confirmacao automatica de agenda real sem validacao da oficina.
- Multiplos tiers de plano (Starter/Pro/Business). MVP usa plano unico com preco variavel (ADR-0012).

## Dependencias

- Fase 3 concluida (incluindo handoff via `wa.me` e `oficinas.whatsapp_atendente`).
- Template `lembrete_troca_oleo` aprovado e envio real validado.
- Rota interna do consumer deployada.
- `INTERNAL_JOB_SECRET` consistente entre app e Vault do Supabase.
- Lembretes enviados e respostas registradas.
- Supabase Auth definido para area logada (modo: anonymous sign-in ou custom JWT, ja que o OTP eh proprio via WhatsApp).
- **Template Meta categoria "Authentication" aprovado** para envio de OTP de login (ADR-0010). Ciclo de aprovacao Meta leva horas a dias — solicitar com antecedencia.
- `oficina_members` associando usuarios autenticados a oficinas.
- RLS funcionando por `oficina_id`.
- **Conta Mercado Pago configurada** com `MERCADO_PAGO_ACCESS_TOKEN` (ADR-0008).

Observacao importante:

- `oficina_members` ja existe na modelagem da Fase 2, mas a area logada e as policies RLS para uso pelo painel ainda precisam ser tratadas como parte explicita desta fase.
- Como tabelas `public` ficam expostas pela Data API do Supabase, toda tabela exibida no painel deve ter RLS e policies de membership antes de ser usada por cliente autenticado.
- O OTP via WhatsApp **substitui** Supabase Auth Phone OTP por SMS. Nada de Twilio.

## Dados

Tabelas usadas:

- `retornos`
- `clientes_finais`
- `veiculos`
- `servicos`
- `lembretes`
- `conversas`
- `mensagens`
- `outbound_messages`
- `oficinas`
- `oficina_members`
- `agent_tool_calls`

Nova tabela principal:

```text
retornos
```

Campos recomendados:

```text
id uuid primary key
oficina_id uuid not null
cliente_id uuid not null
veiculo_id uuid
lembrete_id uuid
servico_origem_id uuid
servico_retorno_id uuid
conversa_id uuid
mensagem_id uuid
status text not null
valor numeric
scheduled_for timestamptz
completed_at timestamptz
origem text not null
observacao text
idempotency_key text
created_at timestamptz
updated_at timestamptz
```

Status de retorno:

```text
agendado
concluido
nao_compareceu
reagendar
cancelado
```

Origem de retorno:

```text
whatsapp_oficina
painel
resposta_cliente
importacao
```

Regras de modelagem:

- `lembrete_id` e nullable porque a oficina pode registrar retorno sem lembrete relacionado.
- `servico_origem_id` representa o servico que gerou o lembrete original.
- `servico_retorno_id` representa o novo servico criado quando o cliente volta.
- `valor` so deve contar em receita quando `status = concluido`.
- `idempotency_key` deve ser usado para evitar duplicidade em registros vindos de WhatsApp ou acoes repetidas no painel.
- Criar indice por `(oficina_id, status, completed_at desc)`.
- Criar indice por `(oficina_id, cliente_id, created_at desc)`.
- Criar indice unico parcial para `idempotency_key` quando nao for nulo.

Tabela de membership:

```text
oficina_members
```

Campos minimos recomendados para uso pelo painel:

```text
id uuid primary key
oficina_id uuid not null
user_id uuid not null
role text not null
status text not null
created_at timestamptz
updated_at timestamptz
```

Roles iniciais:

```text
owner
member
```

Status de membership:

```text
active
revoked
```

Regras de membership:

- No MVP, apenas o `whatsapp_principal` da oficina acessa como `owner`.
- A tabela ja deve suportar `member`, mas convite e gestao de equipe ficam fora da V1.
- Criar indice unico por `(oficina_id, user_id)`.
- Policies do painel devem considerar apenas memberships com `status = active`.

## Auth, RLS e acesso ao painel (ADR-0010 — OTP via WhatsApp)

A Fase 4 deve incluir uma entrega propria de seguranca antes das telas. O login eh **passwordless via OTP enviado por WhatsApp** — sem senha, sem email, sem SMS.

### Componentes

- Tabela `auth_otps`: `id`, `target` (`oficina` ou `admin`), `target_id`, `whatsapp`, `code_hash`, `attempts`, `expires_at`, `used_at`, `created_at`, `ip`.
- Sessao: cookie HTTP-only assinado (JWT proprio ou Supabase Auth com custom claims). TTL recomendado: 30 dias com refresh.
- Cliente WhatsApp para envio do template de OTP (reusar `lib/whatsapp/whatsapp-client.ts`).
- Rate limiting: maximo de 3 envios de OTP por numero por 15 min, e 1 por IP por 60s.
- Validacao: codigo expira em 5 min, maximo de 5 tentativas por OTP.

### Tabelas com policies RLS por membership

- `oficinas`
- `oficina_members`
- `clientes_finais`
- `veiculos`
- `servicos`
- `lembretes`
- `retornos`
- `conversas`
- `mensagens`
- `outbound_messages`

`auth_otps`, `admin_users` e `admin_audit_log` (introduzidos na Fase 4F) ficam **sem RLS** e acessadas apenas via service role no backend.

### Fluxo de login do painel da oficina

1. Usuario acessa `/entrar`.
2. Informa o WhatsApp principal da oficina.
3. Aplicacao normaliza o telefone para E.164.
4. Backend verifica se existe `oficinas.status = ativa` com esse `whatsapp_principal`.
5. Se nao existir, mostrar mensagem orientando contato pelo WhatsApp comercial. Nao envia codigo.
6. Se existir, gerar codigo de 6 digitos, persistir hash em `auth_otps` com `expires_at = now() + 5 min`, e enviar via template Meta "Authentication" para o numero. Se a conversa estiver dentro da janela de 24h, envio livre eh aceitavel; fora dela, **obrigatorio template approved**.
7. Usuario informa o codigo no painel.
8. Backend valida (hash bate, nao expirou, nao usado, attempts < 5) → cria sessao.
9. Backend cria ou confirma `oficina_members` como `owner` para o usuario autenticado.
10. Dashboard resolve a oficina atual pela sessao + `oficina_members`.

Mensagem para telefone sem acesso:

```text
Nao encontramos uma oficina ativa com esse numero. Fale conosco pelo WhatsApp para ativar seu acesso.
```

### Regras gerais

- A oficina vira cliente pelo WhatsApp e deve ter `oficinas.whatsapp_principal` normalizado antes do primeiro acesso ao painel.
- Nao permitir cadastro livre pelo painel: telefone desconhecido nao cria oficina nem acesso automaticamente.
- Envio de codigo apenas para telefone vinculado a oficina ativa.
- Se o usuario tiver uma unica oficina ativa, entrar direto no dashboard.
- Se no futuro o usuario tiver mais de uma oficina ativa, exibir seletor simples de oficina.
- Sessao persistida no navegador para evitar codigo a cada acesso comum.
- Nunca usar `user_metadata` para autorizacao.
- Nunca usar telefone digitado, parametro de URL ou nome da oficina como autorizacao final.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ou `MERCADO_PAGO_ACCESS_TOKEN` em cliente React.
- `UPDATE` precisa de policy de `SELECT` correspondente, senao pode retornar zero linhas sem erro.
- Views de dashboard, se forem usadas, devem ser `security_invoker = true` no Postgres 15+ ou ficar fora do schema exposto.
- RPCs privilegiadas devem validar membership explicitamente ou ficar restritas ao backend com service role.

### Template Meta "Authentication" para OTP

Variavel unica: o codigo de 6 digitos. Exemplo de copy (Meta tem regras estritas de copy para Authentication):

```text
{{1}} eh seu codigo de acesso ao Quando Trocar. Valido por 5 minutos. Nao compartilhe.
```

Cadastrar em `WHATSAPP_TEMPLATE_OTP_NAME` (env var) com categoria "Authentication".

## Metricas principais

Metricas exibidas:

```text
receita_gerada
clientes_que_voltaram
lembretes_enviados
clientes_cadastrados
taxa_de_conversao
```

Definicoes:

- `receita_gerada`: soma de `retornos.valor` onde `status = concluido`, `valor is not null` e `completed_at` esta no periodo.
- `receita_gerada_por_lembretes`: soma de `retornos.valor` onde `status = concluido`, `lembrete_id is not null` e `completed_at` esta no periodo.
- `clientes_que_voltaram`: contagem distinta de `cliente_id` em retornos concluidos no periodo.
- `lembretes_enviados`: contagem de lembretes ou outbound messages aceitos para envio, usando status operacional da Fase 3.
- `clientes_cadastrados`: contagem de `clientes_finais` criados no periodo.
- `taxa_de_conversao`: retornos concluidos vinculados a lembrete dividido por lembretes enviados no periodo.

Regras:

- A metrica principal da tela inicial deve ser `receita_gerada_por_lembretes`, porque ela prova recorrencia gerada pelo produto.
- Retorno `agendado` nao entra em receita.
- Retorno `nao_compareceu`, `reagendar` ou `cancelado` nao entra em receita.
- Receita deve ser calculada por `oficina_id`.
- Dashboard deve evitar dupla contagem quando houver multiplos registros para o mesmo lembrete.

## Operacao `create_retorno`

A ferramenta/RPC `create_retorno` deve ser transacional. A IA pode extrair dados, mas nao deve sozinha gravar estado critico sem validacao deterministica.

Entradas recomendadas:

```text
oficina_id
cliente_id
veiculo_id
lembrete_id
servico_origem_id
status
valor
scheduled_for
completed_at
origem
observacao
idempotency_key
```

Comportamento:

- Validar que a oficina esta ativa.
- Validar que cliente, veiculo, servico e lembrete pertencem a mesma `oficina_id`.
- Se `status = agendado`, criar retorno agendado. **Nao escrever `lembretes.status = agendado`** — ADR-0009 removeu esse status. Lembrete relacionado, se existir, deve estar em `respondido` ou `handoff_iniciado` (decisao da Fase 3).
- Se `status = concluido`, criar retorno concluido.
- Se `status = concluido`, criar um novo registro em `servicos` para o servico de retorno.
- Se `status = concluido` e o cliente ainda tiver consentimento valido, criar o proximo `lembretes` com base em `oficinas.dias_lembrete_padrao`.
- Se `status = nao_compareceu`, marcar retorno sem gerar receita nem novo servico.
- Se `status = reagendar`, manter retorno sem gerar receita e exigir nova data quando aplicavel.
- Registrar decisao em `agent_tool_calls` quando a origem for WhatsApp.
- Respeitar `idempotency_key` para nao duplicar retorno em retry ou clique repetido.

## Regras de retorno por WhatsApp

Formas aceitas vindas da oficina:

```text
Joao voltou hoje, servico R$ 250
Joao veio trocar oleo, 250 reais
Cliente Joao retornou hoje
Joao agendou pra sexta
Joao nao apareceu
```

Interpretacao:

- Mensagem da oficina em `agent_mode = onboarding` ou `operacao` pode criar retorno se houver sinal claro de retorno/agendamento.
- Resposta de cliente final em `agent_mode = cliente_final_lembrete` nao deve criar receita automaticamente.
- Cliente final dizendo que quer agendar deve gerar handoff ou retorno `agendado` somente se houver regra deterministica e contexto seguro.
- Cliente final dizendo "ja fiz" deve ser tratado como informacao para oficina, nao como retorno concluido com receita.

Quando faltar valor:

- Pelo WhatsApp, criar retorno `concluido` com `valor = null` apenas se a correspondencia de cliente for segura e a mensagem indicar retorno real.
- Pelo painel, preencher o campo com sugestao de `oficinas.ticket_medio`, mas exigir confirmacao da oficina.
- Receita so aumenta quando houver retorno concluido com valor informado.

Quando houver ambiguidade:

- Se houver mais de um cliente com nome parecido, pedir confirmacao.
- Se o mesmo WhatsApp existir em mais de uma oficina e nao houver contexto confiavel, usar handoff em vez de atribuir automaticamente.
- Se nao houver lembrete relacionado, criar retorno sem `lembrete_id` e registrar auditoria.
- Se houver mais de um lembrete recente para o mesmo cliente, preferir o mais recente enviado/respondido; se ainda for ambiguo, pedir confirmacao.

## Dashboard MVP

Tela `Inicio`:

- Card principal: receita gerada por lembretes no mes.
- Cards secundarios: clientes cadastrados, lembretes enviados, clientes que voltaram e taxa de conversao.
- Bloco de atividades recentes.
- Bloco `Hoje`: lembretes pendentes, respostas aguardando acao, retornos agendados e retornos sem valor.
- Estado vazio com proximas acoes para primeira utilizacao.

Tela `Registrar troca`:

- Formulario simples para cadastrar troca em menos de 30 segundos.
- Campos principais: cliente, WhatsApp, veiculo, placa opcional, servico, data da troca e KM opcional.
- Servico padrao `Troca de oleo`.
- Prazo padrao vindo de `oficinas.dias_lembrete_padrao`.
- Previa do proximo lembrete antes de confirmar.
- Reutilizacao de cliente existente pelo telefone dentro da mesma oficina.
- Campos adicionais devem ficar opcionais para nao parecer sistema burocratico.

Tela `Clientes`:

- Busca por nome, telefone, veiculo ou placa.
- Lista com status do proximo lembrete.
- Perfil simples com historico de servicos, lembretes, mensagens e retornos.
- Marcacao de opt-out.
- Acao para criar lembrete manual, se permitido.

Tela `Lembretes`:

- Filtros por status.
- Acao individual de envio quando permitido.
- Historico de tentativas via `outbound_messages`.
- Indicacao de resposta recebida e acao pendente.

Tela `Conversas`:

- Lista por prioridade.
- Visual de mensagens.
- Acoes rapidas: marcar como agendado, confirmar retorno, encerrar conversa.
- Exibicao do contexto do cliente: veiculo, ultima troca, proximo lembrete e historico curto.
- Evitar termos tecnicos como webhook, API, provider ou automacao.

Tela `Retornos`:

- Lista de agendados e concluidos.
- Acao `Confirmar retorno`.
- Campo de valor com ticket medio como sugestao.
- Marcacao de nao compareceu.
- Marcacao de reagendar.
- Historico de retornos por cliente.

Tela `Configuracoes`:

- Dados basicos da oficina.
- Ticket medio.
- Horario permitido de envio.
- Texto base do lembrete.
- Prazo padrao de lembrete.

## Divisao recomendada da Fase 4

### Fase 4A - Area logada, oficina atual e RLS

- [ ] Solicitar aprovacao Meta de template categoria "Authentication" para OTP (com antecedencia).
- [ ] Criar tabela `auth_otps` (com hash do codigo, expires_at, attempts, used_at).
- [ ] Implementar emissao de codigo, persistencia, envio via template Meta, rate limiting (3/15min por numero, 1/60s por IP).
- [ ] Implementar rota `/entrar` (input do WhatsApp + tela de codigo).
- [ ] Normalizar telefone informado para E.164 antes de buscar oficina.
- [ ] Bloquear envio de codigo para telefone sem oficina ativa.
- [ ] Implementar validacao do codigo, criacao de sessao (JWT proprio ou Supabase Auth com claims).
- [ ] Implementar primeiro acesso criando ou confirmando `oficina_members` como `owner`.
- [ ] Implementar resolucao de oficina atual via `oficina_members`.
- [ ] Criar layout protegido do dashboard.
- [ ] Criar policies RLS por `oficina_id`.
- [ ] Garantir que policies usam `oficina_members.status = active`.
- [ ] Testar isolamento entre duas oficinas.

### Fase 4B - Retornos e confirmacao manual

- [ ] Criar tabela `retornos`.
- [ ] Criar indices e constraint de idempotencia.
- [ ] Criar `create_retorno` transacional.
- [ ] Implementar acao manual `Confirmar retorno`.
- [ ] Implementar campo de valor com ticket medio como sugestao.
- [ ] Criar testes para retorno concluido, agendado, nao compareceu e duplicidade.

### Fase 4C - Retorno pelo WhatsApp da oficina

- [ ] Implementar extracao estruturada para mensagem de retorno.
- [ ] Vincular retorno ao cliente por nome, telefone ou conversa ativa.
- [ ] Vincular retorno ao lembrete quando houver contexto seguro.
- [ ] Pedir confirmacao quando houver ambiguidade.
- [ ] Registrar auditoria em `agent_tool_calls`.
- [ ] Garantir que resposta de cliente final nao gere receita automaticamente.

### Fase 4D - Metricas e dashboard Inicio

- [ ] Criar consultas agregadas para dashboard.
- [ ] Implementar tela `Inicio` com `receita_gerada_por_lembretes` em destaque.
- [ ] Implementar atividades recentes.
- [ ] Implementar bloco `Hoje`.
- [ ] Criar estados vazios para primeira utilizacao.

### Fase 4E - Telas operacionais

- [ ] Implementar tela `Registrar troca`.
- [ ] Implementar tela `Clientes`.
- [ ] Implementar tela `Lembretes`.
- [ ] Implementar tela `Conversas`.
- [ ] Implementar tela `Retornos`.
- [ ] Implementar tela `Configuracoes` — incluir campo `whatsapp_atendente` (handoff da Fase 3).
- [ ] Garantir que todas as telas respeitam RLS e oficina atual.

### Fase 4F - Painel admin + modelo de planos (ADR-0012)

Painel separado em `/admin` para devs/fundadores/donos gerenciarem planos, precos e oficinas.

- [ ] Criar tabela `planos`: `id, nome, preco_base, descricao, ativo, created_at, updated_at`. Seed inicial: 1 plano ativo (nome a definir, preco_base inicial pode ser zero ou valor placeholder).
- [ ] Adicionar `oficinas.plano_id` (FK para `planos`) e `oficinas.preco_negociado` (numeric, nullable).
- [ ] Criar tabela `admin_users`: `id, whatsapp, nome, ativo, created_at`. Seed: WhatsApps de Anderson e demais admins iniciais.
- [ ] Criar tabela `admin_audit_log`: `id, admin_id, acao, entidade, entidade_id, payload, ip, created_at`.
- [ ] Implementar fluxo de login admin: mesmo OTP via WhatsApp da Fase 4A, mas resolvendo contra `admin_users` (com `ativo = true`).
- [ ] Tela admin `Planos`: listar, criar, editar `preco_base` e `descricao`, marcar `ativo`.
- [ ] Tela admin `Oficinas`: listar, filtrar por status/plano, editar `plano_id`, editar `preco_negociado`.
- [ ] Toda acao admin que muta estado deve registrar em `admin_audit_log`.
- [ ] Testar isolamento: oficina nao acessa `/admin`; admin nao precisa de `oficina_members`.

### Fase 4G - Cobranca via Mercado Pago (ADR-0008)

- [ ] Configurar `MERCADO_PAGO_ACCESS_TOKEN` em env vars.
- [ ] Criar tabela `pagamentos`: `id, oficina_id, valor, status, mp_preference_id, mp_payment_id, descricao, created_at, updated_at, paid_at`.
- [ ] Implementar geracao de preferencia de pagamento Mercado Pago com valor = `oficinas.preco_negociado` ou `planos.preco_base` (fallback).
- [ ] Implementar fluxo de cobranca disparado pelo painel admin ou ao final do periodo de teste.
- [ ] Implementar endpoint `/api/webhooks/mercado-pago` com validacao de assinatura.
- [ ] Atualizar `oficinas.status` e `pagamentos.status` no recebimento de notificacao.
- [ ] Garantir idempotencia via `mp_payment_id` unique (ADR-0006).
- [ ] Tela admin: listar pagamentos, status, link para detalhes Mercado Pago.

## Criterios de aceite

- Dado uma oficina ativa com `whatsapp_principal`, quando o dono informa o telefone em `/entrar` e valida o codigo, entao o sistema cria ou confirma `oficina_members` como `owner`.
- Dado um telefone sem oficina ativa, quando alguem tenta entrar, entao o sistema nao envia acesso ao dashboard nem cria oficina automaticamente.
- Dado um usuario autenticado sem `oficina_members` ativo, quando acessa o dashboard, entao o acesso e bloqueado.
- Dado uma oficina informando "Joao voltou hoje, R$ 250", o sistema cria retorno vinculado ao cliente quando houver correspondencia segura.
- Dado um retorno concluido com valor, o dashboard aumenta `receita_gerada`.
- Dado um retorno concluido com lembrete vinculado, o dashboard aumenta `receita_gerada_por_lembretes`.
- Dado um retorno concluido com cliente elegivel para lembrete, o sistema cria novo `servicos` e proximo `lembretes`.
- Dado um cliente agendado, a oficina consegue confirmar retorno pelo painel.
- Dado uma resposta de cliente final dizendo "quero agendar", o sistema nao registra receita automaticamente.
- Dado uma resposta de cliente final dizendo "ja fiz", o sistema nao registra receita automaticamente sem confirmacao da oficina.
- Dado um usuario autenticado de uma oficina, ele nao consegue acessar dados de outra oficina.
- Dado uma oficina sem retorno ainda, o dashboard mostra proximas acoes sem quebrar a experiencia.
- Dado uma oficina registrando troca pelo painel, o sistema reutiliza cliente existente pelo telefone na mesma oficina e cria novo servico/lembrete.
- Dado um clique repetido ou retry de webhook, `idempotency_key` impede retorno duplicado.

## Testes recomendados

- Teste de login por telefone e OTP via WhatsApp para oficina ativa.
- Teste de telefone desconhecido sem criacao automatica de acesso (e sem envio de OTP).
- Teste de OTP expirado (apos 5 min).
- Teste de OTP com codigo errado ate o limite de tentativas (5).
- Teste de rate limit (3 envios/15min por numero).
- Teste de primeiro acesso criando ou confirmando `oficina_members`.
- Teste de Auth/membership resolvendo a oficina atual.
- Teste de RLS por oficina para leitura e escrita.
- Teste de membership `revoked` sem acesso ao painel.
- Teste de login admin (mesmo fluxo OTP, resolvido contra `admin_users`).
- Teste de oficina tentando acessar `/admin` (deve bloquear).
- Teste de mutacao admin gerando entrada em `admin_audit_log`.
- Teste de webhook Mercado Pago: payment confirmed marca `pagamentos.status = pago` e atualiza `oficinas.status`.
- Teste de idempotencia: webhook Mercado Pago duplicado nao duplica pagamento.
- Teste de extracao de retorno por WhatsApp da oficina.
- Teste de vinculacao segura ao cliente.
- Teste de comportamento com cliente ambiguo.
- Teste de resposta de cliente final nao criando receita automaticamente.
- Teste de `create_retorno` criando servico e proximo lembrete em transacao.
- Teste de idempotencia de retorno.
- Teste de agregacao de receita por mes.
- Teste de taxa de conversao por lembrete.
- Teste de renderizacao das telas com estado vazio.
- Teste de registro de troca pelo painel reutilizando cliente por telefone.
- Teste de acao manual `Confirmar retorno`.
- Teste de painel sem vazamento de dados entre oficinas.

## Riscos

- Envio de codigo OTP para telefone sem oficina ativa gerar acesso indevido ou custo desnecessario. **Mitigacao**: bloquear antes do envio.
- Telefone mal normalizado impedir acesso legitimo ou vincular a oficina errada. **Mitigacao**: normalizar E.164 e testar variacoes.
- Template OTP da Meta ser recusado ou demorar para aprovar. **Mitigacao**: solicitar com antecedencia; usar copy padrao Meta para Authentication.
- OTP enviado fora da janela 24h sem template aprovado falha silenciosamente. **Mitigacao**: sempre usar o template Authentication, mesmo dentro da janela, para consistencia.
- Forca bruta no OTP. **Mitigacao**: limite de 5 tentativas por codigo, rate limit 3/15min por numero.
- Receita ser inflada por retorno duplicado. **Mitigacao**: `idempotency_key` em `retornos`.
- Vinculo errado entre retorno e cliente.
- Resposta de cliente final virar receita sem confirmacao da oficina.
- Confirmar retorno sem criar o proximo ciclo de servico/lembrete.
- Dashboard virar CRM complexo cedo demais.
- RLS mal configurado expor dados entre oficinas.
- View ou RPC privilegiada bypassar RLS.
- **Admin com poder destrutivo sem rastro**. Mitigacao: `admin_audit_log` obrigatorio em toda mutacao admin.
- **Webhook Mercado Pago duplicado** marcando pagamento duas vezes. Mitigacao: `mp_payment_id` unique.

## Saida esperada

Ao final da fase, o produto mostra valor financeiro claro: clientes cadastrados, lembretes enviados, clientes que voltaram e receita gerada por recorrencia.

A oficina deve conseguir:

- ver o dinheiro gerado pelos lembretes;
- confirmar retornos com poucos cliques;
- entender quais respostas precisam de acao;
- acompanhar clientes, lembretes e conversas sem operar um CRM pesado;
- continuar o ciclo criando o proximo lembrete depois de um retorno concluido.
