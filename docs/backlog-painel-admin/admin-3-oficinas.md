# Admin-3 — Telas Oficinas (lista + detalhe + cadastro manual)

## Objetivo

Coração do painel admin. Permitir busca, filtro, criação manual e edição de oficinas (status, plano, preço negociado).

## Dependências

- Admin-0 (`oficinas` com `motivo_pausa`, `proximo_vencimento`, `plano_id`, `preco_negociado`).
- Admin-1 (sessão + auditoria).
- Admin-2 (planos disponíveis para vincular).

## Tarefas

### Tela lista (`/admin/oficinas`)

- [ ] `app/admin/oficinas/page.tsx` — server component que aceita query params `status`, `plano_id`, `origem`, `motivo_pausa`, `busca`, `page`.
- [ ] Componente `components/admin/oficinas-table.tsx` com colunas conforme PRD §6.3.
- [ ] Componente `components/admin/oficinas-filters.tsx` — filtros e busca.
- [ ] Coluna "Preço" exibe `preco_negociado` (com badge "negociado") ou `preco_base` (badge "padrão").
- [ ] Coluna "Última atividade" deriva da `max(mensagens.created_at)` da oficina.
- [ ] Paginação server-side (50 por página).
- [ ] Botão primário "Nova oficina" abre modal.

### Cadastro manual (modal em `/admin/oficinas`)

- [ ] Componente `components/admin/oficina-create-modal.tsx`.
- [ ] Campos do PRD §6.4.
- [ ] Validação client + server.
- [ ] `app/api/admin/oficinas/route.ts` — `POST`:
  - Valida WhatsApp único entre oficinas não-canceladas.
  - Valida plano ativo.
  - Normaliza WhatsApp para E.164.
  - Cria com `origem = 'manual'`.
  - Se `status = 'ativa'`, define `proximo_vencimento = current_date + 30`.
  - `withAdminAudit`: ação `oficina.create_manual`.

### Tela detalhe (`/admin/oficinas/[id]`)

- [ ] `app/admin/oficinas/[id]/page.tsx` — server component.
- [ ] Header com nome, status, WhatsApp, cidade, criada em, origem (PRD §6.5).
- [ ] Bloco "Plano e cobrança" com plano, preço efetivo, próximo vencimento, motivo de pausa (se houver).
- [ ] Bloco "Métricas (30d)": clientes finais, lembretes enviados, retornos concluídos, receita gerada para a oficina.
- [ ] Bloco "Pagamentos" — últimos 6, link "Ver todos".
- [ ] Bloco "Últimas mensagens" com PII mascarada (PRD §9.2).
- [ ] Bloco "Auditoria" — últimas 10 entradas com `entidade = 'oficina'` e `entidade_id = id`.

### Ações no detalhe

- [ ] Modal "Editar status" — escolhe entre `ativa`, `pausada`, `cancelada`. Se `pausada`, exige `motivo_pausa`. Se reativando, limpa `motivo_pausa`.
- [ ] Modal "Editar plano/preço" — muda `plano_id` e/ou `preco_negociado` (campo vazio = `NULL`).
- [ ] Botão "Disparar cobrança manual" — só visível se Admin-6 já estiver em produção (feature flag). Senão escondido.

### Backend de mutações

- [ ] `app/api/admin/oficinas/[id]/route.ts` — `PATCH` aceita campos `status`, `motivo_pausa`, `plano_id`, `preco_negociado`. Toda mudança via `withAdminAudit`. Ações distintas:
  - `oficina.update_status`
  - `oficina.update_plano`
  - `oficina.update_preco`
- [ ] Validação: `motivo_pausa` só não-nulo quando `status = 'pausada'`. Status `cancelada` não aceita ser revertido por esta tela.

### Helpers de query

- [ ] `lib/admin/oficinas-queries.ts` com queries server-side: listagem paginada, contagens, métricas da oficina, últimas mensagens com PII mascarada.

## Critérios de aceite

- Admin lista oficinas com paginação. Filtros funcionam combinados.
- Busca por nome, WhatsApp e cidade retorna resultados corretos.
- Admin cria oficina manual. `origem = 'manual'` e `proximo_vencimento` setado em D+30.
- Admin tenta cadastrar com WhatsApp já em oficina ativa → erro claro.
- Admin abre detalhe de uma oficina e vê todos os blocos preenchidos.
- Admin muda status para `pausada` sem `motivo_pausa` → erro.
- Admin muda preço negociado. Entrada `oficina.update_preco` registrada com diff.
- Bloco "Últimas mensagens" não mostra texto integral nem dados sensíveis de cliente final.
- Oficina autenticada no `/painel` tentando acessar `/admin/oficinas/[id]` → bloqueio (middleware admin).

## Testes

- [ ] Teste de rota `POST /api/admin/oficinas` com WhatsApp duplicado → erro.
- [ ] Teste de rota `POST` com plano inativo → erro.
- [ ] Teste de criação manual seta `origem = 'manual'` e `proximo_vencimento`.
- [ ] Teste de `PATCH` com `status = 'pausada'` e sem `motivo_pausa` → erro.
- [ ] Teste de `PATCH` registra entrada de auditoria com diff.
- [ ] Teste de query de listagem com filtros combinados.
- [ ] Teste de mascaramento de PII no bloco de mensagens.

## Riscos

- **Vazamento de PII na tela de mensagens**: revisar mascaramento por código antes do release. Adicionar teste explícito.
- **Coluna "Última atividade" cara em SQL**: se a tabela `mensagens` crescer muito, a query de listagem fica lenta. Mitigação: usar `oficinas.ultima_mensagem_em` denormalizado, atualizado por trigger ou pelo webhook handler. Avaliar quando ficar lento.
- **Cancelar oficina sem confirmar**: cancelamento é destrutivo (perde acesso). Modal precisa exigir confirmação explícita digitando o nome da oficina.
