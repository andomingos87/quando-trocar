# Admin-0 — Modelo de dados

## Objetivo

Criar todas as tabelas, índices, constraints e seeds que destravam o painel admin. Nenhuma UI ainda. Ao final desta sub-fase, o schema suporta todas as outras sub-fases sem nova migration de breaking change.

## Dependências

- Fase 2 do bot WhatsApp concluída (tabela `oficinas` com `origem`, `status`, `plano`).
- WhatsApp do Anderson em E.164 para o seed: **`+5511945207618`** (confirmado 2026-05-17).

## Tarefas

### Schema

- [ ] Migration `phase_admin_0_painel_admin_base.sql` contendo:
  - [ ] `alter table oficinas add column motivo_pausa text null` + check constraint `oficinas_motivo_pausa_check` para valores `inadimplencia | voluntaria | admin`.
  - [ ] `alter table oficinas add column proximo_vencimento date null`.
  - [ ] `create table planos` com campos do PRD §8.2.
  - [ ] `create table admin_users` com campos do PRD §8.3 (incluindo unique em `whatsapp` e check de E.164).
  - [ ] `create table admin_audit_log` com campos do PRD §8.4 + índices.
  - [ ] `create table pagamentos` com campos do PRD §8.5 + `mp_payment_id` UNIQUE + índices.
  - [ ] `create table cobranca_jobs` do PRD §8.6.
  - [ ] `alter table oficinas add column plano_id uuid null references planos(id)` — FK para o plano contratado.
  - [ ] `alter table oficinas add column preco_negociado numeric(10,2) null`.

### Seeds

- [ ] Inserir 1 admin: nome `Anderson Domingos`, WhatsApp `+5511945207618`, `ativo = true`.
- [ ] Inserir 1 plano placeholder: `nome = 'Quando Trocar Mensal'`, `preco_base = 0` (admin ajusta depois), `descricao = 'Plano único do MVP. Preço configurado por oficina.'`, `ativo = true`.
- [ ] Para cada oficina existente, definir `plano_id` apontando para o plano placeholder.

### RLS

- [ ] `planos`: enable RLS. Policy `select` para `authenticated`. Sem policy de write.
- [ ] `admin_users`: enable RLS. Sem policies (acesso só via service role).
- [ ] `admin_audit_log`: enable RLS. Sem policies.
- [ ] `pagamentos`: enable RLS. Policy `select` baseada em `oficina_members` (mesmo padrão das outras tabelas operacionais).
- [ ] `cobranca_jobs`: enable RLS. Sem policies.

### Tipos TypeScript

- [ ] Rodar `supabase gen types typescript` ou equivalente para regenerar tipos.
- [ ] Atualizar [lib/whatsapp/types.ts](../../lib/whatsapp/types.ts) ou criar `lib/admin/types.ts` com tipos de domínio do painel admin (não derivados dos tipos do banco).

## Critérios de aceite

- Migration aplica sem erro em ambiente limpo.
- Migration aplica sem erro sobre o schema atual com dados existentes.
- Seed deixa 1 admin e 1 plano cadastrados.
- Todas as oficinas existentes têm `plano_id` apontando para o plano placeholder.
- `psql` query `select count(*) from planos where ativo` retorna ≥ 1.
- RLS confirmada via teste: cliente anônimo não lê `admin_users`.

## Testes

- [ ] Teste de integração: aplicar migration em DB limpo, rodar seed, validar contagens.
- [ ] Teste de RLS: verificar que `anon` e `authenticated` não conseguem ler `admin_users` nem `admin_audit_log`.
- [ ] Teste de check constraint: insert em `oficinas` com `motivo_pausa = 'foo'` deve falhar.

## Riscos

- **Schema drift**: se a Fase 2 do bot mudou recentemente, garantir que `oficinas` tem todas as colunas esperadas antes do `alter table`.
- **Seed com WhatsApp errado**: bloqueia o primeiro login admin. Confirmar número antes de rodar a migration em produção.
- **Plano placeholder com preço 0**: se o cron de cobrança rodar antes de o admin editar, gera preferência MP com R$ 0. Mitigação: cron pula oficinas com `preco_efetivo = 0`.
