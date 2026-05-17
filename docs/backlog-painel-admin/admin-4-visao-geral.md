# Admin-4 — Tela Visão geral

## Objetivo

Dashboard inicial do painel admin com métricas globais (MRR, oficinas, pagamentos) e atividades recentes.

## Dependências

- Admin-0 (todas as tabelas).
- Admin-1 (sessão).
- Admin-3 (dados de oficinas populados — opcional, mas torna o dashboard menos vazio).

## Tarefas

### UI

- [ ] `app/admin/page.tsx` — server component. Default landing após login.
- [ ] Componente `components/admin/dashboard-cards.tsx` — grid de cards com métricas principais e secundárias (PRD §6.2 e §10).
- [ ] Componente `components/admin/atividades-recentes.tsx` — lista das últimas 20 entradas de `admin_audit_log` (incluindo ações automáticas com `admin_id = NULL`).
- [ ] Estado vazio: mensagem orientando cadastrar primeira oficina.

### Queries

- [ ] `lib/admin/metrics.ts` exporta:
  - `getMrrEstimado(): Promise<number>`
  - `getOficinasCounts(): Promise<{ ativas, em_teste, em_risco }>`
  - `getNovasOficinasMes(): Promise<number>`
  - `getReceitaRecebidaMes(): Promise<number>`
  - `getPagamentosPendentes(): Promise<number>`
  - `getPagamentosFalhosMes(): Promise<number>`
  - `getAtividadesRecentes(limit: number): Promise<AtividadeView[]>`
- [ ] Todas executam queries SQL diretas via service role. Sem RPC, sem materialized view no MVP.
- [ ] `AtividadeView` é tipo enriquecido: junta `admin_audit_log` com nome do admin (ou "Sistema" quando `admin_id = NULL`).

### Formatação

- [ ] Helper `lib/admin/format.ts` para `formatBRL`, `formatDate`, `formatRelativeTime`.
- [ ] Valores monetários sempre em `R$`.
- [ ] Datas em `dd/mm/aaaa hh:mm` (zone Brasília).

### Performance

- [ ] Cache de página: `revalidate = 30` (segundos). Dashboard não precisa ser milissegundo-fresh.
- [ ] Cada query do `metrics.ts` é independente — usar `Promise.all` no server component.

## Critérios de aceite

- Dashboard carrega em < 2s com até 500 oficinas.
- `mrr_estimado` confere com cálculo manual (soma de `coalesce(preco_negociado, planos.preco_base)` onde status = ativa).
- Card "Oficinas em risco" mostra contagem correta.
- Atividades recentes mostra ações de admin e ações automáticas (`admin_id = NULL` → label "Sistema").
- Estado vazio: dashboard sem nenhuma oficina mostra CTA para cadastrar.

## Testes

- [ ] Teste unitário de cada função em `lib/admin/metrics.ts`.
- [ ] Teste com cenário: 5 oficinas ativas com preços variados → MRR correto.
- [ ] Teste de fallback: oficina sem `preco_negociado` usa `planos.preco_base`.
- [ ] Teste de atividades: entrada com `admin_id = NULL` é exibida como "Sistema".

## Riscos

- **MRR errado**: bug aqui é visível e dói. Manter cobertura de teste forte em `getMrrEstimado`.
- **Atividades recentes lentas**: se `admin_audit_log` crescer muito, query sem índice fica lenta. Garantir índice por `created_at desc` (já em Admin-0).
- **Hora do servidor vs hora do usuário**: Brasil tem 1 fuso só (oficial). Confirmar que datas formatadas usam `America/Sao_Paulo`, não UTC.
