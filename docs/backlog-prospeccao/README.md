# Backlog — Prospecção de oficinas ICP

Base:

- [`../architecture/prospeccao-icp-oficinas.md`](../architecture/prospeccao-icp-oficinas.md) — **canônico**. Plano técnico, restrições de compliance, modelo de dados.
- [`../../.context/modules/prospeccao/AGENTS.md`](../../.context/modules/prospeccao/AGENTS.md) — invariantes do módulo.
- [`../adr/0001-llm-como-conselheiro-nao-decisor.md`](../adr/0001-llm-como-conselheiro-nao-decisor.md) — LLM sugere, regra determinística decide.
- [`../adr/0025-portal-do-representante.md`](../adr/0025-portal-do-representante.md) e [`../adr/0030-link-de-indicacao-do-representante.md`](../adr/0030-link-de-indicacao-do-representante.md) — para onde o lead prospectado vai.

Stack: mesma do produto — Next.js 15 (App Router) + Supabase + Tailwind + Vercel.

## O que já existe (2026-08-08)

P1 e P2 do plano técnico estão entregues. **Guarulhos/SP está no banco:**

| | |
|---|---|
| Estabelecimentos ativos do ICP | 5.435 |
| Com telefone | 5.326 (98,0%) |
| Com celular — abordável por WhatsApp | 2.043 (37,6%) |
| Com e-mail | 5.173 (95,2%) |
| Com nome | 5.435 (100%) |
| Bairros distintos | 465 |

Todos com `status = 'descoberto'`. **Nada disso é utilizável ainda**: 5.435 linhas sem
ordenação e sem tela são um dump, não uma lista de trabalho. É o que as fases abaixo resolvem.

## Sub-fases

| # | Arquivo | Entrega | Depende de |
|---|---------|---------|------------|
| Prospec-1 | [prospec-1-score-icp.md](./prospec-1-score-icp.md) | Score ICP determinístico + fila `qualificado` | — |
| Prospec-2 | [prospec-2-admin-promocao.md](./prospec-2-admin-promocao.md) | Tela `/admin/prospeccao` + promoção a lead | Prospec-1 |
| Prospec-3 | [prospec-3-canal-email.md](./prospec-3-canal-email.md) | Canal de e-mail frio → WhatsApp | Prospec-2 |
| Prospec-4 | [prospec-4-google-places.md](./prospec-4-google-places.md) | Grid geográfico + sinais de vitalidade | Prospec-1 |
| Prospec-5 | [prospec-5-classificador-llm.md](./prospec-5-classificador-llm.md) | Classificação por LLM + recalibração do score | Prospec-2 |

Equivalência com a numeração do plano técnico (§11), que seguia ordem de desenho e não de
execução: Prospec-1 = P4, Prospec-2 = P5, Prospec-3 = novo, Prospec-4 = P3, Prospec-5 = P6.

## Ordem recomendada e por quê

1. **Prospec-1 e Prospec-2 primeiro.** Já existem 2.043 oficinas com celular e nome no banco.
   Ordenar e mostrar é o que transforma isso em trabalho comercial — e é barato. Ir para o
   Google Places antes seria melhorar a qualidade de um dado que ninguém consegue abrir.
2. **Prospec-3 (e-mail) na sequência.** 95% de cobertura contra 37,6% de celular: o e-mail
   alcança **2,5× mais oficinas** que o WhatsApp, e sem o risco ao número de produção. É o
   canal de maior alcance da base — mas o de montagem mais lenta (DNS, warm-up, reputação),
   então convém começar cedo mesmo que o volume só escale depois.
3. **Prospec-4 (Places) depois.** Agrega rating, reviews e horários — os sinais que separam
   "CNPJ ativo" de "oficina com movimento". Vira alavanca real de score, mas só depois que
   houver uma fila para ordenar e conversão para comparar.
4. **Prospec-5 por último.** Precisa de dado de conversão real para valer a pena.

Prospec-3 e Prospec-4 podem correr em paralelo — não se tocam.

## Pré-requisitos transversais

| Item | Status | Bloqueia | Notas |
|---|---|---|---|
| Base de Guarulhos ingerida | ✅ 2026-08-08 | tudo | Competência RFB 2026-07. |
| Decisão: varejo de peças (`4530703`) é ICP? | ⏳ **pendente, Anderson** | Prospec-1 | 1.451 registros, 27% da base. Hoje entra como categoria `medio`. Muda uma linha em `lib/prospeccao/cnaes.ts`. |
| Provedor de e-mail com AUP que permita cold B2B | ⏳ pendente | Prospec-3 | **Vários proíbem explicitamente** (Postmark, entre outros). Verificar antes de escrever código — ver Prospec-3 §E-0. |
| Domínio separado para envio + DNS (SPF/DKIM/DMARC) | ⏳ pendente | Prospec-3 | Nunca o domínio de produção — mesmo raciocínio do número WhatsApp. |
| Teste de legítimo interesse (LGPD) documentado | ⏳ pendente | Prospec-3 | Os e-mails são pessoais (57% gmail), não corporativos. Ver Prospec-3 §Compliance. |
| Google Maps API key + billing | ⏳ pendente | Prospec-4 | Cota gratuita cobre o piloto; confirmar SKUs no console. |
| Tabela `prospeccao_tiles` | ⏳ não criada | Prospec-4 | Prevista na §5 do plano técnico, deixada de fora da migration de P1 por não ter uso ainda. |
| `leads_oficina.origem` aceitar `'prospeccao'` | ⏳ pendente | Prospec-2 | Muda comportamento de produto → `docs/regras-de-negocio.md` no mesmo commit. |

## Convenções desta fase

- Toda mutação vinda da UI admin passa por `withAdminAudit` e registra ação em
  `admin_audit_log`, como no resto do painel.
- Nenhuma mudança de estado comercial (`status`, promoção a lead, envio de e-mail) pode
  depender de saída de LLM — [ADR-0001](../adr/0001-llm-como-conselheiro-nao-decisor.md).
- Nada de conteúdo do Google Places em coluna persistente: só `places_cache`, que expira
  (§2 do plano técnico).
- Scripts de operação em `scripts/prospeccao/`, rodados com `tsconfig.scripts.json`.
- Testes em `tests/prospeccao-*.test.ts`.
