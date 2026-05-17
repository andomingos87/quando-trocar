# Runbook · Migrations do Supabase

## Quando usar

- Adicionar ou alterar tabela, coluna, índice ou constraint.
- Criar ou alterar policy de RLS.
- Criar função, trigger, view ou enum.
- Configurar ou alterar `pgmq` (filas) ou `pg_cron` (agendamentos).

## O que você vai precisar antes

- Supabase CLI instalado (`brew install supabase/tap/supabase`).
- Projeto Supabase linkado: `supabase link --project-ref <REF>`.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` configuradas em `.env.local` ([env-setup](./env-setup.md)).
- Acesso ao painel do Supabase para validar o resultado.

## Fluxo padrão

### 1. Criar a migration

```bash
supabase migration new descricao_curta_da_mudanca
```

Isso cria um arquivo em `supabase/migrations/AAAAMMDDHHMMSS_descricao_curta_da_mudanca.sql`. O timestamp garante a ordem.

Convenção do projeto: nome em snake_case, com prefixo da fase quando aplicável:

```text
phase_3_real_reminders.sql
phase_3_reminder_queue_fixes.sql
add_whatsapp_event_processing_errors.sql
```

### 2. Escrever a SQL

Princípios:

- **Idempotente quando possível** — `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` (Postgres 9.6+).
- **RLS ativado** para qualquer tabela exposta a usuários autenticados. Ver [ADR-0003](../adr/0003-multi-tenancy-via-rls-oficina-id.md).
- **Unique index** em provider IDs e business keys, não checagem em código. Ver [ADR-0006](../adr/0006-idempotencia-via-provider-ids.md).
- **`oficina_id` indexada** em qualquer tabela multi-tenant.
- **Service role bypass RLS** — código com service role precisa validar `oficina_id` manualmente.

### 3. Revisão de RLS antes de aplicar

Antes de aplicar uma migration que toca tabela com RLS, rode o checklist do prompt `.codex/prompts/supabase-rls-review.md`. Em síntese:

- Tabela tem `RLS ENABLED`?
- Policy de `SELECT`, `INSERT`, `UPDATE`, `DELETE` correta para o usuário autenticado?
- Coluna `oficina_id` indexada?
- Service role tem o caminho previsto (geralmente sem policy, bypassa RLS)?
- Quebra alguma policy existente em tabela relacionada?

### 4. Aplicar localmente (opcional)

Se você tem Supabase rodando local:

```bash
supabase db reset    # roda todas migrations do zero
# ou
supabase migration up
```

### 5. Aplicar em produção

```bash
supabase db push
```

Confirme no painel Supabase (Database > Tables ou SQL Editor) que o schema mudou conforme esperado.

### 6. Atualizar tipos TypeScript (se aplicável)

Se houver geração automática de tipos no projeto, regerar. Hoje o projeto usa tipos manuais em `lib/whatsapp/types.ts` (ver `AGENTS.md §Code Style`) — atualize lá se mudou contrato relevante.

### 7. Rodar tests

```bash
npm test
```

Especialmente os testes que tocam parsing, repository writes, RLS — ver `AGENTS.md §Testing Instructions`.

### 8. Commit

```bash
git add supabase/migrations/AAAAMMDDHHMMSS_descricao_curta.sql
git commit -m "db: add <coisa> (phase X)"
```

## Rollback

Postgres não tem "rollback de migration" nativo no Supabase CLI. Caminhos:

- **Forward fix** (preferido) — Crie uma nova migration que desfaz a anterior. Isso preserva o histórico linear.
- **Manual no painel** — Se estiver em desenvolvimento e ainda não foi aplicado em produção, edite a migration ou rode `supabase db reset` localmente.
- **Restore de backup** — Em produção, último recurso. Supabase tem PITR (point-in-time recovery) nos planos pagos.

## Como verificar que funcionou

1. Tabela / coluna / index visível no painel Supabase.
2. Policies de RLS aparecem em `Authentication > Policies`.
3. Query manual no SQL Editor retorna o esperado.
4. `npm test` passa.
5. Build do Next.js não quebra (`npm run build`) se a migration afeta tipos.

## Problemas comuns

### "permission denied for table X"

Faltou policy de RLS para o role autenticado. Adicione ou ajuste.

### "duplicate key violates unique constraint"

A migration tentou inserir/recriar algo que já existe. Use `IF NOT EXISTS` ou `CREATE OR REPLACE`.

### Migration aplicada mas tipos TS quebraram

Atualize manualmente `lib/whatsapp/types.ts` ou o local equivalente.

### Função / trigger não encontrada após `db push`

Pode haver dependência (função usa enum não criado, trigger usa coluna não adicionada). Verifique ordem dentro do arquivo SQL.

### RLS bloqueando query que deveria funcionar

Use service role apenas server-side; cliente browser sempre usa anon key. Se o anon precisa ler, falta policy.

## Referências

- `supabase/migrations/` — migrations existentes (boas referências de estilo).
- `.codex/prompts/supabase-rls-review.md` — checklist de revisão.
- [ADR-0003](../adr/0003-multi-tenancy-via-rls-oficina-id.md) — RLS por `oficina_id`.
- [ADR-0006](../adr/0006-idempotencia-via-provider-ids.md) — Idempotência via unique.
- `AGENTS.md §Supabase Rules`
