# PRD — Painel Admin do Quando Trocar

**Versão:** 1.0 — MVP
**Data:** 2026-05-17
**Produto:** Quando Trocar
**Objetivo:** Especificar o painel administrativo usado por devs, fundadores e donos do produto para gerenciar oficinas (clientes), planos, preços, pagamentos e governança.

---

## 1. Visão do Produto

O painel admin é a área interna de operação do **produto Quando Trocar**. Não é da oficina e não é exposto para ela.

Ele responde a perguntas práticas que o time interno precisa fazer todo dia:

- Quantas oficinas estão ativas? Quanto isso representa em MRR?
- Quem está em teste, quem pagou, quem está atrasado?
- Quanto vou cobrar dessa oficina específica? Quero alterar?
- Quem é admin do sistema?
- O que foi alterado nas últimas 24h e por quem?

Não é:

- ❌ CRM do produto (sem pipeline comercial de vendas para oficinas).
- ❌ Ferramenta de suporte (sem ticket, chat ou impersonate no MVP).
- ❌ Painel financeiro/contábil (sem conciliação, nota fiscal, contabilidade).
- ❌ BI (sem relatórios customizáveis, exportação).

É:

- ✅ Operação enxuta: gerenciar oficinas, planos e cobrança recorrente.
- ✅ Governança: quem é admin, o que cada um fez.
- ✅ Visão consolidada: MRR, churn, oficinas em risco.

---

## 2. Decisões de base

Esta spec assume as ADRs:

- [ADR-0010](../adr/0010-painel-web-no-mvp.md) — login OTP WhatsApp.
- [ADR-0012](../adr/0012-politica-de-preco.md) — plano único com preço por oficina.
- [ADR-0013](../adr/0013-painel-admin-escopo-billing-auditoria.md) — escopo, billing recorrente e auditoria desta spec.

Em caso de divergência, a ADR prevalece.

---

## 3. Personas

### 3.1 Admin Fundador (Anderson)

Perfil:

- Conhece o produto a fundo.
- Toma decisões comerciais (preço, ativação, suspensão).
- Acessa o painel várias vezes por semana.

Necessidade:

```text
"Quero saber em segundos quanto estou faturando, quem está atrasado e fechar uma negociação alterando preço sem abrir SQL."
```

### 3.2 Admin Operacional (devs, futuramente parceiros)

Perfil:

- Cadastra oficina nova captada offline.
- Ajusta plano ou preço de oficinas existentes.
- Investiga problemas pontuais (pagamento falhou, oficina sumiu).

Necessidade:

```text
"Quero resolver o caso da Oficina X agora sem pedir SQL nem mandar mensagem pro time."
```

---

## 4. Princípios do produto

1. **Operação enxuta**: o painel só tem o que o admin usa toda semana. Tudo o mais é vetado.
2. **Toda mutação é auditada**. Sem exceção.
3. **Auth e RLS são linha vermelha**. Painel admin nunca expõe service role no cliente. Oficina nunca acessa `/admin`.
4. **Painel cresce com o produto**. MVP atende até ~500 oficinas; depois disso, revisitar performance.
5. **Sem impersonate no MVP**. Suporte profundo passa pelo Supabase direto.

---

## 5. Navegação

Layout: shell com sidebar fixa à esquerda, conteúdo à direita. Header com nome do admin logado e botão "Sair".

Sidebar:

```text
1. Visão geral
2. Oficinas
3. Planos
4. Pagamentos
5. Admins
6. Auditoria
```

Atalhos visíveis no topo: data e hora do servidor (para conferência), badge com o número de oficinas em risco (atraso de pagamento sem ação tomada).

---

## 6. Telas

### 6.1 Login (`/admin/entrar`)

Objetivo: validar que quem entra é admin autorizado.

Fluxo:

1. Admin abre `/admin/entrar`.
2. Informa o WhatsApp.
3. Sistema normaliza para E.164 e verifica em `admin_users` com `ativo = true`.
4. Se não encontrado, mostra mensagem genérica e **não envia código**.
5. Se encontrado, gera OTP de 6 dígitos, persiste hash em `auth_otps` com `target = 'admin'` e `target_id = admin_users.id`, envia via template Meta "Authentication" para o WhatsApp.
6. Admin informa o código.
7. Sistema valida (hash, não expirado, tentativas < 5), cria sessão admin separada (cookie `qt_admin_session` com claim `is_admin = true`), atualiza `admin_users.ultimo_acesso_em`.
8. Redireciona para `/admin`.

