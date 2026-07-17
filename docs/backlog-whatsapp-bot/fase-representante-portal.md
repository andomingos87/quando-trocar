# Fase R4 — Portal do Representante (login e visibilidade própria)

> **Criada em 2026-07-17.** Executa a Fase R4 que a [fase-representantes-comissao.md](./fase-representantes-comissao.md) deixou explicitamente como "futuro" (linha 71: _"Dashboard/login próprio do representante — padrão OTP já existe — seria um `rep_users` análogo a `admin_users`"_). Responde à decisão em aberto do [PRD §24](../product/PRD-whatsapp-bot.md) (_"O representante comercial terá visão própria dos leads?"_ → **sim**). Exige nova ADR.

## Objetivo

Dar ao **Representante Comercial** ([PRD §3.3](../product/PRD-whatsapp-bot.md)) uma área de acesso própria, separada do painel admin, onde ele faz login e **consulta** (read-only):

- **Clientes** — as oficinas que ele trouxe (carteira), com números agregados de tração.
- **Leads** — os leads de oficina atribuídos a ele, no funil.
- **Comissões** — extrato próprio (prevista / paga / cancelada) e totais por mês.
- **Playbook de vendas** — material curado para vender o produto.
- **Novidades** — comunicados do time para a rede de representantes.

Todo o **backend de atribuição e comissão já existe** (Fases R0–R3, migration `20260709000000_representantes_comissao.sql`). Esta fase adiciona **só a camada de autenticação e visibilidade do representante** — nada do motor de comissão muda.

## Decisões de produto (fechadas com o dono em 2026-07-17)

| Tema | Decisão | Consequência |
|---|---|---|
| **O que é "clientes"** | Oficinas que o rep trouxe + **números agregados** por oficina (qtd de clientes finais cadastrados, lembretes/retornos). **Sem PII de cliente final.** | Telas de carteira mostram a oficina e sua tração, nunca nome/WhatsApp dos clientes finais das oficinas (LGPD). |
| **Playbook e novidades** | **Conteúdo fixo no código** (curado no repositório). | Publicar/editar = editar constante + deploy. Sem tabelas nem UI de edição no MVP. Runbook curto documenta o processo. |
| **Identidade de login** | **OTP contra a tabela `representantes` existente** (não cria `rep_users`). | Uma só fonte de verdade. Migration mínima: só `ultimo_acesso_em` e estender o CHECK de `auth_otps.target`. |
| **Superfície** | **Read-only.** | Ações que mexem em dinheiro (marcar comissão paga, cancelar) continuam exclusivas do admin. |

## Segurança — o ponto mais sensível desta fase

Hoje **não há RLS por tenant** no banco: a única policy real do sistema é `planos_select_authenticated`; todo o resto está `enable row level security` **sem policies** e o acesso acontece 100% via `service_role` (bypass de RLS), com o isolamento garantido pelo guard de sessão na camada Next.js. Ver `.context/lessons/0001-security-definer-grants-vazam.md` e [ADR-0003](../adr/0003-multi-tenancy-via-rls-oficina-id.md) (intenção) vs. estado real.

Implicação direta: **o escopo "cada rep só vê o que é dele" é imposto no código, não no Postgres.** Regras não-negociáveis desta fase:

1. Toda query do portal recebe `representante_id` **da sessão**, nunca do corpo/query da requisição.
2. Funções de dados dedicadas em `lib/representante/*` — **não** reutilizar direto funções admin que aceitam `representanteId` livre; quando reaproveitar (ex.: `listComissoes`), envolver num wrapper que injeta o `representanteId` da sessão.
3. Guard re-verifica `ativo = true` e `deleted_at is null` **a cada request** (um rep pode ser desativado no meio da sessão).
4. Cookie e secret **separados do admin** (`qt_rep_session`, `REP_SESSION_SECRET`, claim `isRepresentante`) — um cookie de admin não acessa a área do rep e vice-versa.
5. **LGPD**: nenhuma tela/endpoint do rep pode retornar PII de cliente final. Dados de contato da própria oficina (responsável, WhatsApp da oficina) são o contato comercial legítimo do rep — esses aparecem; clientes finais não.
6. OTP herda o hardening do admin: rate-limit, hash HMAC-SHA256, expiração 5 min, máx. 5 tentativas, resposta genérica (sem enumeração de usuário).

