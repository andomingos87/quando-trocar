# Fase Representantes - Atribuição e comissão

> **Criada em 2026-07-09.** Este plano reabre a decisão da [ADR-0011](../adr/0011-visibilidade-de-representante.md) (que optou por NÃO rastrear representante no MVP). Exige nova ADR que a supersede (ver Fase R0).

## Objetivo

O app será distribuído por uma rede de representantes comerciais em todo o Brasil. Quando um representante oferece o produto a uma oficina, a origem precisa ficar registrada; quando a oficina paga, o representante recebe comissão — em **%** ou em **R$ fixo**. Toda a política de comissão é configurável pelo painel admin, sem deploy.

Persona já prevista no produto: "Representante Comercial" ([PRD §3.3](../product/PRD-whatsapp-bot.md)) — vende peças e insumos para oficinas e quer "adicionar recorrência à comissão".

## Por que agora é barato

- A base de cálculo já existe: `pagamentos` registra cada mensalidade com `valor`, `status='pago'`, `paid_at`, idempotente por `mp_payment_id`.
- O billing é preferência avulsa mês a mês (ADR-0008/0013) — cada pagamento confirmado é um evento discreto. O webhook do Mercado Pago (`app/api/webhooks/mercado-pago/route.ts`) já aplica efeitos colaterais na confirmação (avança vencimento, reativa oficina); a geração de comissão entra no mesmo ponto.
- O elo lead→oficina (`leads_oficina.oficina_id` + `converted_at`) já existe — a atribuição só precisa se propagar por ele.
- O que falta é exclusivamente o elo de atribuição: hoje não há `representante_id` em lugar nenhum, só o enum `origem`.

## Decisões de política — todas configuráveis no painel admin

Nenhuma das decisões abaixo é hardcoded. Todas vivem em configuração editável em `/admin/configuracoes` (seção "Comissão de representantes"), com override por representante em `/admin/representantes`:

| Configuração | Opções | Default seedado | Exemplo de efeito |
|---|---|---|---|
| `comissao_tipo` | `percentual` \| `fixo` | `percentual` | 20% da mensalidade × R$ 15 por pagamento |
| `comissao_valor` | numérico | `20` | com tipo `percentual`, pagamento de R$ 59 gera R$ 11,80 |
| `comissao_duracao_meses` | inteiro ou vazio (vitalícia) | vazio | `12` = comissão só nos 12 primeiros pagamentos da oficina |
| `comissao_base` | `valor_pago` \| `preco_tabela` | `valor_pago` | com `valor_pago`, oficina com `preco_negociado` de R$ 40 gera comissão sobre 40, não sobre o `preco_base` de 59 |

Regras de resolução (mesmo padrão de `preco_negociado ?? preco_base`):

1. Override do representante (`representantes.comissao_*`), quando preenchido.
2. Senão, o default global da configuração.
3. A regra é **congelada no momento do pagamento** (snapshot em `comissoes`): mudar a configuração depois não altera comissões já geradas.

> Risco aceito de `comissao_base = 'preco_tabela'`: se o admin negociar preço abaixo da tabela, a comissão pode superar a receita do mês. A UI deve exibir esse aviso ao selecionar a opção.

## Modelo de atribuição

Três canais, do mais automático ao manual:

1. **Link único do representante.** Cada rep tem um `codigo` curto e único (ex.: `REP-CARLOS`) e divulga um link `wa.me` com a frase-gatilho + código: `Oi, quero testar o Quando Trocar #REP-CARLOS`. A extração do código é determinística (regex junto de `detectLeadOrigin()` em `lib/whatsapp/sales-agent.ts` — sem LLM, respeitando ADR-0001) e grava `leads_oficina.representante_id`. O código não aparece nas respostas do bot.
2. **Atribuição manual no admin.** Campo "Representante" no `OficinaEditModal`, no cadastro manual de oficina e na conversão manual de lead. Cobre o fechamento presencial/por telefone.
3. **Propagação na conversão.** As RPCs `convertLeadToOficina` e `convert_lead_to_oficina_manual` copiam `representante_id` do lead para a oficina. A oficina é a dona da atribuição dali em diante; admin pode corrigir com auditoria (`oficina.update_representante`).