Limites (mesmos da Fase 4A):

- Validade do OTP: 5 minutos.
- Máximo 5 tentativas por código.
- Rate limit: 3 envios por número a cada 15 min, 1 por IP a cada 60s.

Mensagem para telefone não cadastrado como admin:

```text
Não encontramos um administrador com esse número. Acesso restrito.
```

### 6.2 Visão geral (`/admin`)

Objetivo: dar diagnóstico do produto em 5 segundos.

Cards principais:

- **MRR estimado** — soma de `preco_negociado` (fallback `preco_base`) onde `status = 'ativa'`.
- **Oficinas ativas**.
- **Oficinas em teste** — `plano = 'teste'`.
- **Oficinas em risco** — `status = 'pausada'` e `motivo_pausa = 'inadimplencia'`, ou pagamentos vencidos sem cobrança gerada.

Cards secundários:

- **Novas oficinas no mês** — `oficinas.created_at` no mês corrente.
- **Receita recebida no mês** — soma de `pagamentos.valor` onde `status = 'pago'` e `paid_at` no mês.
- **Pagamentos pendentes** — `pagamentos.status = 'pendente'`.
- **Pagamentos falhos no mês** — `pagamentos.status = 'falhou'`.

Bloco **Atividades recentes** (lista enxuta, últimas 20):

- Oficina criada.
- Pagamento confirmado.
- Pagamento falhou.
- Oficina pausada (auto ou manual).
- Plano editado.
- Preço negociado alterado.
- Novo admin convidado.

Estado vazio: "Nenhuma oficina ainda. Cadastre a primeira em **Oficinas → Nova oficina**."

### 6.3 Oficinas — lista (`/admin/oficinas`)

Objetivo: encontrar uma oficina específica ou olhar o conjunto.

Tabela:

| Coluna | Detalhe |
|---|---|
| Nome | `oficinas.nome` |
| WhatsApp | E.164 formatado |
| Cidade | `oficinas.cidade` |
| Status | badge colorido (ativa, pausada, cancelada) |
| Plano | `planos.nome` |
| Preço | `preco_negociado` se existir, senão `preco_base` |
| Próximo vencimento | `oficinas.proximo_vencimento` ou "—" |
| Última atividade | timestamp da última mensagem na conversa |
| Criada em | `oficinas.created_at` |

Filtros:

- Status: ativa, pausada, cancelada, todas.
- Plano: dropdown com planos disponíveis.
- Origem: landing_whatsapp, manual, importacao.
- Motivo de pausa (visível se filtro de status = pausada): inadimplencia, voluntaria, admin.
- Busca livre: nome, WhatsApp, cidade.

Ordenação: criada em (default desc), MRR contribuído desc, última atividade desc.

Paginação: 50 por página.

Botão primário "**Nova oficina**" → abre modal de cadastro manual (ver 6.4).

### 6.4 Nova oficina (modal)

Objetivo: cadastrar oficina captada offline em < 60 segundos.

Campos:

- Nome (obrigatório).
- WhatsApp principal (obrigatório, normalizado para E.164 no submit).
- Cidade (obrigatório).
- Plano (obrigatório, dropdown de `planos` ativos).
- Preço negociado (opcional — fica `NULL` se vazio, usa `preco_base`).
- Status inicial: dropdown com `ativa` (default) ou `teste`.
- Observação (opcional, texto livre — vai para campo `observacao` ou primeira entrada de auditoria).

Validação:

- WhatsApp já existente em oficina ativa → erro "Já existe oficina ativa com esse WhatsApp".
- Plano inativo → erro "Plano selecionado está inativo".

Submit:

- Cria registro com `origem = 'manual'`.
- Define `proximo_vencimento = today + 30 dias` se `status = 'ativa'`.
- Registra em `admin_audit_log` ação `oficina.create_manual` com payload completo.

### 6.5 Oficina — detalhe (`/admin/oficinas/[id]`)

Objetivo: ver tudo que importa de uma oficina sem entrar no Supabase.

**Header**:

- Nome + status (badge).
- WhatsApp principal, cidade.
- Criada em, origem.
- Botões de ação: "Editar status", "Editar plano/preço", "Disparar cobrança manual".

**Bloco Plano e cobrança**:

- Plano atual (link para `/admin/planos`).
- Preço negociado vs preço base (mostra qual está em uso).
- Próximo vencimento.
- Motivo da pausa (se aplicável).

**Bloco Métricas da oficina (últimos 30 dias)**:

