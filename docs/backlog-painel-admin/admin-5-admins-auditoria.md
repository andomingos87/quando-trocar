# Admin-5 — Telas Admins e Auditoria

## Objetivo

Governança do painel: gerenciar quem é admin e ver o que cada um (e o sistema) fez.

## Dependências

- Admin-0 (tabelas `admin_users` e `admin_audit_log`).
- Admin-1 (sessão admin + helper).

## Tarefas

### Tela Admins (`/admin/admins`)

- [ ] `app/admin/admins/page.tsx` — server component lista todos os admins.
- [ ] Componente `components/admin/admins-table.tsx`: colunas nome, WhatsApp, ativo, último acesso, criado em.
- [ ] Botão "Convidar admin" abre modal.
- [ ] Toggle "Ativo" por linha → confirma → desativa/ativa imediatamente.
- [ ] `app/api/admin/admins/route.ts` — `POST` cria novo admin (nome + WhatsApp E.164, `ativo = true`).
- [ ] `app/api/admin/admins/[id]/route.ts` — `PATCH` muda `ativo`.
- [ ] Toda mutação via `withAdminAudit`: ações `admin.invite`, `admin.activate`, `admin.deactivate`.
- [ ] **Não permite excluir** admin com entradas em `admin_audit_log` — só desativar. Endpoint `DELETE` retorna 409 com explicação.
- [ ] **Não permite desativar a si mesmo** — protege contra erro fatal (admin se trancando fora). Verifica `admin_id != session.admin_id` antes do update.

### Tela Auditoria (`/admin/auditoria`)

- [ ] `app/admin/auditoria/page.tsx` — server component com paginação.
- [ ] Aceita query params: `admin_id`, `entidade`, `acao`, `data_inicio`, `data_fim`, `entidade_id`, `page`.
- [ ] Componente `components/admin/auditoria-table.tsx`: colunas quando, admin (ou "Sistema"), ação, entidade, entidade ID, IP. Cada linha expande para mostrar `payload` em viewer formatado.
- [ ] Componente `components/admin/auditoria-filters.tsx`.
- [ ] Componente `components/admin/payload-viewer.tsx` — JSON com diff antes/depois colorido quando o payload tem chaves `before` e `after`.

### Helper

- [ ] `lib/admin/audit-queries.ts` exporta `listAuditEntries(filters, page)` retornando lista + total.

## Critérios de aceite

- Lista de admins exibe Anderson + qualquer convidado, com último acesso.
- Convite cria admin pelo painel. Próximo OTP do convidado funciona.
- Desativar admin bloqueia novos logins.
- Tentativa de desativar a si mesmo → erro claro.
- Tentativa de excluir admin com auditoria → 409 com mensagem orientando desativar.
- Auditoria mostra entradas com filtros combinados.
- Payload com `{before, after}` é exibido como diff visual.
- Ações automáticas (`admin_id = NULL`) aparecem como "Sistema".

## Testes

- [ ] Teste de rota `POST /api/admin/admins` valida E.164.
- [ ] Teste de rota: WhatsApp duplicado → erro.
- [ ] Teste de rota: admin tenta desativar a si mesmo → erro.
- [ ] Teste de rota: `DELETE` em admin com auditoria → 409.
- [ ] Teste de filtros combinados na listagem.
- [ ] Teste de paginação.

## Riscos

- **Admin se trancando fora**: protegido pela regra "não pode desativar a si mesmo". Adicionar teste explícito.
- **Auditoria virando ruidosa**: cada operação gera entrada. Manter ações com nomes semanticamente úteis para filtrar. Reavaliar retenção quando passar de 1M de entradas.