## Ciclo de vida da comissão

```
(pagamento confirmado) → prevista → paga
                                  ↘ cancelada
```

- **Geração**: no `applySideEffects()` do webhook MP, quando `pagamentos.status` vira `pago` e a oficina tem `representante_id`, cria-se uma linha em `comissoes` com snapshot da regra vigente. Idempotente por `comissoes.pagamento_id UNIQUE` (mesmo padrão do `mp_payment_id`). Respeita `duracao_meses` contando pagamentos pagos anteriores da oficina.
- **Não bloqueante**: falha ao gerar comissão é logada mas nunca derruba o processamento do pagamento (mesmo princípio da confirmação ao cliente, regras §3.6).
- **Payout manual no MVP**: admin transfere ao rep por fora (Pix) e marca `paga` no painel (individual ou em lote por rep/mês), com auditoria. Split automático via Mercado Pago Marketplace fica fora de escopo (exige onboarding de cada rep na plataforma MP).
- **Cancelamento**: estorno/erro → admin marca `cancelada` (só permitido enquanto `prevista`).

## Escopo

Inclui:

- Tabela `representantes` + FKs de atribuição em `leads_oficina` e `oficinas`.
- Captura determinística de código de representante na primeira mensagem do lead.
- Geração automática de comissão na confirmação de pagamento (webhook MP).
- Configuração global de comissão em `/admin/configuracoes` + override por representante.
- CRUD de representantes, extrato de comissões e marcação de pagamento no painel admin.
- Card de comissão prevista no dashboard `/admin`.
- Nova ADR supersedendo a ADR-0011 e nova seção em `regras-de-negocio.md`.

Não inclui (futuro, mas o schema já suporta):

- Dashboard/login próprio do representante (padrão OTP já existe — seria um `rep_users` análogo a `admin_users`; responde a pergunta em aberto do PRD).
- Split automático de pagamento (MP Marketplace).
- Notificação WhatsApp ao rep quando ganhar comissão.
- Comissão sobre receita de retorno da oficina (só sobre mensalidade).
- Hierarquia de representantes / multinível.

---

## Fases de execução

### Fase R0 — Decisão e documentação (~0,5 dia)

- [x] ADR-0019 `representantes-e-comissao.md`: supersede ADR-0011; registra modelo de atribuição, política configurável, snapshot no pagamento, payout manual.
- [x] Nova seção "18. Representantes e comissão" em `docs/regras-de-negocio.md` (obrigatório pelo CLAUDE.md — mesma mudança que altera comportamento).
- [x] Registrar em `docs/CONTEXT_CHANGELOG.md`.

### Fase R1 — Schema e atribuição (~1–2 dias)

Migration única em `supabase/migrations/` (RLS habilitada em tudo, padrão ADR-0003):

- [x] `representantes`: `id uuid`, `nome`, `whatsapp` (E.164, único), `codigo text UNIQUE` (curto, case-insensitive), `comissao_tipo` nullable, `comissao_valor` nullable, `comissao_duracao_meses` nullable (null em tudo = usa default global), `ativo boolean`, `deleted_at` (soft delete, padrão de `oficinas`), timestamps.
- [x] `leads_oficina.representante_id uuid → representantes(id)` nullable.
- [x] `oficinas.representante_id uuid → representantes(id)` nullable.
- [x] `comissoes`: `id`, `representante_id`, `oficina_id`, `pagamento_id UNIQUE → pagamentos(id)`, `base_valor numeric(10,2)`, `tipo`, `taxa_aplicada numeric(10,2)`, `valor numeric(10,2)`, `status text` (`prevista | paga | cancelada`), `paga_em timestamptz`, timestamps.
- [x] `configuracoes_comissao`: singleton (mesmo padrão do unique index de `configuracoes_vendedor`) com `comissao_tipo`, `comissao_valor`, `comissao_duracao_meses`, `comissao_base`. Seed com os defaults da tabela acima.

Código:

- [x] Extração de `#REP-<codigo>` na primeira mensagem (`lib/whatsapp/sales-agent.ts`, junto de `detectLeadOrigin()`); código inválido/desconhecido ou rep inativo → ignora silenciosamente (lead entra sem atribuição).
- [x] Alterar RPCs `convertLeadToOficina` e `convert_lead_to_oficina_manual` para propagar `representante_id`.
- [x] Testes: parsing do código (com/sem código, código inválido, rep inativo, código no meio da frase), propagação nas duas conversões (exigência do CLAUDE.md para parsing/repository).