Revisão obrigatória do agente `aurea-context:seguranca` antes do deploy.

## Novo módulo

A área é um novo público + nova superfície de auth → declarar módulo **`portal-representante`** em `.context/modules/portal-representante/AGENTS.md` (análogo a `painel-admin`). Alternativa (mais barata, menos limpa): estender `painel-admin`. Recomendação: módulo próprio, pela fronteira de segurança distinta.

---

## Fases de execução

### R4.0 — Decisão e documentação (~0,5 dia)

- [ ] Nova **ADR-00XX "Portal do representante (login e visibilidade)"**: login OTP contra `representantes`, escopo read-only por `representante_id` imposto no backend, sem PII de cliente final, conteúdo estático. Estende a ADR-0019.
- [ ] Nova subseção **18.7 "Portal do representante"** em `docs/regras-de-negocio.md`.
- [ ] Atualizar `docs/product/PRD-whatsapp-bot.md §24` (decisão em aberto → decidida).
- [ ] Marcar a R4 como "em execução" na `fase-representantes-comissao.md` (deixa de ser "futuro").
- [ ] Registrar em `docs/CONTEXT_CHANGELOG.md`.
- [ ] Declarar módulo `.context/modules/portal-representante/AGENTS.md`.

### R4.1 — Autenticação: schema + fluxo OTP (~1–1,5 dia)

Migration única (padrão ADR-0003, RLS habilitada, sem policy — só service-role):

- [ ] Estender o CHECK de `auth_otps.target` para incluir `'representante'` (hoje `('oficina','admin')`).
- [ ] `representantes.ultimo_acesso_em timestamptz` nullable.

Código (clonar o padrão do admin, preferindo **generalizar** o que já existe em vez de copiar/colar):

- [ ] `lib/representante/session.ts` — cookie `qt_rep_session`, JWT HS256 com `REP_SESSION_SECRET`, claims `{ representanteId, whatsapp, codigo, isRepresentante: true }`, TTL 14 dias (rep é externo — menor que os 30 d do admin).
- [ ] OTP com `target: 'representante'` buscando em `representantes` por `whatsapp` + `ativo` + `deleted_at is null` (reaproveitar/generalizar `lib/admin/otp.ts`).
- [ ] `lib/representante/api-guard.ts` — `requireRepresentante()` (páginas → redireciona para `/representante/entrar`) e `requireRepresentanteApi()` (APIs → 401 JSON), re-checando rep ativo/não-deletado.
- [ ] Rotas: `app/api/representante/auth/request-otp`, `verify-otp`, `logout`.
- [ ] Página de login `app/representante/entrar/` (form 2 passos `request → verify`, clone de `entrar-form.tsx`).
- [ ] `.env`: `REP_SESSION_SECRET` (≥32 chars). Atualizar `.env.local.example` e runbook de env.
- [ ] Auditoria: `representante.login` em `admin_audit_log` (ou log próprio).

**Dependência externa a validar já em R4.1:** o **template Meta de OTP**. Verificar se o template atual do admin é reutilizável para o rep; se o texto for específico de admin, aprovar novo template (lead time da Meta é risco de cronograma).

- [ ] Testes: geração/verificação de OTP para target `representante`; guard rejeita rep inativo/deletado; **isolamento de cookie** (sessão de admin não acessa `/representante` e vice-versa); expiração e limite de tentativas.

### R4.2 — Camada de dados read-only escopada (~1 dia)

`lib/representante/*` (todas `server-only`, todas recebendo `representanteId` da sessão):

- [ ] `carteira.ts` → `listOficinasDoRepresentante(supabase, representanteId)`: `oficinas where representante_id = X and deleted_at is null`, campos nome/cidade/status/plano/preço mensal/ativa desde + agregados por oficina (count `clientes_finais`, count `lembretes` enviados/respondidos). **Sem PII de cliente final.**
- [ ] `leads.ts` → `listLeadsDoRepresentante(supabase, representanteId)`: funil de `leads_oficina where representante_id = X` (status, cidade, última mensagem, convertido?).
- [ ] `comissoes.ts` → wrapper sobre `listComissoes({ representanteId })` de `lib/admin/comissoes.ts` (já escopado) + `getComissaoResumoMes` (previsto/pago no mês). O wrapper injeta o `representanteId` da sessão.
- [ ] `dashboard.ts` → resumo: oficinas ativas, leads em aberto, comissão prevista no mês, comissão paga acumulada.
- [ ] Testes obrigatórios: **escopo** (rep A não vê dados de rep B), corretude dos agregados, **ausência de PII** de cliente final em qualquer retorno.

