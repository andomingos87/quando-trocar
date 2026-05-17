# ADR 0013: Painel admin — escopo, billing mensal recorrente e auditoria

- **Status**: accepted
- **Data**: 2026-05-17
- **Decisores**: Anderson Domingos
- **Fonte**: conversa de planejamento do painel admin (2026-05-17), [ADR-0010](./0010-painel-web-no-mvp.md), [ADR-0012](./0012-politica-de-preco.md)

## Contexto

[ADR-0012](./0012-politica-de-preco.md) decidiu que o produto terá um plano único com preço variável por oficina, gerido por administradores via painel separado. [ADR-0010](./0010-painel-web-no-mvp.md) decidiu que o login do painel da oficina é passwordless via OTP WhatsApp e que o painel admin reusa o mesmo fluxo.

O que ainda não estava decidido:

- Escopo concreto do painel admin no MVP (quais telas, quais ações, com qual nível de profundidade).
- Onde o painel admin é hospedado (URL e cookie).
- Como tratar oficinas que pararam de pagar — estado, automação e comunicação.
- Como o Mercado Pago opera no modelo de plano mensal recorrente.
- Como calcular MRR e métricas globais com o volume esperado no MVP.
- Quando o preço negociado expira.
- Se o admin pode cadastrar oficinas manualmente ou se toda oficina nasce pelo bot vendedor.
- Se o admin pode entrar como uma oficina (impersonate).
- Como notificar administradores sobre eventos importantes.

Esta ADR fecha esses pontos.

## Decisão

### Localização e auth

- **URL**: `/admin/*` na mesma aplicação Next.js do painel da oficina (mesmo domínio, mesmo deploy).
- **Auth**: reusa o fluxo OTP WhatsApp da [ADR-0010](./0010-painel-web-no-mvp.md), mas resolvido contra `admin_users` (não `oficinas`). Sessão admin é cookie separado da sessão de oficina (claim/escopo distinto) para impedir confusão de contextos.
- **Bloqueio**: telefone não cadastrado em `admin_users` com `ativo = true` recebe mensagem genérica e não tem OTP enviado.

### Escopo das telas (MVP)

Sete telas:

1. **Login** (`/admin/entrar`).
2. **Visão geral** (`/admin`) — métricas globais e atividades recentes.
3. **Oficinas** (`/admin/oficinas`) — lista, filtros, busca.
4. **Detalhe da oficina** (`/admin/oficinas/[id]`) — métricas da oficina, edição de plano, preço, status; lista enxuta de últimas mensagens e pagamentos.
5. **Planos** (`/admin/planos`) — CRUD enxuto.
6. **Pagamentos** (`/admin/pagamentos`) — lista, status, link MP.
7. **Admins** (`/admin/admins`) e **Auditoria** (`/admin/auditoria`) — governança.

Fora do MVP: impersonate (entrar como oficina), edição direta de dados operacionais da oficina (clientes, lembretes, serviços), relatórios customizáveis, multi-tenant/agências, módulo de suporte.

### Cadastro manual de oficinas

- Admin pode criar oficina pelo painel com formulário completo (nome, WhatsApp, cidade, plano, preço negociado).
- Oficina criada manualmente fica com `origem = 'manual'` (campo já existente no schema).
- Cadastro manual pula o fluxo do bot vendedor — útil para captação offline, eventos e indicações.

### Status de oficina e inadimplência

- **Mantém o enum atual** `oficinas.status in ('ativa', 'pausada', 'cancelada')`. Sem novo status.
- **Novo campo** `oficinas.motivo_pausa text NULL` com valores válidos: `inadimplencia`, `voluntaria`, `admin`. Só faz sentido quando `status = 'pausada'`.
- **Auto-pausa por inadimplência**: cron diário pausa oficinas com pagamento vencido há `INADIMPLENCIA_DIAS_GRACE` dias (default 7, configurável via env), setando `motivo_pausa = 'inadimplencia'`.
- **Comportamento do bot** quando oficina está pausada por inadimplência: bot não opera normalmente. Responde com mensagem padrão de cobrança (a definir no prompt). Pequena alteração no [conversation-router.ts](../../lib/whatsapp/conversation-router.ts).

### Billing mensal recorrente

- **Ciclo**: mensal único, sem opção anual no MVP.
- **Mecânica**: cron Supabase diário que gera preferência de pagamento Mercado Pago para oficinas com vencimento em D-3 e envia o link via WhatsApp. **Não usa** Mercado Pago Subscriptions (cartão salvo) — gera preferência avulsa a cada ciclo. Razão: suportar Pix recorrente sem onboarding de cartão.
- **Preço negociado**: `oficinas.preco_negociado` sem data de expiração. Vale até admin editar ou zerar. Quando `NULL`, usa `planos.preco_base`. Risco de promo virar permanente é aceito (admin pode editar a qualquer momento).
- **Idempotência**: webhook Mercado Pago usa `mp_payment_id` UNIQUE conforme [ADR-0006](./0006-idempotencia-via-provider-ids.md).
- **Vencimento próximo**: `oficinas.proximo_vencimento date NULL` indica a data alvo da próxima cobrança. Inicializado quando a oficina ativa o plano pago.

### Métricas e MRR

- **Em tempo real**: a tela `Visão geral` soma `oficinas.preco_negociado` (fallback `planos.preco_base`) onde `status = 'ativa'` direto no Postgres a cada carregamento. Sem snapshot, sem cache.
- **Limite**: revisitar quando passar de ~500 oficinas ativas. Aceitável até lá.