### Fase R2 — Motor de comissão (~1 dia)

- [x] `lib/admin/comissoes.ts` (`server-only`, funções recebendo `SupabaseClient` — padrão de `lib/admin/*`): `resolverRegraComissao(oficina)`, `gerarComissaoParaPagamento(pagamento)`, `listComissoes(filtros)`, `marcarPaga(s)`, `cancelar`.
- [x] Hook em `applySideEffects()` do webhook MP: pagamento `pago` + oficina com rep ativo → gera comissão. Try/catch isolado com log — nunca derruba o webhook.
- [x] Contagem de `duracao_meses`: número de pagamentos `pago` anteriores da oficina ≥ duração → não gera.
- [x] Testes: percentual, fixo, override do rep vs default global, `comissao_base` nas duas opções, duração expirada, oficina sem rep, rep inativo, webhook duplicado (idempotência), falha na geração não afeta o pagamento.

### Fase R3 — UI admin (~2–3 dias)

Padrão existente: server component `force-dynamic` → `*-client.tsx` em `components/admin/`; mutações via `app/api/admin/*` com `requireAdminApi()` + `withAdminAudit()`.

- [x] `/admin/representantes`: listagem + CRUD (nome, WhatsApp, código, ativo, override de comissão), botão "copiar link" gerando o `wa.me` pronto com frase-gatilho + código, contadores por rep (leads atribuídos, oficinas ativas, comissão acumulada). Soft delete com confirmação de nome (padrão de oficinas §2.6).
- [x] `/admin/configuracoes`: nova seção "Comissão de representantes" editando `configuracoes_comissao` (tipo, valor, duração, base de cálculo — com aviso ao escolher `preco_tabela`).
- [x] `/admin/comissoes`: extrato filtrável (rep, mês, status), totais previsto × pago no período, ação "marcar como paga" individual e em lote (por rep/mês), cancelar.
- [x] Campo "Representante" no `OficinaEditModal` e nos fluxos de cadastro/conversão manual (auditoria `oficina.update_representante`).
- [x] Card no dashboard `/admin`: comissão prevista no mês corrente, ao lado do MRR.
- [x] Rotas API: `GET/POST /api/admin/representantes`, `PATCH/DELETE /api/admin/representantes/[id]`, `PATCH /api/admin/configuracoes-comissao`, `POST /api/admin/comissoes/[id]/pagar|cancelar`, `POST /api/admin/comissoes/pagar-lote`.

### Fase R4 — Futuro (fora deste plano)

Dashboard do representante, split automático MP, notificação de comissão via WhatsApp, comissão multinível.

**Estimativa total (R0–R3): ~5–7 dias.**

## Dependências e riscos

- Nenhuma dependência externa nova — usa Mercado Pago, Supabase e o painel admin existentes.
- Migration altera duas RPCs transacionais em produção (`convertLeadToOficina`, `convert_lead_to_oficina_manual`) — seguir runbook de migrations e testar conversão fim a fim antes do deploy.
- Atribuição retroativa: oficinas já existentes ficam sem rep; admin pode atribuir manualmente (a comissão só vale para pagamentos **posteriores** à atribuição — não gerar retroativo).
- Código do rep vaza fácil (é público no link): risco aceito no MVP; disputa de atribuição se resolve manualmente pelo admin com auditoria.

## Critérios de aceite

1. Lead que chega com `#REP-X` na primeira mensagem nasce atribuído; ao converter, a oficina herda o rep.
2. Pagamento confirmado de oficina atribuída gera exatamente uma comissão com o valor da regra vigente (override > global), mesmo com webhook repetido.
3. Alterar a configuração global no painel muda apenas comissões futuras.
4. Admin consegue: cadastrar rep, copiar o link, ver extrato por rep/mês, marcar pagamento em lote — tudo auditado em `admin_audit_log`.
5. Falha na geração de comissão não impede a confirmação do pagamento nem a reativação de oficina inadimplente.
