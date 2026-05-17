# ADR 0003: Multi-tenancy via RLS por `oficina_id`

- **Status**: accepted
- **Data**: 2026-04-25
- **Decisores**: time Quando Trocar
- **Fonte**: `AGENTS.md §Supabase Rules`, `docs/product/PRD-whatsapp-bot.md §20`

## Contexto

O produto é multi-tenant: cada oficina tem seus próprios clientes finais, lembretes, conversas e dados de receita. Vazar dado entre oficinas é vazamento de cliente concorrente — quebra confiança imediata e tem implicações de compliance.

Stack já decidida: Supabase Postgres + Supabase Auth. Padrão da plataforma é Row Level Security (RLS) por usuário/tenant.

A pergunta: como garantir isolamento entre oficinas sem depender de checagem manual em cada query?

## Decisão

Multi-tenancy via **Row Level Security do Postgres**, escopada por `oficina_id`. Toda tabela de dados de oficina tem coluna `oficina_id` e policy de RLS que filtra acessos do usuário autenticado por essa coluna.

A `SUPABASE_SERVICE_ROLE_KEY` é usada **apenas server-side** (rotas API, workers, scheduler) para operações que precisam atravessar tenants (criar lead, processar webhook). Cliente browser nunca recebe service role key.

## Alternativas consideradas

- **Schema por tenant** — Cada oficina num schema Postgres separado. Descartado: complexidade operacional (migrations × N tenants), provisionamento manual, queries cross-tenant difíceis.
- **Banco por tenant** — Pior ainda — custo de infraestrutura linear no número de oficinas.
- **Checagem manual de `oficina_id` em cada query** — Funciona mas é frágil. Qualquer endpoint que esquece a checagem vira vazamento. Descartado: RLS dá a mesma garantia com menos risco humano.
- **RLS por `oficina_id`** — Escolhido. Postgres garante o filtro mesmo se o backend esquecer.

## Consequências

### Positivas

- Vazamento entre oficinas exige derrotar o Postgres, não só esquecer um `WHERE`.
- Modelo de permissão fica explícito em policies (auditáveis em migration).
- Compatível com Supabase Auth nativo (`auth.uid()` na policy).

### Negativas / trade-offs

- Service role bypass RLS — qualquer código com a chave precisa validar `oficina_id` manualmente. Disciplina obrigatória.
- Queries com joins precisam considerar RLS de todas as tabelas envolvidas.
- Debugging mais difícil — query que "deveria funcionar" pode retornar vazio por policy mal escrita.
- Performance: RLS adiciona filtro implícito em toda query; indexar `oficina_id` sempre.

## Referências

- `AGENTS.md §Supabase Rules`
- `docs/product/PRD-whatsapp-bot.md §20` (Requisitos Não Funcionais — Segurança)
- `docs/architecture/whatsapp-bot-technical-plan.md`
- `supabase/migrations/`
- `.codex/prompts/supabase-rls-review.md`
