# ADR 0012: Plano único com preço configurável por oficina via painel admin

- **Status**: accepted
- **Data**: 2026-05-17
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/product/PRD-whatsapp-bot.md §16, §24`

## Contexto

O agente vendedor (modo `vendas`) pode precisar mencionar preço durante a conversa com o lead. O PRD §16 proíbe o bot de inventar preços, então o valor precisa vir de algum lugar configurado.

Decisão de modelo comercial: produto terá **um único plano**, com **valor que pode variar por oficina** (negociado caso a caso). Não vai ter tiers (Starter/Pro/Business) nem cobrança por uso no MVP.

## Decisão

**Plano único com preço configurável no banco, editável por administradores (devs/fundadores/donos) via painel admin separado.**

### Arquitetura

- **Tabela `planos`** — Pelo menos um plano cadastrado. Campos: `id`, `nome`, `preco_base`, `descricao`, `ativo`, `created_at`, `updated_at`. Permite criar novos planos no futuro sem mudar schema.
- **`oficinas.plano_id`** — Referência ao plano contratado.
- **`oficinas.preco_negociado`** — Sobrescreve `planos.preco_base` para essa oficina específica. Quando `NULL`, usa o `preco_base` do plano.
- **Bot vendedor não cita valor numérico** — Como o preço pode variar caso a caso, o bot conduz para o teste grátis ou para handoff humano quando o lead pergunta de preço. Decisão derivada do fato de que não há preço público fixo.

### Painel admin (novo, separado do painel da oficina)

- URL: `quandotrocar.com.br/admin` ou similar — distinto de `/painel` (que é da oficina).
- Acesso restrito a uma lista de WhatsApps autorizados (devs, fundadores, donos), persistida em `admin_users`.
- Login: mesmo fluxo OTP WhatsApp do painel da oficina ([ADR-0010](./0010-painel-web-no-mvp.md)), mas resolvido contra `admin_users` em vez de `oficinas`.
- Funcionalidades mínimas: listar planos, editar `planos.preco_base`, listar oficinas, editar `oficinas.preco_negociado` e `oficinas.plano_id`.

## Alternativas consideradas

- **Preço fixo hardcoded** — Descartado. Inflexível, exige deploy para qualquer reajuste.
- **Preço em env var** — Descartado. Bom para preço único, ruim para variar por oficina.
- **Plano único com preço por oficina (no banco)** — Escolhido. Coerente com modelo comercial de negociação caso a caso.
- **Tiers (Starter/Pro/Business)** — Descartado para o MVP. Pode ser adicionado depois reusando a tabela `planos`.
- **Pay-as-you-use** — Descartado para o MVP. Complexidade de billing variável não justifica no MVP.

## Consequências

### Positivas

- Reajuste de preço ou negociação não exige deploy.
- Suporta modelo flexível: cobra valor diferente por oficina conforme negociação.
- Schema preparado para evoluir para tiers no futuro (basta criar mais registros em `planos`).
- Admin tem visão e controle sobre oficinas e preços sem precisar SQL manual.

### Negativas / trade-offs

- Painel admin é mais um produto a construir e manter (mesmo que pequeno).
- `admin_users` é um surface de segurança adicional — bypass RLS, ações destrutivas. Precisa de log de auditoria desde o início.
- Bot vendedor não cita preço — depende do follow-up humano para fechar valor. Aceitável para validação inicial; se virar gargalo, revisitar.
- Mercado Pago ([ADR-0008](./0008-pagamento-no-mvp.md)) precisa lidar com valores que variam por oficina (gerar preferência de pagamento com valor dinâmico).

## Mudanças necessárias no modelo de dados

- Tabela `planos`: `id, nome, preco_base, descricao, ativo, created_at, updated_at`.
- `oficinas`: adicionar `plano_id` (FK para `planos`) e `preco_negociado` (numeric, nullable).
- Tabela `admin_users`: `id, whatsapp, nome, created_at, ativo`.
- Tabela `admin_audit_log`: `id, admin_id, acao, entidade, entidade_id, payload, created_at` — para rastrear ações admin (mudança de preço, etc.).
- Migrations e policies de RLS:
  - `planos` — leitura pública (ou só authenticated); escrita só via service role + verificação de admin no backend.
  - `admin_users`, `admin_audit_log` — sem RLS habilitada para clientes; acesso só via service role.

## Como o bot vendedor responde quando perguntam preço

Resposta sugerida (a ser refinada no prompt do agente):

```text
O valor a gente combina durante o teste, depois que você ver o produto rodando. Posso ativar 14 dias grátis pra sua oficina agora?
```

Quando o lead insiste, faz handoff humano via mesmo padrão de [ADR-0009](./0009-confirmacao-vs-pre-agendamento.md) (link `wa.me` para um WhatsApp comercial).

## Referências

- `docs/product/PRD-whatsapp-bot.md §16` (Requisitos do Agente IA), §24 (Decisões em Aberto)
- [ADR-0008](./0008-pagamento-no-mvp.md) — Pagamento via Mercado Pago.
- [ADR-0010](./0010-painel-web-no-mvp.md) — Painel da oficina + OTP WhatsApp.
- `.codex/prompts/whatsapp-sales-agent.md` (atualizar com a regra "não cita preço").