- Clientes finais cadastrados.
- Lembretes enviados.
- Retornos concluídos.
- Receita gerada para a oficina (do cliente — não confundir com o que ela paga ao Quando Trocar).

**Bloco Pagamentos** (últimos 6):

- Data, valor, status, link MP.
- Botão "Ver todos" → leva a `/admin/pagamentos?oficina_id=X`.

**Bloco Últimas mensagens** (últimas 10, somente preview):

- Direção (in/out), timestamp, snippet do texto (truncado).
- PII de cliente final mascarada na visualização (ex: nome do cliente final mostrado por inicial + WhatsApp parcialmente ofuscado). Detalhes em 9.2.

**Bloco Auditoria** (últimas 10 entradas relacionadas a esta oficina):

- Quando, admin, ação, diff resumido.

**Ações em modal**:

- "Editar status" → muda entre ativa/pausada/cancelada. Se pausada, pede `motivo_pausa`.
- "Editar plano/preço" → muda `plano_id` e/ou `preco_negociado`.
- "Disparar cobrança manual" → gera preferência MP imediatamente, envia link via WhatsApp.

Toda ação registra em `admin_audit_log`.

### 6.6 Planos (`/admin/planos`)

Objetivo: gerenciar planos disponíveis.

Tabela: nome, preço base, descrição, ativo, oficinas vinculadas (contagem), atualizado em.

Ações:

- "Novo plano" → modal com nome, preço_base, descrição, ativo.
- Editar plano (clicar na linha) → mesmo modal preenchido.
- Desativar plano → `ativo = false`. Bloqueia se há oficinas vinculadas (mostra contagem e exige migrar antes).

Não permite excluir plano fisicamente — só desativar.

### 6.7 Pagamentos (`/admin/pagamentos`)

Objetivo: acompanhar cobrança e estado financeiro.

Tabela:

| Coluna | Detalhe |
|---|---|
| Data | `pagamentos.created_at` |
| Oficina | nome + link para detalhe |
| Valor | numeric |
| Status | pendente, pago, falhou, cancelado |
| Vencimento | `pagamentos.vencimento` |
| Pago em | `paid_at` ou "—" |
| Tentativa | número da tentativa de cobrança |
| MP | link externo para o pagamento no Mercado Pago |

Filtros:

- Status, período (últimos 7d, 30d, 90d, custom), oficina (busca).

Ações por linha:

- "Reenviar link" — reenvia o link de pagamento via WhatsApp.
- "Marcar como cancelado" — só em pagamentos pendentes; registra justificativa em auditoria.

Sem ação de "marcar como pago" manual — pagamento só vira `pago` pelo webhook Mercado Pago.

### 6.8 Admins (`/admin/admins`)

Objetivo: gerenciar quem mais pode acessar.

Tabela: nome, WhatsApp, ativo, último acesso, criado em.

Ações:

- "Convidar admin" → modal com nome e WhatsApp (E.164). Cria registro em `admin_users` com `ativo = true`. Admin convidado entra fazendo OTP normal.
- Toggle "Ativo" — desativar admin imediatamente revoga acesso. Sessões existentes continuam até expiração (TTL 30 dias) — para corte imediato, ver 9.3.

Não permite excluir admin com entradas em `admin_audit_log` — só desativar. Preserva trilha.

### 6.9 Auditoria (`/admin/auditoria`)

Objetivo: rastrear o que foi feito.

Tabela paginada de `admin_audit_log`:

| Coluna | Detalhe |
|---|---|
| Quando | `created_at` |
| Admin | nome + WhatsApp |
| Ação | string semântica (ex: `oficina.update_status`) |
| Entidade | tipo da entidade |
| Entidade ID | UUID com link para detalhe (quando aplicável) |
| IP | inet |

Cada linha expande para mostrar o `payload` (JSON com diff antes/depois) em viewer formatado.

Filtros: admin, entidade, ação, período, busca por `entidade_id`.

Paginação: 50 por página.

---

## 7. Fluxos

### 7.1 Login admin

1. Admin acessa `/admin/entrar`.
2. Informa WhatsApp.
3. Sistema valida em `admin_users` (`ativo = true`).
4. OTP enviado por WhatsApp via template "Authentication".
5. Admin digita código.
6. Sistema cria sessão, redireciona para `/admin`.

### 7.2 Cadastro manual de oficina

