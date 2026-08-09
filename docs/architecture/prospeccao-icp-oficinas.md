# Prospecção de oficinas ICP — descoberta geográfica e ingestão

- **Status**: P1 e P2 implementados; P3–P6 propostos (ver §11)
- **Data**: 2026-08-08
- **Autor**: estruturação técnica a pedido de Anderson Domingos
- **Piloto**: Guarulhos/SP
- **Módulo alvo**: `prospeccao` (novo — precisa ser declarado em `.context/modules/prospeccao/AGENTS.md`)
- **Relaciona-se com**: [ADR-0001](../adr/0001-llm-como-conselheiro-nao-decisor.md), [ADR-0003](../adr/0003-multi-tenancy-via-rls-oficina-id.md), [ADR-0025](../adr/0025-portal-do-representante.md), [ADR-0030](../adr/0030-link-de-indicacao-do-representante.md)

---

## 1. Objetivo

Construir uma base própria de oficinas candidatas ao ICP do Quando Trocar, segmentada por
**cidade/UF**, alimentada automaticamente, com deduplicação contra `leads_oficina` e `oficinas`,
e uma esteira de aprovação humana antes de qualquer abordagem.

Guarulhos/SP é o piloto: volume grande o bastante para exercitar o problema de cobertura
(≈1,4 mi habitantes, 318 km²) e pequeno o bastante para rodar inteiro dentro da cota gratuita.

**Fora de escopo deste documento:** a cadência de abordagem comercial e o conteúdo das mensagens.
Ver §8 para o risco que isso carrega.

---

## 2. A restrição que molda toda a arquitetura

Esta é a primeira decisão, e ela é do dono do produto — não é detalhe de implementação.

Os Termos do Google Maps Platform proíbem pré-buscar, cachear ou armazenar conteúdo do Places
fora de exceções estreitas:

- **`place_id` pode ser armazenado indefinidamente.** É a única exceção ampla.
- **Latitude/longitude** têm exceção temporária de até **30 dias corridos**, depois devem ser apagadas.
- **Nome, endereço, telefone, rating, horários, site** — não têm permissão geral de armazenamento
  persistente. Montar um cadastro próprio de estabelecimentos a partir do Places é exatamente o
  caso que a política endereça.

Consequência direta: **"buscar no Google Maps e salvar numa base de dados" não é implementável
como pedido literalmente sem violar o ToS.** Existem três caminhos honestos:

| Opção | Como funciona | Custo | Risco |
|---|---|---|---|
| **A — Places como índice volátil** | Persiste só `place_id` + os dados que *você* produz (score, status, resultado do contato). Nome/telefone são re-hidratados sob demanda via Place Details na hora de usar. | +1 chamada por uso | Nenhum. Compatível com ToS. |
| **B — Híbrido (recomendado)** | Places faz a **descoberta** e dá os **sinais de vitalidade** (existe, está operando, tem movimento). A **base persistente** é montada sobre dados públicos do CNPJ (Receita Federal). | Baixo | Nenhum. Dado da RFB é público e persistível. |
| **C — Persistir tudo do Places** | O que foi pedido literalmente. | Baixo | Violação de ToS: suspensão da API key, e a base fica sem lastro legal. |

**Decidido: opção B** (Anderson, 2026-08-08). Não é só compliance — é melhor produto. O cadastro
da Receita traz o CNAE, que *é* a definição de ICP em formato de dado estruturado:

| CNAE | Descrição | Relevância p/ Quando Trocar |
|---|---|---|
| 4520-0/01 | Manutenção e reparação mecânica de veículos | **Núcleo do ICP** |
| 4520-0/05 | Lavagem, lubrificação e polimento | **Núcleo** (troca de óleo mora aqui) |
| 4520-0/04 | Alinhamento e balanceamento | Alto (retorno previsível) |
| 4520-0/03 | Manutenção e reparação elétrica | Médio |
| 4520-0/07 | Instalação/manutenção de acessórios | Médio |
| 4520-0/02 | Funilaria e pintura | Baixo (serviço sem retorno previsível) |
| 4520-0/06 | Borracharia | Baixo |
| 4511-1/01/02 | Comércio de automóveis | **Excluir** (concessionária ≠ ICP) |

