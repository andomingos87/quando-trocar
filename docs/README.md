# Documentação · Quando Trocar

Índice navegável de toda a documentação do projeto. Se você está chegando agora (humano ou agente), comece por aqui.

## Comece aqui

- [CLAUDE.md](../CLAUDE.md) — guia para agentes (Claude, Codex). Onde achar contexto, regras de comportamento e convenções de idioma.
- [AGENTS.md](../AGENTS.md) — guia prescritivo principal: stack, boundaries de arquitetura, regras de OpenAI/Supabase/WhatsApp, code style.
- [Glossário](./glossary.md) — vocabulário de domínio (`oficina`, `lembrete`, `retorno`, `agent_mode`, etc.). Se você não reconhece um termo, comece aqui.
- [Context Changelog](./CONTEXT_CHANGELOG.md) — histórico de decisões e evolução do contexto. Quando algo grande muda, é registrado aqui.

## Produto

Especificações funcionais e visuais. Tudo em português.

- [PRD — Bot WhatsApp (implementação real)](./product/PRD-whatsapp-bot.md) — **canônico**. Spec completo do produto real: personas, fluxos, modelo de dados, requisitos do agente, compliance.
- [PRD — Painel Admin](./product/PRD-painel-admin.md) — **canônico**. Painel interno (`/admin`) para devs/fundadores/donos gerirem oficinas, planos, preços, cobrança e auditoria.
- [PRD — Landing prototype](./product/PRD-landing-prototype.md) — spec do protótipo de validação comercial (frontend-only, mockado). Histórico, mas ainda válido como referência da demo.
- [Telas web](./product/telas-web.md) — proposta de painel operacional para a oficina.
- [Copy](./product/copy.md) — microcopy da landing page (gitignored, material de referência).
- [Design system](./product/design-system.md) — identidade visual "Perfect Automotive" para a landing (gitignored, material de referência).

## Arquitetura e decisões

- [Plano técnico do bot WhatsApp](./architecture/whatsapp-bot-technical-plan.md) — recomendação técnica de stack, fluxos e componentes.
- [ADRs — Architecture Decision Records](./adr/README.md) — decisões arquiteturais documentadas. Veja o índice para a lista completa (decisões aceitas + perguntas em aberto).

## Backlog e execução

- [Backlog do bot WhatsApp](./backlog-whatsapp-bot/README.md) — execução por fases.
  - [Fase 1 — Bot vendedor](./backlog-whatsapp-bot/fase-1-bot-vendedor.md)
  - [Fase 2 — Conversão e onboarding](./backlog-whatsapp-bot/fase-2-conversao-onboarding.md)
  - [Fase 3 — Lembretes reais](./backlog-whatsapp-bot/fase-3-lembretes-reais.md)
  - [Fase 4 — Retorno e dashboard](./backlog-whatsapp-bot/fase-4-retorno-dashboard.md)
  - [Resumo consolidado Fases 1–3](./backlog-whatsapp-bot/fases-1-2-e-3-resumo-implementacao.md)
- [Backlog do painel admin](./backlog-painel-admin/README.md) — sub-fases Admin-0 a Admin-6.
  - [Admin-0 — Modelo de dados](./backlog-painel-admin/admin-0-modelo-dados.md)
  - [Admin-1 — Auth via OTP WhatsApp](./backlog-painel-admin/admin-1-auth.md)
  - [Admin-2 — Tela Planos](./backlog-painel-admin/admin-2-planos.md)
  - [Admin-3 — Tela Oficinas](./backlog-painel-admin/admin-3-oficinas.md)
  - [Admin-4 — Tela Visão geral](./backlog-painel-admin/admin-4-visao-geral.md)
  - [Admin-5 — Telas Admins e Auditoria](./backlog-painel-admin/admin-5-admins-auditoria.md)
  - [Admin-6 — Billing Mercado Pago](./backlog-painel-admin/admin-6-billing-mercado-pago.md)

## Operação (runbooks)

Procedimentos passo a passo para tarefas operacionais.

- [Índice de runbooks](./runbooks/README.md)
- [Setup do WhatsApp na Meta](./runbooks/meta-whatsapp-setup.md) — configurar Cloud API, tokens, webhook, números.
- [Setup de variáveis de ambiente](./runbooks/env-setup.md) — quais variáveis configurar e onde.
- [Migrations do Supabase](./runbooks/supabase-migrations.md) — fluxo de criar, revisar e aplicar migrations.
- [Deploy na Vercel](./runbooks/deploy-vercel.md) — preview vs produção, env vars, smoke tests.
- [Tunar o agente de IA](./runbooks/tunar-agente.md) — passo a passo para ajustar prompt/resposta do bot sem regressão.

## Prompts para agentes

Em `.codex/prompts/` (na raiz do projeto):

- `whatsapp-sales-agent.md` — agente vendedor (Fase 1).
- `whatsapp-onboarding-agent.md` — agente de onboarding e operação (Fase 2).
- `whatsapp-reminder-agent.md` — agente de lembretes e respostas (Fase 3).
- `supabase-rls-review.md` — checklist de revisão de RLS antes de migration.
- `openai-structured-output-review.md` — checklist de revisão de Structured Outputs.
- `phase-implementation.md` — template para iniciar implementação de uma nova fase.

## Qualidade do agente de IA

- [Skill `whatsapp-agent`](../.claude/skills/whatsapp-agent/SKILL.md) — invariantes e fluxo recomendado ao tocar `lib/whatsapp/*-agent.ts`.
- [Runbook: tunar o agente](./runbooks/tunar-agente.md) — passo a passo para ajustar resposta sem regressão.
- [Eval set](../tests/whatsapp-agent-evals/README.md) — casos canônicos versionados, um arquivo por agente.

## Como manter esta doc viva

- Decisão arquitetural nova → criar ADR em `docs/adr/` e referenciar em `docs/CONTEXT_CHANGELOG.md`.
- Termo de domínio novo → adicionar em `docs/glossary.md`.
- Procedimento operacional novo → criar runbook em `docs/runbooks/`.
- Spec de produto mudou → editar o PRD relevante e registrar a mudança em `docs/CONTEXT_CHANGELOG.md`.
- Fase do backlog encerrada → marcar status no arquivo da fase e referenciar no resumo consolidado.
