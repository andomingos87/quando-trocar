# Context Changelog · Quando Trocar

Histórico de decisões e mudanças relevantes no contexto do projeto. Formato adaptado de [Keep a Changelog](https://keepachangelog.com/).

Quando registrar:

- Uma decisão arquitetural foi tomada (link p/ ADR).
- Um PRD foi aprovado, atualizado ou descontinuado.
- Uma fase do backlog foi encerrada.
- Um novo runbook foi adicionado.
- Convenção do projeto mudou (idioma, estrutura, fluxo de trabalho).
- Algo grande foi removido ou substituído.

Não registrar:

- Commits individuais (`git log` resolve).
- Bugs corrigidos (PRs resolvem).
- Mudanças de copy ou design pontuais.

---

## 2026-05-17 — Estrutura de context engineering instalada

### Adicionado

- `CLAUDE.md` na raiz, complementar a `AGENTS.md`.
- `docs/README.md` como índice navegável.
- `docs/glossary.md` consolidando 15+ termos de domínio.
- `docs/adr/` com 6 ADRs retroativas (decisões já vigentes, agora documentadas) e 6 ADRs draft (perguntas em aberto do PRD §24).
- `docs/runbooks/` com índice + 4 runbooks: Meta setup, env setup, Supabase migrations, deploy Vercel.
- `docs/CONTEXT_CHANGELOG.md` (este arquivo).

### Mudou

- Reorganização de docs em `docs/product/`, `docs/architecture/`, `docs/adr/`, `docs/runbooks/`.
- `PRD.md` → `docs/product/PRD-landing-prototype.md`.
- `PRD_WHATSAPP_BOT_REAL.md` → `docs/product/PRD-whatsapp-bot.md`.
- `copy.md` → `docs/product/copy.md` (continua gitignored).
- `design-system.md` → `docs/product/design-system.md` (continua gitignored).
- `docs/telas-web.md` → `docs/product/telas-web.md`.
- `docs/whatsapp-bot-technical-plan.md` → `docs/architecture/whatsapp-bot-technical-plan.md`.
- `docs/meta-whatsapp-configuracao.md` → `docs/runbooks/meta-whatsapp-setup.md`.
- Convenção de idioma: AGENTS/CLAUDE/ADRs em inglês; resto em português.

### Em aberto

6 decisões formalizadas em ADRs draft (ver `docs/adr/`):

- 0007 — Provedor WhatsApp para a primeira versão.
- 0008 — Pagamento dentro do fluxo ou manual no MVP.
- 0009 — Agente pode confirmar agenda ou apenas pré-agendar.
- 0010 — Painel web no MVP ou tudo começa pelo WhatsApp.
- 0011 — Representante comercial terá visão própria dos leads.
- 0012 — Política de preço/plano usada pelo agente vendedor.

---

## 2026-04-26 — Fases 1, 2 e 3 implementadas

### Adicionado

- Prompts dos 3 agentes consolidados em `.codex/prompts/`: vendas, onboarding, reminder.
- Fase 1 (bot vendedor), Fase 2 (conversão e onboarding) e Fase 3 (lembretes reais) implementadas.
- Resumo consolidado em `docs/backlog-whatsapp-bot/fases-1-2-e-3-resumo-implementacao.md`.

### Em aberto na época

- Fase 4 (retorno e dashboard) ainda em planejamento.

---

## 2026-04-25 — Bases do produto real

### Adicionado

- `PRD_WHATSAPP_BOT_REAL.md` aprovado (status "Implementação Real", v1.0). Define visão dual (vendas + operacional), 7 fluxos, modelo de dados, agentes, compliance.
- Plano técnico publicado em `docs/whatsapp-bot-technical-plan.md`. Recomenda Next.js + Supabase + Cloud API + OpenAI Structured Outputs.
- `design-system.md` documenta identidade visual "Perfect Automotive" para a landing.
- `docs/telas-web.md` propõe painel operacional para a oficina.
- `docs/meta-whatsapp-configuracao.md` consolida setup operacional da Meta.

### Decidido

- Stack: Next.js 15 + React 19 + Supabase (Postgres, Auth, RLS, Queues, Cron) + OpenAI Responses API + Meta WhatsApp Cloud API.
- Multi-tenancy: RLS por `oficina_id`.
- LLM gera texto e interpreta, mas não decide estado.
- Roteamento via `agent_mode` + `participant_type` antes de invocar LLM.
- Mensagens fora da janela de 24h via templates aprovados pela Meta.

---

## 2026-04-24 — Protótipo de validação aprovado

### Adicionado

- `PRD.md` aprovado para execução (status "Aprovado para execução", v1.0). Protótipo frontend-only para validação comercial com 3–5 oficinas.

### Decidido

- Escopo do protótipo: simulação completa do fluxo (cadastro, lembretes, conversas) sem backend nem WhatsApp real.
- Resultado da validação informa a decisão de seguir com a implementação real.