### Notificações para admin

- **Só na tela** no MVP. Bloco "Atividades recentes" no `/admin` mostra novas oficinas, pagamentos confirmados, falhas, mudanças de status. Sem WhatsApp ou email para admin.

### Auditoria

- Toda mutação no painel admin registra em `admin_audit_log` (admin_id, ação, entidade, entidade_id, payload com diff antes/depois, ip, created_at).
- Helper backend `withAdminAudit(adminId, acao, entidade, entidadeId, payload, fn)` envolve a transação.
- `admin_users` não permite exclusão de admin que tem entradas em `admin_audit_log` — só `ativo = false`. Preserva trilha.

### Seeds iniciais

- 1 admin (Anderson — WhatsApp confirmado antes da migration rodar).
- 1 plano placeholder "Quando Trocar Mensal" com `preco_base` placeholder editável pelo próprio painel.

## Alternativas consideradas

- **Subdomínio `admin.quandotrocar.com.br`** — descartado. Custo extra de DNS e configuração Vercel não compensa o benefício de isolamento adicional de cookies. `/admin` no mesmo domínio + cookie de sessão separado já isola bem.
- **Adicionar status `suspensa` separado de `pausada`** — descartado. Manter o enum atual e usar `motivo_pausa` evita migration mais invasiva e permite expressar a mesma semântica.
- **Mercado Pago Subscriptions (cartão salvo)** — descartado. Não suporta Pix recorrente nativo; exige onboarding de cartão que adiciona atrito no segmento (oficinas de bairro).
- **MRR via snapshot diário em `metrics_daily`** — descartado para o MVP. Adiciona infra sem ganho real até cruzar 500 oficinas.
- **Notificações via WhatsApp para admin** — descartado. Exige template novo e adiciona ruído sem necessidade comprovada.
- **Impersonate no MVP** — descartado. Aumenta superfície de risco e complexidade de auditoria sem demanda comprovada. Para suporte profundo, admin acessa Supabase diretamente. Reabrir em V2 se virar gargalo.

## Consequências

### Positivas

- Painel admin construível em sub-fases pequenas (Admin-0 a Admin-6), cada uma mergeavel separadamente.
- Reuso do fluxo OTP WhatsApp da Fase 4A — sem auth nova para construir.
- Auto-pausa por inadimplência reduz trabalho manual e protege receita.
- Cron diário de cobrança desacopla geração de link de pagamento do momento da resposta da oficina.
- `motivo_pausa` permite reportar churn voluntário versus inadimplência sem dor de migration.
- MRR em tempo real elimina infra de snapshot enquanto o volume é pequeno.

### Negativas / trade-offs

- Sessão admin separada exige cuidado para não vazar entre `/admin` e `/painel` (mesmo domínio, cookies distintos).
- Sem impersonate, suporte profundo a uma oficina específica precisa acessar Supabase. Aceitável enquanto o número de oficinas é pequeno.
- Preço negociado sem expiração corre risco de virar permanente se admin esquecer. Aceito.
- Notificação só na tela exige que admin abra o painel para ver problemas. Tolerável com poucos admins ativos.
- Cron diário introduz um job recorrente novo — mais um ponto de falha a monitorar.
- Bot precisa consultar `oficinas.status` e `motivo_pausa` antes de operar — pequeno custo por mensagem, mas obrigatório.

## Mudanças necessárias no modelo de dados

- `oficinas`: adicionar `motivo_pausa text NULL` (check `in ('inadimplencia','voluntaria','admin')` quando não nulo) e `proximo_vencimento date NULL`.
- Tabela `planos`: já especificada em [ADR-0012](./0012-politica-de-preco.md).
- Tabela `admin_users`: já especificada em [ADR-0012](./0012-politica-de-preco.md). Adicionar `ultimo_acesso_em timestamptz NULL`.
- Tabela `admin_audit_log`: já especificada em [ADR-0012](./0012-politica-de-preco.md). Adicionar `ip inet NULL`.
- Tabela `pagamentos`: já especificada na Fase 4G. Adicionar `vencimento date` e `tentativa int default 1`.
- Tabela nova `cobranca_jobs`: registra execuções do cron para auditoria (id, executado_em, oficinas_avaliadas, preferencias_geradas, pausas_aplicadas, erros). Necessária para diagnóstico sem depender de logs efêmeros.

## Variáveis de ambiente novas

- `INADIMPLENCIA_DIAS_GRACE` — dias de tolerância antes de pausar automaticamente (default 7).
- `MERCADO_PAGO_ACCESS_TOKEN` — já previsto em [ADR-0008](./0008-pagamento-no-mvp.md).
- `WHATSAPP_TEMPLATE_COBRANCA_NAME` — template Meta categoria "Utility" para aviso de cobrança/vencimento. Cadastrar com antecedência.
- `WHATSAPP_TEMPLATE_OTP_NAME` — já previsto em [ADR-0010](./0010-painel-web-no-mvp.md). Reusado pelo login admin.

## Referências

- [ADR-0008](./0008-pagamento-no-mvp.md) — Pagamento via Mercado Pago.
- [ADR-0010](./0010-painel-web-no-mvp.md) — Painel da oficina + OTP WhatsApp.
- [ADR-0012](./0012-politica-de-preco.md) — Plano único com preço configurável.
- [ADR-0006](./0006-idempotencia-via-provider-ids.md) — Idempotência via provider IDs.
- `docs/product/PRD-painel-admin.md` (criado junto com esta ADR).
- `docs/backlog-painel-admin/` (criado junto com esta ADR).