A RFB dá também: razão social, nome fantasia, endereço completo com município/UF/CEP, DDD+telefone,
situação cadastral (ativa/baixada/suspensa), data de abertura, porte, opção pelo Simples/MEI.
Consulta por município + CNAE resolve a segmentação Cidade/UF nativamente, sem grid geográfico.

O que a RFB **não** dá e o Places dá: se o estabelecimento está de fato vivo e com movimento
(reviews recentes, rating, horários, fotos), telefone atualizado, e se tem site próprio
(proxy invertido de maturidade digital — quem não tem site sente mais a dor que vendemos).

---

## 3. Arquitetura

```
                    ┌──────────────────────────────────────┐
                    │  Camada de fontes (adapters)         │
                    │                                      │
  RFB / CNPJ ──────►│  cnpj-source.ts    (persistível)     │
  Google Places ───►│  places-source.ts  (volátil, TTL)    │
                    └──────────────┬───────────────────────┘
                                   │  EstabelecimentoBruto
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │  Pipeline (estados na tabela, retomável)         │
        │  descoberto → normalizado → deduplicado          │
        │            → qualificado  → aprovado → promovido │
        └──────────────┬───────────────────────────────────┘
                       │
                       ▼
   prospeccao_estabelecimentos ──(aprovação humana)──► leads_oficina (origem='prospeccao')
```

Cada estágio é idempotente e reentrante: reprocessar um estabelecimento no mesmo estágio não
duplica nada e não perde trabalho já feito. Isso não é preciosismo — uma cidade são centenas de
chamadas de rede, e a coisa *vai* cair no meio.

### 3.1 Camadas (segue `.context/conventions.md`)

```
app/api/internal/prospeccao-run/route.ts   ← cron, protegida por segredo
app/admin/(autenticado)/prospeccao/        ← UI de revisão e aprovação
lib/prospeccao/
  types.ts               contratos (EstabelecimentoBruto, ScoreICP, …)
  places-client.ts       Google Places API (New) — só descoberta e sinais
  cnpj-client.ts         Receita Federal / BrasilAPI — base persistível
  grid.ts               cobertura geográfica adaptativa (§4)
  normalize.ts           telefone → E.164, endereço, nome canônico
  dedupe.ts              contra a própria base + leads_oficina + oficinas
  scoring.ts             regra ICP determinística e versionada
  classifier.ts          LLM opcional, Structured Output (§6.3)
  repository.ts          persistência Supabase
  runner.ts              orquestra o pipeline, processa N itens por invocação
lib/admin/prospeccao.ts  domínio+dados da UI admin
scripts/prospeccao/run.ts  execução local para o piloto (tsconfig.scripts.json)
```

`lib/admin/phone.ts` e `lib/admin/format-phone-br.ts` já existem — reaproveitar, não reescrever.

---

## 4. Cobertura geográfica — o problema real do Google Places

A parte não óbvia. **Nearby Search (New) devolve no máximo 20 resultados por chamada e não
suporta paginação** (`pageToken` não existe nessa API). Text Search (New) suporta `pageToken`,
mas para em 60 resultados. Guarulhos tem ordem de milhares de estabelecimentos automotivos.

Uma busca por "oficina em Guarulhos" devolve 60 resultados e cria a ilusão de cobertura. Não é
cobertura — é o topo do ranking.

### 4.1 Grid adaptativo com raio de garantia

A solução é varrer o município em círculos, e a API dá um truque que evita subdividir às cegas:
com `rankPreference: DISTANCE`, os resultados voltam ordenados por distância do centro.

```
para cada tile (centro, raio):
  resposta = nearbySearch(centro, raio, includedTypes, maxResultCount=20, rank=DISTANCE)

  se resposta.length < 20:
      → o círculo foi varrido por completo. tile FECHADO.

  se resposta.length == 20:
      d = distância(centro, resposta[19])           # o 20º resultado
      → tudo dentro de raio d está garantidamente coberto
      → tile SATURADO: subdivide em 4 filhos de raio/2 e reenfileira
```