1. Admin clica "Nova oficina" em `/admin/oficinas`.
2. Preenche formulário (nome, WhatsApp, cidade, plano, preço, status).
3. Sistema valida (WhatsApp único entre ativas, plano ativo).
4. Cria oficina com `origem = 'manual'`, status escolhido.
5. Se status = `ativa`, define `proximo_vencimento` em 30 dias.
6. Registra em `admin_audit_log`.
7. Redireciona para detalhe da oficina.

### 7.3 Mudança de preço negociado

1. Admin abre detalhe da oficina.
2. Clica "Editar plano/preço".
3. Modal mostra valor atual de `preco_negociado` e `preco_base`.
4. Admin informa novo valor (ou esvazia para usar `preco_base`).
5. Sistema persiste mudança.
6. `admin_audit_log` recebe ação `oficina.update_preco` com `{ before: { preco_negociado: X }, after: { preco_negociado: Y } }`.
7. Próxima cobrança recorrente usa o novo valor automaticamente.

### 7.4 Auto-pausa por inadimplência

Roda no cron diário. Pseudocódigo:

```text
oficinas com status = 'ativa'
  e proximo_vencimento < hoje - INADIMPLENCIA_DIAS_GRACE dias
  e sem pagamento confirmado para o ciclo atual
→
  oficinas.status = 'pausada'
  oficinas.motivo_pausa = 'inadimplencia'
  registra entrada em admin_audit_log com admin_id = NULL e ação 'oficina.auto_pausa_inadimplencia'
  envia mensagem ao WhatsApp da oficina (template Utility) informando suspensão
```

### 7.5 Mensagem ao bot quando oficina está pausada por inadimplência

Quando webhook recebe mensagem de oficina com `status = 'pausada'` e `motivo_pausa = 'inadimplencia'`:

1. [conversation-router.ts](../../lib/whatsapp/conversation-router.ts) detecta o estado.
2. Bot **não** chama agente operacional.
3. Bot responde com mensagem padrão de cobrança:

```text
Seu acesso ao Quando Trocar está suspenso por falta de pagamento. Para reativar, conclua o pagamento no link enviado. Em caso de dúvida, fale com o suporte.
```

4. Registra interação em `agent_tool_calls` para auditoria.

### 7.6 Cobrança recorrente

Cron diário separado da auto-pausa:

```text
oficinas com status = 'ativa'
  e proximo_vencimento entre hoje e hoje + 3 dias
  e sem pagamento pendente já gerado para o ciclo atual
→
  gera pagamento (status = 'pendente', vencimento = oficinas.proximo_vencimento)
  gera preferência Mercado Pago
  envia link via WhatsApp (template ou mensagem livre, conforme janela)
  registra em cobranca_jobs
```

### 7.7 Webhook Mercado Pago

1. MP envia notificação para `/api/webhooks/mercado-pago`.
2. Sistema valida assinatura.
3. Busca pagamento por `mp_payment_id` (UNIQUE — idempotência).
4. Atualiza `pagamentos.status` e `paid_at`.
5. Se `status = 'pago'`:
    - Atualiza `oficinas.proximo_vencimento` para próximo ciclo (mês seguinte).
    - Se oficina estava pausada por inadimplência, reativa (`status = 'ativa'`, `motivo_pausa = NULL`).
6. Registra em `admin_audit_log` com `admin_id = NULL` e ação `pagamento.webhook_confirmado`.

---

## 8. Modelo de dados

Detalhamento abaixo. O schema autoritativo fica nas migrations.

### 8.1 `oficinas` — adições

```sql
alter table oficinas
  add column motivo_pausa text null,
  add column proximo_vencimento date null,
  add constraint oficinas_motivo_pausa_check
    check (motivo_pausa is null or motivo_pausa in ('inadimplencia','voluntaria','admin'));
```

### 8.2 `planos`

```sql
create table planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_base numeric(10,2) not null check (preco_base >= 0),
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.3 `admin_users`

```sql
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null unique
    check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  nome text not null,
  ativo boolean not null default true,
  ultimo_acesso_em timestamptz,
  created_at timestamptz not null default now()
);
```

### 8.4 `admin_audit_log`

```sql
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admin_users(id),  -- null para ações automáticas (cron, webhook)
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  payload jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index admin_audit_log_admin_idx on admin_audit_log(admin_id, created_at desc);
create index admin_audit_log_entidade_idx on admin_audit_log(entidade, entidade_id, created_at desc);
```

### 8.5 `pagamentos`

```sql
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id),
  valor numeric(10,2) not null check (valor > 0),
  status text not null check (status in ('pendente','pago','falhou','cancelado')),
  mp_preference_id text,
  mp_payment_id text unique,
  descricao text,
  vencimento date,
  tentativa int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index pagamentos_oficina_idx on pagamentos(oficina_id, created_at desc);
