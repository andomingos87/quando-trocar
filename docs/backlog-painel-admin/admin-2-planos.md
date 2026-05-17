# Admin-2 — Tela Planos

## Objetivo

Implementar CRUD de planos. Valida o padrão "mutação backend + auditoria + UI mínima" que será reusado em todas as sub-fases seguintes.

## Dependências

- Admin-0 (tabela `planos`).
- Admin-1 (sessão admin + helper de auditoria).

## Tarefas

### UI

- [ ] `app/admin/planos/page.tsx` — server component. Lista todos os planos (incluindo inativos).
- [ ] Componente `components/admin/planos-table.tsx` (client) — tabela com colunas: nome, preço base, descrição, ativo, oficinas vinculadas (contagem), atualizado em. Botão de edição por linha.
- [ ] Componente `components/admin/plano-form-modal.tsx` (client) — modal de criar/editar.
- [ ] Botão primário "Novo plano" no topo da página.

### Backend

- [ ] `app/api/admin/planos/route.ts` — `GET` (lista) e `POST` (criar). Ambos validam sessão admin.
- [ ] `app/api/admin/planos/[id]/route.ts` — `PATCH` (editar) e `DELETE` (desativar — não exclui).
- [ ] Toda mutação envolvida em `withAdminAudit`. Payload de auditoria carrega `before` e `after` para `PATCH`.

### Regras

- [ ] Nome obrigatório.
- [ ] `preco_base >= 0`.
- [ ] Não permite desativar plano com oficinas vinculadas (`select count(*) from oficinas where plano_id = X and status != 'cancelada'`).
- [ ] Não permite exclusão física (rota `DELETE` faz `update set ativo = false`).

### Auditoria

- `plano.create` — payload: o registro inteiro.
- `plano.update` — payload: `{ before, after }`.
- `plano.deactivate` — payload: id e contagem de oficinas vinculadas no momento.

## Critérios de aceite

- Admin lista todos os planos ordenados por `created_at desc`.
- Admin cria plano novo via modal. Novo plano aparece na lista.
- Admin edita preço base e descrição. Mudança aparece e gera entrada `plano.update`.
- Admin tenta desativar plano com 3 oficinas ativas vinculadas → erro com contagem.
- Admin desativa plano sem oficinas vinculadas → `ativo = false` e entrada `plano.deactivate`.
- Coluna "Oficinas vinculadas" reflete a contagem real.

## Testes

- [ ] Teste de rota: `POST /api/admin/planos` valida sessão admin.
- [ ] Teste de rota: `POST` sem sessão → 401.
- [ ] Teste de rota: `PATCH` cria entrada em `admin_audit_log` com diff correto.
- [ ] Teste de regra: desativar plano com oficinas vinculadas → erro.
- [ ] Teste de regra: `preco_base` negativo → erro.

## Riscos

- **Editar `preco_base` afeta oficinas que não têm `preco_negociado`** sem aviso explícito. Mitigação: modal mostra contagem de oficinas que serão afetadas antes de confirmar.