Sem o `DISTANCE`, um tile saturado não diz nada sobre onde a varredura parou. Com ele, cada
chamada sempre produz cobertura verificável — nada é jogado fora.

O grid inicial cobre a bbox do município (IBGE publica as malhas municipais) com raio de 2 km,
descartando tiles cujo centro cai fora do polígono. Oficinas se concentram em corredores viários,
então a maioria dos tiles fecha na primeira chamada e só os densos subdividem.

### 4.2 Multiplicidade de tipos e o passe de texto

Uma varredura só por `car_repair` perde estabelecimento mal categorizado no Google — e isso é
comum em oficina de bairro. Duas passadas complementares:

1. **Por tipo**: `car_repair` (principal), `car_wash`, `auto_parts_store`. Excluir `car_dealer`
   na qualificação, não na busca — concessionária às vezes está marcada como `car_repair`.
   *A lista de tipos do Places muda; validar contra a doc antes de implementar.*
2. **Por texto** (Text Search, até 60 por query): "troca de óleo", "auto center", "mecânica
   diesel", "auto elétrica", "retífica de motor" + nome do bairro. Pega o que a taxonomia perde.

Deduplicação por `place_id` faz as duas passadas convergirem sem duplicar.

### 4.3 Custo — field mask em dois estágios

O Places (New) cobra por SKU conforme os campos pedidos no `X-Goog-FieldMask`. Pedir tudo na
descoberta multiplica o custo por nada. Dois estágios:

| Estágio | Field mask | SKU | Quando |
|---|---|---|---|
| **Descoberta** | `places.id`, `places.location`, `places.displayName`, `places.types`, `places.businessStatus` | Essentials/Pro | Todo tile |
| **Detalhe** | `+ nationalPhoneNumber`, `websiteUri`, `regularOpeningHours`, `rating`, `userRatingCount` | Enterprise | Só candidatos aprovados no filtro barato |

Estimativa para Guarulhos (grid adaptativo a partir de 2 km):

| Item | Ordem de grandeza |
|---|---|
| Tiles de descoberta | 150–400 chamadas |
| Queries de texto | 30–60 chamadas |
| Place Details | 300–800 chamadas |

Cota gratuita atual: **10K chamadas/SKU/mês no Essentials, 5K no Pro, 1K no Enterprise**. O piloto
inteiro cabe no gratuito; o Enterprise (Details) é o SKU que aperta primeiro ao escalar para
outras cidades — mais uma razão para a base persistente vir do CNPJ.
*Preços e cotas mudam: confirmar no console antes de estimar orçamento real.*

---

## 5. Modelo de dados

Todas as tabelas são internas (admin/service-role). **RLS habilitada sem policy para
`anon`/`authenticated`** — negação por padrão. Rodar `get_advisors` depois do DDL
(ver `.context/lessons/0001-security-definer-grants-vazam.md`).