create index pagamentos_status_idx on pagamentos(status, vencimento);
```

### 8.6 `cobranca_jobs`

```sql
create table cobranca_jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cobranca_proxima','auto_pausa_inadimplencia')),
  executado_em timestamptz not null default now(),
  oficinas_avaliadas int not null default 0,
  preferencias_geradas int not null default 0,
  pausas_aplicadas int not null default 0,
  erros jsonb
);
```

### 8.7 RLS

| Tabela | RLS |
|---|---|
| `planos` | habilitada. Leitura para `authenticated`. Escrita só via service role. |
| `admin_users` | sem RLS. Acesso só via service role. |
| `admin_audit_log` | sem RLS. Acesso só via service role. |
| `pagamentos` | habilitada. Leitura por `oficina_members` da oficina (mesmo padrão das outras tabelas operacionais). |
| `cobranca_jobs` | sem RLS. Acesso só via service role. |

---

## 9. Requisitos não-funcionais

### 9.1 Segurança

- Sessão admin (`qt_admin_session`) **separada** da sessão de oficina. Cookie HTTP-only, SameSite=Lax, Secure em produção. TTL 30 dias com refresh por uso.
- Toda rota `/admin/*` valida sessão admin no servidor antes de renderizar.
- Mutações backend só executam via service role; cliente nunca recebe service role.
- Auditoria obrigatória via helper `withAdminAudit` em toda transação que muda estado.
- Rate limiting de OTP igual ao painel da oficina.

### 9.2 PII no preview de mensagens (tela 6.5)

- Nome do cliente final mostrado como `J*** (inicial + 3 asteriscos)`.
- WhatsApp do cliente final mostrado parcialmente (`+55 11 ****-1234`).
- Texto da mensagem é truncado a 80 caracteres com `...`.
- Detalhe completo da conversa **não** é exposto no MVP (sem entrar como oficina).

### 9.3 Revogação de admin

- Desativar admin (`ativo = false`) impede novos logins.
- Para cortar sessão ativa imediatamente, admin precisa fazer logout ou aguardar expiração (TTL 30 dias).
- Versão futura: lista de sessões ativas com botão "encerrar". Fora do MVP.

### 9.4 Performance

- MRR e métricas globais via SQL em tempo real. Aceitável até ~500 oficinas ativas.
- Listagens com paginação obrigatória.
- Sem materialized views, sem snapshots no MVP.

### 9.5 Internacionalização

- Painel todo em **português brasileiro**.
- Datas formatadas em `dd/mm/aaaa hh:mm`.
- Valores monetários em `R$ X.XXX,XX`.

---

## 10. Métricas exibidas

| Métrica | Definição |
|---|---|
| `mrr_estimado` | Soma de `preco_negociado` (fallback `planos.preco_base`) onde `oficinas.status = 'ativa'`. |
| `oficinas_ativas` | Contagem onde `status = 'ativa'`. |
| `oficinas_em_teste` | Contagem onde `plano = 'teste'`. |
| `oficinas_em_risco` | Contagem onde `status = 'pausada'` e `motivo_pausa = 'inadimplencia'`. |
| `novas_oficinas_mes` | Contagem onde `created_at` está no mês corrente. |
| `receita_recebida_mes` | Soma de `pagamentos.valor` onde `status = 'pago'` e `paid_at` no mês. |
| `pagamentos_pendentes` | Contagem onde `pagamentos.status = 'pendente'`. |
| `pagamentos_falhos_mes` | Contagem onde `pagamentos.status = 'falhou'` e `created_at` no mês. |

---

## 11. Variáveis de ambiente

| Variável | Propósito | Origem |
|---|---|---|
| `INADIMPLENCIA_DIAS_GRACE` | Dias antes de auto-pausar (default 7) | nova |
| `MERCADO_PAGO_ACCESS_TOKEN` | Auth Mercado Pago | [ADR-0008](../adr/0008-pagamento-no-mvp.md) |
| `WHATSAPP_TEMPLATE_OTP_NAME` | Template Meta para OTP | [ADR-0010](../adr/0010-painel-web-no-mvp.md) |
| `WHATSAPP_TEMPLATE_COBRANCA_NAME` | Template Meta categoria Utility para cobrança | nova |
| `INTERNAL_JOB_SECRET` | Auth do consumer interno (cron) | Fase 3 |

---

## 12. Critérios de aceite

- Dado um WhatsApp em `admin_users` com `ativo = true`, quando o admin valida o OTP, então o sistema cria sessão admin separada.
- Dado um WhatsApp **não** cadastrado como admin, o sistema mostra mensagem genérica e não envia OTP.
- Dado um admin autenticado, ele consegue acessar todas as oficinas (bypass RLS via service role).
- Dado uma oficina autenticada no `/painel`, ela **não** consegue acessar `/admin` (sessão de oficina não tem claim de admin).
- Dado um admin alterando o `preco_negociado` de uma oficina, a próxima cobrança recorrente usa o novo valor.
- Dado uma oficina com `proximo_vencimento` há 8 dias e sem pagamento confirmado, o cron de auto-pausa pausa a oficina com `motivo_pausa = 'inadimplencia'`.
- Dado uma oficina pausada por inadimplência mandando mensagem ao bot, o bot responde com mensagem padrão de cobrança e não opera normalmente.
- Dado o recebimento de webhook Mercado Pago com `status = 'approved'` para uma oficina inadimplente, ela é reativada e `proximo_vencimento` avança para o ciclo seguinte.
- Dado dois webhooks Mercado Pago com o mesmo `mp_payment_id`, o segundo é ignorado (idempotência).
- Dado qualquer mutação no painel admin, há entrada correspondente em `admin_audit_log` com `admin_id` do executor.
- Dado uma ação automática do cron, há entrada em `admin_audit_log` com `admin_id = NULL`.
- Dado um admin desativado (`ativo = false`), novos logins são bloqueados.
- Dado um plano com oficinas vinculadas, a desativação é bloqueada.
- Dado um admin abrindo o detalhe de uma oficina, o nome e WhatsApp do cliente final aparecem mascarados no bloco de últimas mensagens.

---

## 13. Fora de escopo (MVP)

- Impersonate (entrar como oficina).
- Edição direta de dados operacionais da oficina (clientes, lembretes, serviços).
- Reembolsos/estornos automáticos via Mercado Pago.
- Exportação CSV / relatórios customizáveis.
- Notificações para admin via WhatsApp ou email.
- Multi-tenant / suporte a agências.
- Plano anual com desconto.
- Múltiplos tiers (Starter/Pro/Business).
- Convites/onboarding via link público para novos admins.
- Conta-corrente da oficina (saldo, créditos, débitos).
- Conciliação com extrato Mercado Pago.

---

## 14. Decisões em aberto

Nenhuma no momento desta versão 1.0. Pontos a reavaliar ao longo da execução:

1. Quando o volume passar de 500 oficinas ativas, reavaliar MRR em tempo real vs snapshot.
2. Quando o time crescer, reavaliar notificações via WhatsApp para admin.
3. Quando o suporte virar gargalo, reavaliar impersonate (com auditoria completa).

---

## 15. Roadmap de execução

Detalhado em [docs/backlog-painel-admin/](../backlog-painel-admin/README.md). Sete sub-fases:

1. **Admin-0**: modelo de dados (migrations + seeds).
2. **Admin-1**: auth (login OTP admin + sessão).
3. **Admin-2**: tela Planos.
4. **Admin-3**: tela Oficinas (lista + detalhe + cadastro manual + edição).
5. **Admin-4**: tela Visão geral (métricas + atividades).
6. **Admin-5**: telas Admins e Auditoria.
7. **Admin-6**: integração Mercado Pago + tela Pagamentos + cron de cobrança e auto-pausa.

Cada sub-fase entrega valor isolado e é mergeavel separadamente.

---

## 16. Referências

- [ADR-0010](../adr/0010-painel-web-no-mvp.md) — Painel da oficina + OTP WhatsApp.
- [ADR-0012](../adr/0012-politica-de-preco.md) — Plano único com preço configurável.
- [ADR-0013](../adr/0013-painel-admin-escopo-billing-auditoria.md) — Escopo, billing e auditoria do painel admin.
- [ADR-0008](../adr/0008-pagamento-no-mvp.md) — Pagamento via Mercado Pago.
- [ADR-0006](../adr/0006-idempotencia-via-provider-ids.md) — Idempotência via provider IDs.
- [Backlog do painel admin](../backlog-painel-admin/README.md).
- [PRD do bot WhatsApp](./PRD-whatsapp-bot.md) (referência cruzada).
- [Backlog Fase 4 do bot](../backlog-whatsapp-bot/fase-4-retorno-dashboard.md) (Fase 4F já antecipava parte deste escopo; esta spec o substitui e expande).
