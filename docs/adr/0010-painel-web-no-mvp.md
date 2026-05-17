# ADR 0010: Painel web mínimo na Fase 4, com login passwordless via OTP WhatsApp

- **Status**: accepted
- **Data**: 2026-05-17
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §19, §24`, `docs/product/telas-web.md`

## Contexto

A oficina interage com o produto via WhatsApp (cadastro, operação, lembretes). Conforme acumula clientes, surge a necessidade de visualização consolidada (métricas, lista de clientes, lembretes, retornos). Pelo chat, lista grande é impraticável.

PRD §19 prevê dashboard MVP com 6 telas. `telas-web.md` detalha 7 telas. Decidir: quanto do painel entra no MVP, e como a oficina se autentica.

## Decisão

**Painel mínimo na Fase 4, com login passwordless por OTP WhatsApp.**

### Escopo do painel mínimo (Fase 4)

Quatro telas:

1. **Dashboard** — métricas-chave (cadastros, lembretes enviados, retornos, receita).
2. **Clientes** — lista com busca/filtro, detalhe básico (nome, WhatsApp, veículos, último serviço, próximo lembrete).
3. **Lembretes** — próximos 7 dias + histórico recente.
4. **Retornos** — lista de retornos registrados.

Nas Fases 1-3, oficinas operam 100% pelo WhatsApp. Painel não é bloqueante.

Telas adiadas (Fase 5+): conversas detalhadas, configurações granulares, integração de agenda, gestão multi-atendente.

### Autenticação: OTP via WhatsApp

Fluxo de login:

1. Oficina abre `quandotrocar.com.br/painel`, digita o WhatsApp principal.
2. Sistema valida que o número existe em `oficinas.whatsapp_principal` com `status = ativa`.
3. Sistema gera código de 6 dígitos, persiste em `auth_otps` com expiração de 5 minutos.
4. Sistema envia o código via WhatsApp para o número.
5. Oficina digita o código no painel.
6. Sistema valida (código correto + não expirado + não usado) → cria sessão (cookie HTTP-only ou JWT).

Sem senha, sem email, sem recuperação de senha. WhatsApp é o único factor — coerente com o produto.

## Alternativas consideradas

- **Sem painel no MVP** — Descartado: oficina precisa de visão consolidada após acumular dados.
- **Painel completo desde o MVP** — Descartado: atrasa lançamento em 3+ semanas.
- **Painel mínimo na Fase 4** — Escolhido. Equilibra valor e prazo.
- **Login por email/senha** — Descartado: atrito alto (oficina não vive em email; senha esquecida quebra UX).
- **Login com Supabase Auth (magic link)** — Descartado: depende de email.
- **Login OTP WhatsApp** — Escolhido. Único canal que a oficina já usa todo dia.

## Consequências

### Positivas

- Painel mínimo é construível em ~1-2 semanas focadas.
- Login OTP elimina senha (zero atrito, zero "esqueci minha senha").
- Reusa a integração WhatsApp já existente para enviar o código.
- Janela de 24h da Meta cobre OTP de retorno (oficina respondeu nas últimas 24h → mensagem livre permitida).

### Negativas / trade-offs

- Para o **primeiro login** após conversão, pode estar fora da janela de 24h → precisa de **template de OTP aprovado na Meta** (categoria "Authentication"). Adicionar à lista de templates do projeto.
- Rate limiting essencial: precisa proteger contra envio massivo de OTPs (limite por número e por IP).
- Sem fallback: se a oficina perdeu acesso ao WhatsApp principal, não tem como entrar. Aceitável — esse cenário é raríssimo e admin pode resetar manualmente.
- Sessão precisa de TTL razoável (ex: 30 dias) para não forçar OTP a cada acesso.

## Mudanças necessárias no modelo de dados

- Tabela `auth_otps`: `id`, `oficina_id`, `whatsapp`, `code_hash`, `created_at`, `expires_at`, `used_at`, `attempts`.
- Tabela `sessions` ou uso de JWT — escolha de implementação.
- Política de RLS em `auth_otps`: bloqueada para usuários, acessada só via service role.
- Template Meta de OTP: aprovar antes da Fase 4 (ciclo de aprovação Meta leva horas/dias).

## Referências

- `docs/product/PRD-whatsapp-bot.md §19` (Dashboard MVP), §24 (Decisões em Aberto)
- `docs/product/telas-web.md` (proposta original)
- `docs/backlog-whatsapp-bot/fase-4-retorno-dashboard.md` (escopo a ser ajustado)
- [ADR-0005](./0005-templates-meta-vs-mensagem-livre.md) (templates fora da janela 24h)
- [Meta Authentication templates](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/authentication-templates)