```sql
-- Área de trabalho: a unidade de segmentação pedida (Cidade/UF)
create table public.prospeccao_areas (
  id            uuid primary key default gen_random_uuid(),
  cidade        text not null,
  uf            char(2) not null,
  codigo_ibge   text null,
  bbox          jsonb null,           -- {min_lat,min_lng,max_lat,max_lng}
  status        text not null default 'pendente'
                check (status in ('pendente','descobrindo','descoberta','pausada','concluida')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cidade, uf)
);

-- Fila de varredura geográfica (§4.1). É a fila de trabalho: retomável por construção.
create table public.prospeccao_tiles (
  id            uuid primary key default gen_random_uuid(),
  area_id       uuid not null references public.prospeccao_areas(id) on delete cascade,
  parent_id     uuid null references public.prospeccao_tiles(id) on delete cascade,
  center_lat    double precision not null,
  center_lng    double precision not null,
  radius_m      integer not null check (radius_m between 50 and 50000),
  tipo_busca    text not null,        -- 'car_repair' | 'text:troca de óleo' | …
  status        text not null default 'pendente'
                check (status in ('pendente','processando','fechado','saturado','erro')),
  result_count  integer null,
  raio_coberto_m integer null,        -- distância do 20º resultado (§4.1)
  tentativas    integer not null default 0,
  erro          text null,
  processed_at  timestamptz null,
  created_at    timestamptz not null default now()
);
create index on public.prospeccao_tiles (area_id, status, created_at);

-- Execuções: custo e observabilidade
create table public.prospeccao_execucoes (
  id                uuid primary key default gen_random_uuid(),
  area_id           uuid not null references public.prospeccao_areas(id) on delete cascade,
  iniciada_em       timestamptz not null default now(),
  finalizada_em     timestamptz null,
  tiles_processados integer not null default 0,
  chamadas_api      jsonb not null default '{}'::jsonb,  -- {nearby: n, details: n, text: n}
  descobertos       integer not null default 0,
  novos             integer not null default 0,
  erro              text null
);

-- O estabelecimento. ATENÇÃO à §2: as colunas do Places são cache com TTL, não cadastro.
create table public.prospeccao_estabelecimentos (
  id                  uuid primary key default gen_random_uuid(),
  area_id             uuid not null references public.prospeccao_areas(id),

  -- chaves permanentes (armazenáveis indefinidamente)
  google_place_id     text null unique,
  cnpj                text null unique,

  -- cadastro persistível: origem Receita Federal
  razao_social        text null,
  nome_fantasia       text null,
  cnae_principal      text null,
  cnae_secundarios    text[] not null default '{}',
  situacao_cadastral  text null,
  data_abertura       date null,
  porte               text null,
  logradouro          text null,
  numero              text null,
  bairro              text null,
  cidade              text not null,
  uf                  char(2) not null,
  cep                 text null,
  telefone_rfb        text null,

  -- cache Places: NÃO é fonte de verdade. Expira (§2).
  places_cache        jsonb null,
  places_cached_at    timestamptz null,

  -- dado próprio: nasce aqui, persiste sem restrição
  score_icp           integer null check (score_icp between 0 and 100),
  score_versao        text null,
  score_motivos       jsonb not null default '[]'::jsonb,
  classificacao       text null,      -- 'mecanica' | 'auto_center' | 'troca_oleo' | …
  classificacao_origem text null check (classificacao_origem in ('regra','llm','humano')),
  telefone_e164       text null check (telefone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  telefone_movel      boolean null,
  status              text not null default 'descoberto'
                      check (status in ('descoberto','qualificado','descartado',
                                        'aprovado','promovido','duplicado')),
  motivo_descarte     text null,
  duplicado_de        uuid null references public.prospeccao_estabelecimentos(id),
  lead_id             uuid null references public.leads_oficina(id),
  revisado_por        uuid null,
  revisado_em         timestamptz null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.prospeccao_estabelecimentos (cidade, uf, status, score_icp desc);
create index on public.prospeccao_estabelecimentos (telefone_e164) where telefone_e164 is not null;
create index on public.prospeccao_estabelecimentos (status) where status = 'aprovado';
```

Mudanças em tabela existente:

```sql
-- nova origem de lead vinda da prospecção
alter table public.leads_oficina drop constraint leads_oficina_origem_check;
alter table public.leads_oficina add constraint leads_oficina_origem_check
  check (origem in ('landing_page','manual_whatsapp','prospeccao'));
```

Isso muda comportamento de produto → **`docs/regras-de-negocio.md` precisa ser atualizado no mesmo
commit** (nova origem de lead, novo caminho de entrada no funil).

### 5.1 Expiração do cache Places

Um cron diário limpa o que passou do prazo, mantendo intactas as chaves permanentes e o dado
próprio:

```sql
update public.prospeccao_estabelecimentos
   set places_cache = null, places_cached_at = null
 where places_cached_at < now() - interval '30 days';
```

Sem isso, a §2 vira letra morta e a arquitetura passa a ser a opção C sem ninguém ter decidido.

---

## 6. Pipeline

### 6.1 Normalização