### R4.3 — Telas do portal (~2 dias)

Route group `app/representante/(autenticado)/` com **guard no layout** (padrão do admin) + shell própria, **mobile-first** (o rep usa no celular). Seguir a skill `quando-trocar-design`.

- [ ] `/representante` — visão geral: cards (oficinas ativas, leads em aberto, comissão prevista no mês, comissão paga acumulada), **seu código + link `wa.me` pronto com botão copiar** (reaproveita a geração de link do admin), últimas novidades.
- [ ] `/representante/clientes` — carteira de oficinas trazidas + números agregados. Sem PII de cliente final.
- [ ] `/representante/leads` — funil de leads atribuídos.
- [ ] `/representante/comissoes` — extrato filtrável por mês (prevista/paga/cancelada) + totais. Read-only.
- [ ] `/representante/playbook` — playbook de vendas (conteúdo estático).
- [ ] `/representante/novidades` — lista de novidades (conteúdo estático).
- [ ] `/representante/perfil` — dados do rep + sair.

### R4.4 — Conteúdo estático: playbook + novidades (~0,5 dia)

- [ ] `lib/representante/content/playbook.ts` — playbook estruturado por seções: pitch, como o produto funciona, ROI/argumentos, objeções comuns e respostas, **frase-gatilho + como montar o link com o próprio código**, FAQ. Base factual reaproveitada de `PRODUCT_FACTS`/`SALES_FACTS` (`lib/whatsapp/product-knowledge.ts`), reescrita para um vendedor humano. **Sem preço/condição comercial** (ADR-0012 — quem fecha valor é humano).
- [ ] `lib/representante/content/novidades.ts` — array `{ data, titulo, corpo, tag }`, ordenado por data desc.
- [ ] Runbook curto `docs/runbooks/publicar-novidade-representante.md`: "editar o array + PR + deploy".

### R4.5 — Futuro (fora deste plano)

- Playbook/novidades editáveis no admin (tabelas + UI) se o deploy por mudança incomodar.
- Notificação WhatsApp ao rep quando ganhar comissão ou sair novidade.
- CRM leve para o rep ("conversei com essa oficina").
- Representante multinível / hierarquia.

**Estimativa total (R4.0–R4.4): ~5–6,5 dias.**

## Dependências e riscos

- **Template Meta de OTP do rep** — dependência externa; validar reaproveitamento ou aprovar novo template cedo (R4.1).
- **Escopo 100% aplicacional (sem RLS)** — risco de vazamento entre reps se uma query esquecer o filtro. Mitigação: helpers dedicados que exigem `representanteId` da sessão, wrappers sobre funções admin, testes de escopo, revisão de segurança antes do deploy.
- **LGPD** — nenhuma superfície do rep pode expor PII de cliente final; revisar cada query e cada tela.
- **Novo secret `REP_SESSION_SECRET`** — provisionar no Vercel e ambientes; runbook de env. (Ver na memória do projeto: deploy corre na frente das migrations — conferir `list_migrations` após subir schema.)
- **Rep desativado mid-sessão** — guard re-checa `ativo`/`deleted_at` a cada request.

## Critérios de aceite

1. Rep ativo faz login por OTP no WhatsApp e cai em `/representante`; rep inativo/deletado não entra.
2. Rep A nunca vê oficinas, leads ou comissões do rep B (teste de escopo verde).
3. Nenhuma tela/endpoint do rep expõe nome ou WhatsApp de cliente final (LGPD).
4. Comissões do portal batem com o extrato do admin para o mesmo rep/mês.
5. Cookie/sessão do rep é isolado do admin — um não acessa a área do outro.
6. Playbook e novidades renderizam a partir do conteúdo do repositório; publicar novidade = editar array + deploy.
