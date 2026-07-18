# ADR 0025: Portal do representante (login e visibilidade própria)

- **Status**: accepted (estende a [ADR-0019](./0019-representantes-e-comissao.md))
- **Data**: 2026-07-18
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/backlog-whatsapp-bot/fase-representante-portal.md`, decisões fechadas com o dono em 2026-07-17, [PRD §24](../product/PRD-whatsapp-bot.md)

## Contexto

A [ADR-0019](./0019-representantes-e-comissao.md) implementou atribuição e comissão (Fases R0–R3): o representante já existe como cadastro, os leads/oficinas ficam atribuídos a ele e cada pagamento confirmado gera comissão. Faltava a **Fase R4**, deixada explicitamente como "futuro": uma área própria onde o representante faz login e consulta o que é dele. Isso responde à decisão em aberto do [PRD §24](../product/PRD-whatsapp-bot.md) (_"O representante comercial terá visão própria dos leads?"_ → **sim**).

O representante é um **público externo novo**, com uma fronteira de segurança distinta do admin: ele só pode ver a própria carteira, nunca dados de outros representantes nem PII de cliente final das oficinas. Hoje o sistema **não tem RLS por tenant** (a única policy real é `planos_select_authenticated`; todo o acesso é via `service_role`, com o isolamento imposto pelo guard de sessão na camada Next.js — ver [ADR-0003](./0003-multi-tenancy-via-rls-oficina-id.md) intenção vs. estado real e `.context/lessons/0001-security-definer-grants-vazam.md`). Portanto o escopo "cada rep só vê o que é dele" é imposto **100% no código**.

## Decisão

Criar um **portal do representante** (`app/representante`), read-only, com autenticação própria por OTP-no-WhatsApp contra a tabela `representantes` existente. Módulo próprio `portal-representante`.

1. **Login OTP contra `representantes`** — sem tabela `rep_users`. Estende o CHECK de `auth_otps.target` para `('oficina','admin','representante')` e adiciona `representantes.ultimo_acesso_em`. Reaproveita o template Meta de OTP já usado por oficina/admin (`WHATSAPP_TEMPLATE_OTP_NAME`) — nenhum template novo a aprovar.
2. **Sessão isolada do admin** — cookie `qt_rep_session`, secret `REP_SESSION_SECRET`, claim `isRepresentante: true`, TTL 14 dias (menor que os 30 d do admin porque o rep é externo). Um cookie de admin não acessa a área do rep e vice-versa.
3. **Escopo imposto no backend** — camada `lib/representante/*` (`server-only`) cujas funções **exigem** o `representante_id` que vem sempre da **sessão**, nunca do request. Quando reaproveita função admin (`listComissoes`), envolve num wrapper que injeta o `representante_id` da sessão.
4. **Guard re-verifica ativo/deletado a cada request** — um representante desativado no meio da sessão perde o acesso imediatamente.
5. **Sem PII de cliente final (LGPD)** — as telas de carteira mostram a oficina (contato comercial legítimo do rep) e **números agregados** (quantidade de clientes finais, lembretes enviados/respondidos), nunca nome/WhatsApp de cliente final.
6. **Read-only** — nenhuma ação que mexe em dinheiro (marcar comissão paga, cancelar) fica no portal; isso continua exclusivo do admin ([ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md): estado sensível não muda por superfície secundária).
7. **Conteúdo estático** — playbook de vendas e novidades são constantes no código (`lib/representante/content/*`), curados no repositório e publicados por deploy. Sem tabelas nem UI de edição no MVP.

## Alternativas consideradas

- **Tabela `rep_users` análoga a `admin_users`** — Descartado: `representantes` já é a fonte de verdade do público; um segundo cadastro duplicaria identidade e abriria divergência. Migration mínima (só `ultimo_acesso_em` + CHECK) resolve.
- **Estender o módulo `painel-admin`** — Descartado: a fronteira de segurança é distinta (público externo, escopo por representante, sem PII de cliente final). Módulo próprio deixa a regra explícita e evita vazamento de superfície admin.
- **Playbook/novidades editáveis no admin (tabelas + UI)** — Adiado para R4.5: o custo de publicar por deploy é aceitável no MVP; evita mais uma superfície de escrita agora.
- **RLS por representante no Postgres** — Fora de escopo desta fase: o sistema inteiro ainda usa o modelo service-role + guard aplicacional (ADR-0003). Introduzir RLS só para o rep seria inconsistente; o escopo é garantido por helpers dedicados + testes de escopo + revisão de segurança.

## Consequências

### Positivas

- Representante ganha autonomia (vê carteira, leads, comissões, playbook) sem sobrecarregar o admin.
- Uma só identidade de representante (tabela `representantes`); migration mínima.
- Fronteira de segurança explícita num módulo próprio, com testes de escopo e revisão de segurança obrigatória.
- Reaproveita template Meta de OTP existente — sem dependência de aprovação nova da Meta.

### Negativas / trade-offs

- Escopo por representante fica **100% no código** (sem rede de proteção do banco). Mitigação: helpers que exigem `representante_id` da sessão, wrappers sobre funções admin, testes de escopo, revisão `aurea-context:seguranca` antes do deploy.
- Novo secret `REP_SESSION_SECRET` a provisionar em todos os ambientes (Vercel + local). Deploy corre na frente das migrations — conferir `list_migrations` após subir schema.
- Publicar playbook/novidade exige deploy (aceito no MVP).

## Referências

- [ADR-0019](./0019-representantes-e-comissao.md) — atribuição e comissão (base desta fase).
- [ADR-0003](./0003-multi-tenancy-via-rls-oficina-id.md) — multi-tenancy (intenção) vs. estado real service-role.
- [ADR-0001](./0001-llm-como-conselheiro-nao-decisor.md) — estado sensível não muda por superfície secundária.
- [ADR-0012](./0012-politica-de-preco.md) — preço/condição comercial fora do conteúdo automático (playbook não traz preço).
- Plano: `docs/backlog-whatsapp-bot/fase-representante-portal.md`.
- Regras de negócio: `docs/regras-de-negocio.md §18.7`.
- Módulo: `.context/modules/portal-representante/AGENTS.md`.