- **Telefone**: DDD+número → E.164 (`+55DDDNNNNNNNNN`), **restaurando o nono dígito**. A base da
  RFB é anterior a 2016 e nunca foi migrada: em Guarulhos, *zero* dos 3.038 registros tinha 9
  dígitos, e 1.090 (36%) eram móveis legados de 8 dígitos. Gravar como veio produz número que não
  existe mais. Regra: 8 dígitos iniciando em 6-9 → móvel, prefixa `9`; iniciando em 2-5 → fixo.
  Fixo não é descartado, mas é sinal fraco para abordagem por mensagem.
  Ver [lição 0004](../../.context/lessons/0004-rfb-nao-tem-o-nono-digito.md).
- **Endereço**: preferir os componentes estruturados da RFB ao `formattedAddress` do Places.
- **Nome canônico**: lowercase, sem acento, sem sufixo societário (ltda, me, epp, eireli),
  colapsando espaços. É a chave de fuzzy match do dedupe.

### 6.2 Deduplicação

Em cascata, do sinal mais forte para o mais fraco:

1. `google_place_id` igual → mesmo estabelecimento.
2. `cnpj` igual → mesmo estabelecimento.
3. `telefone_e164` igual → mesmo estabelecimento (oficina raramente compartilha número).
4. Distância < 80 m **e** similaridade de nome canônico > 0,7 (`pg_trgm`) → provável duplicata,
   marca `duplicado` e manda para revisão humana em vez de decidir sozinho.

E o cruzamento que evita o vexame de prospectar quem já é cliente: `telefone_e164` contra
`leads_oficina.whatsapp` e `oficinas.whatsapp_principal` — match vira `descartado` com motivo
`ja_e_lead` / `ja_e_cliente`.

### 6.3 Qualificação ICP

Regra determinística e **versionada** (`score_versao`), para que rodar de novo com regra nova seja
auditável em vez de virar mistério. Proposta inicial — os pesos são chute informado e devem ser
recalibrados contra a taxa de conversão real depois do primeiro lote:

| Sinal | Peso | Racional |
|---|---|---|
| CNAE 4520-0/01 ou /05 | +30 | É a definição do ICP |
| CNAE 4520-0/04 ou /03 | +15 | Retorno previsível |
| Situação cadastral ativa | +15 | Baixada é ruído puro |
| `businessStatus = OPERATIONAL` | +10 | Vivo hoje |
| `userRatingCount` ≥ 10 | +10 | Proxy de fluxo de clientes |
| `userRatingCount` ≥ 50 | +5 | Volume que justifica recorrência |
| `rating` ≥ 3,8 | +5 | Oficina que trata bem tem base para reter |
| Telefone móvel | +10 | Viabiliza WhatsApp |
| Sem `websiteUri` | +5 | Baixa maturidade digital = dor maior |
| Horários declarados | +5 | Perfil ativo, gerenciado |
| CNAE de concessionária / locadora | **descarta** | Não é ICP |
| CNAE principal fora do domínio automotivo | **descarta** | Transportadora, estacionamento e despachante com mecânica no secundário cuidam da própria frota — sem cliente final, não há retorno para agendar. Eram 18% do primeiro lote de Guarulhos. Exceção: posto de combustível (`4731800`), que faz troca de óleo de verdade. |
| CNAE só funilaria / borracharia / lava-rápido | −20 | Serviço sem retorno previsível |
| Nome casa com rede/franquia conhecida | −15 | Decisão de compra não é local |
| Situação baixada/suspensa | **descarta** | — |

Corte sugerido para o piloto: **≥ 60 vai para revisão** (`qualificado`), abaixo disso
`descartado` com motivo. Corte alto no começo: é melhor revisar 200 boas do que 1.500 duvidosas.

### 6.4 Classificação por LLM (opcional, estágio 2)

Nome fantasia é texto livre — "JR Auto Center", "Mecânica do Zé Diesel", "Oficina 24h Reboque".
Regra por palavra-chave erra. Um classificador com Structured Output resolve, **respeitando
ADR-0001**: enum fechado, `strict: true`, resultado gravado com `classificacao_origem = 'llm'` +
confiança, e **sem poder de mudar `status`**. Ele sugere a classificação; a promoção a lead
continua sendo ato humano (§7). Chamada em lote, só sobre quem já passou do corte de score.

