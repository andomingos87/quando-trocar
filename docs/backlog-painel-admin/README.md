# Backlog — Painel Admin do Quando Trocar

Base:

- [`../product/PRD-painel-admin.md`](../product/PRD-painel-admin.md) — canônico.
- [`../adr/0013-painel-admin-escopo-billing-auditoria.md`](../adr/0013-painel-admin-escopo-billing-auditoria.md) — decisões de arquitetura.
- [`../adr/0012-politica-de-preco.md`](../adr/0012-politica-de-preco.md) — modelo de planos.
- [`../adr/0010-painel-web-no-mvp.md`](../adr/0010-painel-web-no-mvp.md) — login OTP WhatsApp.

Stack alvo: mesma do produto principal — Next.js 15 (App Router) + Supabase + Tailwind + Vercel.

## Sub-fases

Cada sub-fase entrega valor isolado e é mergeavel separadamente.

| # | Arquivo | Entrega |
|---|---------|---------|
| Admin-0 | [admin-0-modelo-dados.md](./admin-0-modelo-dados.md) | Migrations + seeds |
| Admin-1 | [admin-1-auth.md](./admin-1-auth.md) | Login OTP admin + sessão separada |
| Admin-2 | [admin-2-planos.md](./admin-2-planos.md) | Tela `Planos` (CRUD) |
| Admin-3 | [admin-3-oficinas.md](./admin-3-oficinas.md) | Telas `Oficinas` lista + detalhe + cadastro manual |
| Admin-4 | [admin-4-visao-geral.md](./admin-4-visao-geral.md) | Tela `Visão geral` + atividades |
| Admin-5 | [admin-5-admins-auditoria.md](./admin-5-admins-auditoria.md) | Telas `Admins` e `Auditoria` |
| Admin-6 | [admin-6-billing-mercado-pago.md](./admin-6-billing-mercado-pago.md) | Integração MP + `Pagamentos` + cron de cobrança e auto-pausa |

## Ordem recomendada

1. **Admin-0** primeiro — bloqueia todas as outras (sem tabelas não há nada a construir).
2. **Admin-1** — sem auth, telas não podem ser acessadas.
3. **Admin-2** em seguida — CRUD mais simples, valida padrão de mutação + auditoria.
4. **Admin-3** — coração do painel.
5. **Admin-4** e **Admin-5** em paralelo, após Admin-3.
6. **Admin-6** pode rodar em paralelo a partir de Admin-3 — depende só de Admin-0 e Admin-1.

## Pré-requisitos transversais

| Item | Status | Bloqueia | Notas |
|---|---|---|---|
| WhatsApp do Anderson em E.164 (`+5511945207618`) | ✅ confirmado 2026-05-17 | Admin-0 | Vai direto no seed de `admin_users`. |
| Template Meta OTP categoria "Authentication" (`WHATSAPP_TEMPLATE_OTP_NAME`) | ⏳ pendente, compartilhado com Fase 4A | Admin-1 | Já previsto no roadmap do painel da oficina. |
| Template Meta cobrança categoria "Utility" (`WHATSAPP_TEMPLATE_COBRANCA_NAME`) | ⏳ pendente, **resolver depois** | Admin-6 | Ciclo de aprovação Meta leva horas/dias — solicitar com antecedência. Anderson vai cuidar quando chegar perto de Admin-6. |
| Conta Mercado Pago + `MERCADO_PAGO_ACCESS_TOKEN` + `MERCADO_PAGO_WEBHOOK_SECRET` | ⏳ pendente, **placeholder em env** | Admin-6 | Anderson preenche os valores reais quando chegar em Admin-6. Até lá, env vars ficam como placeholders. |
| Supabase Cron habilitado no projeto | ⏳ verificar | Admin-6 | Sem isso, crons de cobrança e auto-pausa não rodam. |

## Convenções

- **Idioma do código**: inglês (variáveis, funções, tipos). Idioma da UI: português.
- **Helper de auditoria**: toda mutação backend usa `withAdminAudit(adminId, acao, entidade, entidadeId, payload, fn)`. Implementação faz parte de Admin-1 e é reusada em todas as sub-fases.
- **Componentes**: novos componentes do painel admin em `components/admin/`. Compartilhar com painel da oficina só quando houver duplicação real (não antecipar).
- **Rotas**: páginas em `app/admin/`. API interna em `app/api/admin/`.
- **Service role**: nunca exposto ao cliente. Mutações sempre passam por route handlers que validam sessão admin antes.
