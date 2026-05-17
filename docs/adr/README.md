# Architecture Decision Records · Quando Trocar

ADRs documentam decisões arquiteturais com contexto, alternativas consideradas e consequências esperadas. O objetivo é deixar rastro durável para que ninguém — humano ou agente — refaça a decisão sem saber por quê ela foi tomada.

## Índice

### Aceitas

| # | Título | Status | Data |
|---|--------|--------|------|
| [0001](./0001-llm-como-conselheiro-nao-decisor.md) | LLM gera texto e interpreta, mas não decide estado | accepted | 2026-04-25 |
| [0002](./0002-roteamento-via-agent-mode.md) | Roteamento determinístico via `agent_mode` + `participant_type` antes do LLM | accepted | 2026-04-25 |
| [0003](./0003-multi-tenancy-via-rls-oficina-id.md) | Multi-tenancy via RLS por `oficina_id` | accepted | 2026-04-25 |
| [0004](./0004-padrao-webhook-persist-fila-worker.md) | Webhook valida → persiste → enfileira → worker processa | accepted | 2026-04-25 |
| [0005](./0005-templates-meta-vs-mensagem-livre.md) | Templates Meta fora da janela 24h, livre dentro | accepted | 2026-04-25 |
| [0006](./0006-idempotencia-via-provider-ids.md) | Idempotência via unique index em provider IDs e business keys | accepted | 2026-04-25 |
| [0007](./0007-provedor-whatsapp-business-cloud.md) | Provedor WhatsApp — Meta Business Cloud API direta | accepted | 2026-05-17 |
| [0008](./0008-pagamento-no-mvp.md) | Pagamento via Mercado Pago | accepted | 2026-05-17 |
| [0009](./0009-confirmacao-vs-pre-agendamento.md) | Bot não agenda — apenas faz a ponte entre cliente e oficina | accepted | 2026-05-17 |
| [0010](./0010-painel-web-no-mvp.md) | Painel web mínimo na Fase 4, com login OTP WhatsApp | accepted | 2026-05-17 |
| [0011](./0011-visibilidade-de-representante.md) | Não rastrear representante no MVP | accepted | 2026-05-17 |
| [0012](./0012-politica-de-preco.md) | Plano único com preço configurável por oficina via painel admin | accepted | 2026-05-17 |
| [0013](./0013-painel-admin-escopo-billing-auditoria.md) | Painel admin — escopo, billing mensal recorrente e auditoria | accepted | 2026-05-17 |

### Em aberto (drafts)

_Sem ADRs em aberto no momento._

## Status possíveis

- **proposed** — proposta em aberto, ainda em discussão.
- **accepted** — decisão tomada e vigente.
- **superseded** — substituída por outra ADR (incluir link).
- **deprecated** — descontinuada (não substituída).

## Como criar uma nova ADR

1. Próximo número sequencial (`NNNN`).
2. Slug em kebab-case descrevendo a decisão.
3. Copie o template abaixo.
4. Atualize este índice.
5. Registre a entrada em `docs/CONTEXT_CHANGELOG.md`.

## Template

```markdown
# ADR NNNN: Título curto da decisão

- **Status**: proposed | accepted | superseded by ADR XXXX | deprecated
- **Data**: AAAA-MM-DD
- **Decisores**: [nomes ou papéis]
- **Fonte**: [doc ou conversa que originou]

## Contexto

Qual o problema, qual restrição, qual o cenário. 2–4 parágrafos.

## Decisão

O que foi decidido, em 1–3 frases diretas.

## Alternativas consideradas

- **Opção A** — descrição. Por que foi descartada (ou aceita).
- **Opção B** — descrição. Trade-off.

## Consequências

### Positivas

- Lista curta.

### Negativas / trade-offs

- Lista curta. O que estamos abrindo mão.

## Referências

- Links para PRD, AGENTS.md, código, conversas, outras ADRs.
```