---

## 7. Aprovação e promoção a lead

Nada é promovido automaticamente. `/admin/prospeccao` mostra a fila `qualificado` ordenada por
score, com filtro por cidade/UF/CNAE/score, e as ações **Aprovar** / **Descartar** (com motivo).
Aprovar cria o `leads_oficina` com `origem = 'prospeccao'`, `status = 'novo'`, e opcionalmente já
com `representante_id` — encaixa direto no fluxo do [ADR-0030](../adr/0030-link-de-indicacao-do-representante.md).
Registrar em `audit_actions` (`prospeccao.aprovar` / `prospeccao.descartar`).

O gargalo humano é proposital. O custo de errar aqui não é uma linha errada no banco — é o §8.

---

## 8. Risco operacional: como esses leads são abordados

Precisa estar escrito, porque é o maior risco do projeto inteiro e não está no código.

Uma lista de números que nunca pediram contato, disparada pelo número de produção do WhatsApp,
é o caminho mais rápido para derrubar o *quality rating* da Meta e, no limite, perder o número —
o mesmo número por onde os lembretes dos clientes das oficinas ativas passam. O ativo operacional
do produto seria posto em risco por uma ação de marketing.

**Decidido (Anderson, 2026-08-08): os três caminhos abaixo estão liberados; o número de
produção está fora.**

1. **Representante humano** — a lista abastece o portal do representante ([ADR-0025](../adr/0025-portal-do-representante.md)),
   que liga ou visita. Contato quente, zero risco de número, e já existe a estrutura.
2. **Número separado de prospecção** — WABA distinta. Se queimar, queima isolada.
3. **Público de anúncios** — a lista vira Custom Audience de Meta Ads e o lead chega por
   Click-to-WhatsApp, ou seja, **ele inicia a conversa**. Já existe atribuição de anúncio em
   `leads_oficina` (`ad_ctwa_clid`, `ad_id`) — o encaixe é natural.

Sobre LGPD: dado de PJ tem tratamento mais folgado, mas MEI e EI carregam CPF no CNPJ e o contato
pode ser pessoa natural. O mínimo exigível: registrar a origem do dado (já está no modelo),
honrar opt-out imediato e não usar a base para nada além de prospecção B2B.

---

## 9. Execução

**Piloto (Guarulhos)** — CLIs locais com service role, seguindo o padrão que o projeto já tem
(`scripts/whatsapp/eval.ts`, `tsconfig.scripts.json`). Iteração rápida, sem timeout de
serverless, fácil de inspecionar:

```bash
scripts/prospeccao/baixar-rfb.sh 2026-07 6477                 # ~5,3 GB, streaming
npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477 --dry-run
npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477
scripts/prospeccao/baixar-rfb-empresas.sh 2026-07 6477        # ~1,3 GB, razão social + porte
npm run prospeccao:ingerir -- --cidade Guarulhos --uf SP --municipio 6477
```

Os arquivos da RFB não têm filtro server-side: os ~20 GB de CSV são varridos em streaming
(`unzip -p | grep`), sem nunca tocar o disco descomprimidos, e cada zip é apagado depois de
filtrado — pico de disco de ~2,2 GB. O código do município é o da **RFB**, não o do IBGE.

O passo de Empresas parece opcional e não é: apenas **27%** dos estabelecimentos têm nome
fantasia. A razão social dos outros 73% só existe naquele arquivo, e sem ela a lista chega ao
vendedor com "(sem nome)" em três de cada quatro linhas. Em compensação, **95% têm e-mail** —
um canal de abordagem que não carrega nenhum dos riscos do WhatsApp da §8.

**Produção** — `app/api/internal/prospeccao-run/route.ts` protegida por segredo (mesmo padrão de
`app/api/internal/*`), chamada por Supabase Cron a cada N minutos, consumindo um lote fixo de
tiles/estabelecimentos pendentes por invocação. Como o estado vive nas tabelas, a execução é
naturalmente retomável e o custo por invocação é limitado.

Rate limit e retry com backoff exponencial no cliente do Places; `tentativas` na tabela evita
loop infinito em tile que sempre falha.

---

## 10. Testes (Vitest, `tests/`)

- `grid.test.ts` — subdivisão: tile com 20 resultados subdivide em 4; com 19 fecha; raio coberto
  calculado a partir do 20º resultado.
- `normalize-prospeccao.test.ts` — telefones BR (fixo, móvel, com/sem 9, DDD colado), sufixos
  societários, endereço sem número.
- `dedupe.test.ts` — cascata place_id → cnpj → telefone → fuzzy; cruzamento com lead/oficina
  existentes.
- `scoring.test.ts` — casos-limite do corte, descartes duros (concessionária, situação baixada),
  estabilidade do score entre versões.
- `prospeccao-repository.test.ts` — upsert por `google_place_id` e por `cnpj` é idempotente;
  reprocessar não duplica nem regride status.
- `classifier.test.ts` — shape do Structured Output, null handling, e que a saída do LLM **não**
  altera `status` (ADR-0001).

---

## 11. Fases sugeridas

| Fase | Entrega | Estado |
|---|---|---|
| P0 | Decisões da §2 e §8 | ✅ decidido em 2026-08-08 |
| P1 | Migration + módulo `.context/modules/prospeccao/` + tipos | ✅ `20260808180000_prospeccao_base.sql` |
| P2 | Fonte CNPJ + normalização + dedupe. Guarulhos carregada e deduplicada. | ✅ 5.435 estabelecimentos |

**As fases seguintes viraram backlog executável:
[`docs/backlog-prospeccao/`](../backlog-prospeccao/README.md)**, renumeradas na ordem de
execução recomendada (esta seção seguia a ordem de desenho):

| Backlog | Equivale a | Entrega |
|---|---|---|
| [Prospec-1](../backlog-prospeccao/prospec-1-score-icp.md) | P4 | Score ICP + fila de revisão |
| [Prospec-2](../backlog-prospeccao/prospec-2-admin-promocao.md) | P5 | `/admin/prospeccao` + promoção a lead |
| [Prospec-3](../backlog-prospeccao/prospec-3-canal-email.md) | novo | Canal de e-mail frio → WhatsApp |
| [Prospec-4](../backlog-prospeccao/prospec-4-google-places.md) | P3 | Grid adaptativo + sinais de vitalidade |
| [Prospec-5](../backlog-prospeccao/prospec-5-classificador-llm.md) | P6 | Classificador LLM + recalibração |

Score e painel vêm antes do Places porque já existem 5.435 estabelecimentos no banco que
ninguém consegue abrir — melhorar a qualidade de um dado inacessível não entrega nada. E o
e-mail (95% de cobertura contra 37,6% de celular) entrou como fase própria: é o canal de maior
alcance da base e o de montagem mais lenta.

Ao chegar em P5, a promoção a lead exige soltar o `check` de `leads_oficina.origem` para
aceitar `'prospeccao'` — e isso é mudança de comportamento de produto, então
`docs/regras-de-negocio.md` entra no mesmo commit.

---

## 12. Questões em aberto

1. ~~**§2 — postura de compliance.**~~ Decidido: opção B (híbrido).
2. ~~**§8 — canal de abordagem.**~~ Decidido: representante humano, público de anúncios e número
   separado. O número de produção está fora.
3. ~~**Fonte do CNPJ.**~~ Decidido: dump da RFB filtrado por município. Sem custo, sem limite de
   taxa, e a competência mensal é fresca o bastante para prospecção.
4. **Pesos do score** (§6.3) são chute informado. Recalibrar contra conversão real após o
   primeiro lote — antes disso, o corte de 60 é arbitrário.
5. **Cadência de reingestão**: a RFB publica mensalmente. Reingerir todo mês mantém situação
   cadastral e telefone atualizados, mas ainda não há cron para isso (hoje é manual).
