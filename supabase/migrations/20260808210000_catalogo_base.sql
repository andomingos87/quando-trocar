-- ============================================================================
-- F1 do pivot do catalogo de servicos — fundacao de dados.
--
-- Plano: docs/backlog-catalogo-servicos/README.md (F1)
-- ADRs:  0031 (catalogo aberto de servicos e produtos)
--        0033 (cadencia por km — as colunas `base`/`intervalo_km` nascem aqui,
--              a conversao km->data so entra na F3)
--
-- Contrato desta fase: NENHUMA mudanca de comportamento observavel. Esta
-- migration cria as tabelas do catalogo, semeia os 4 itens globais espelhando
-- exatamente `tipos_servico_default` (mesma cadencia, mesmos templates) e
-- vincula os `servicos` existentes. Quem passa a LER o catalogo e a migration
-- seguinte (`catalogo_rpcs`) — e, por o seed ser um espelho, o resultado
-- continua identico.
--
-- Ordem importa: aplicar esta ANTES de `catalogo_rpcs`.
-- ============================================================================

-- `vector` (embeddings, mesma infra da FAQ semantica CV5) e `pg_trgm`
-- (similaridade por trigrama) ja estao instaladas; os creates sao idempotentes
-- e deixam a migration auto-contida (licao 0002: deploy corre na frente das
-- migrations, entao nenhuma migration pode depender da ordem de outra feature).
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Normalizacao de texto — base do dedupe determinístico (ADR-0031 §3.1)
-- ---------------------------------------------------------------------------
-- Sem acento, caixa baixa, pontuacao virando espaco. IMMUTABLE de proposito:
-- e usada em comparacao dentro do `match_servicos_catalogo` e pode entrar em
-- indice de expressao no futuro. Nao faz stemming de plural — "oleos"/"oleo"
-- e caso do passo de trigrama, que resolve isso com folga; stemming ingenuo
-- em portugues erra ("gas" -> "ga").
create or replace function public.catalogo_normalize_texto(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select nullif(
    trim(
      regexp_replace(
        lower(
          translate(
            coalesce(p_texto, ''),
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
            'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
          )
        ),
        '[^a-z0-9]+', ' ', 'g'
      )
    ),
    ''
  );
$$;

comment on function public.catalogo_normalize_texto(text) is
  'Normaliza texto para dedupe do catalogo (ADR-0031 §3.1): sem acento, caixa baixa, pontuacao -> espaco.';

-- Slug canonico a partir do nome. Mesma normalizacao, espaco -> hifen.
create or replace function public.catalogo_slugify(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select replace(public.catalogo_normalize_texto(p_texto), ' ', '-');
$$;

comment on function public.catalogo_slugify(text) is
  'Slug canonico de item de catalogo (normalize + espaco -> hifen).';

-- Funcao em `public` recebe EXECUTE de anon/authenticated por default no
-- Supabase. Estas sao helpers internas — revogar nominalmente (licao 0001:
-- revogar de `public` nao remove os grants explicitos dos roles).
revoke all on function public.catalogo_normalize_texto(text) from public, anon, authenticated;
revoke all on function public.catalogo_slugify(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- servicos_catalogo — O QUE FOI FEITO (gera cadencia). ADR-0031 §1
-- ---------------------------------------------------------------------------
-- Escopo duplo: `oficina_id is null` = item GLOBAL (seed curado por nos, entrega
-- valor no minuto zero); `oficina_id` preenchido = item daquela oficina.
create table if not exists public.servicos_catalogo (
  id                uuid primary key default gen_random_uuid(),
  oficina_id        uuid null references public.oficinas(id) on delete cascade,
  slug              text not null,
  nome              text not null,
  -- `tipo_servico` de ontem vira `familia` (ADR-0031 §2): derivada, nunca mais
  -- informada direto. Sustenta os cards de /admin/inteligencia-mercado e o
  -- fallback de copy quando o item nao tiver `produto_label` utilizavel.
  familia           text not null
                    check (familia in ('troca_oleo', 'amortecedor', 'revisao', 'outro')),
  -- Substantivo curto que entra como parametro de template ({{4}} do
  -- `lembrete_servico`). Guardrail P0-2 revisado (ADR-0031 §5): so texto ja
  -- canonizado no catalogo vira parametro — nunca a fala crua da oficina.
  produto_label     text null check (produto_label is null or length(produto_label) <= 40),
  aliases           text[] not null default '{}',
  embedding         extensions.vector(1536),
  base              text not null default 'tempo' check (base in ('tempo', 'km', 'ambos')),
  intervalo_dias    int null check (intervalo_dias between 7 and 3650),
  intervalo_km      int null check (intervalo_km between 500 and 300000),
  -- null = usa o template generico (`lembrete_servico`). Os 4 itens do seed
  -- fixam os templates ja aprovados da ADR-0014, entao nada depende da
  -- aprovacao do generico para funcionar hoje (ADR-0031 §6).
  template_name     text null,
  template_language text not null default 'pt_BR',
  origem            text not null default 'seed'
                    check (origem in ('seed', 'admin', 'oficina', 'agente')),
  -- Item default da familia dentro do escopo. E o que torna deterministica a
  -- ponte "familia -> item" que a F1 usa (a F2 passa o `catalogo_id` explicito).
  padrao_familia    boolean not null default false,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Coerencia base <-> intervalo. `km` sem `intervalo_dias` e valido: a
  -- cadencia cai no proximo nivel da cascata ate a F3 converter km em data.
  constraint servicos_catalogo_intervalo_check check (
    (base = 'tempo' and intervalo_dias is not null)
    or (base = 'km' and intervalo_km is not null)
    or (base = 'ambos' and intervalo_dias is not null and intervalo_km is not null)
  )
);

comment on table public.servicos_catalogo is
  'Catalogo aberto de servicos (ADR-0031). oficina_id null = item global; preenchido = item da oficina.';
comment on column public.servicos_catalogo.produto_label is
  'Substantivo curto usado como parametro de template ({{4}}). Unica fonte permitida de texto de servico em template (ADR-0031 §5).';
comment on column public.servicos_catalogo.template_name is
  'null = template generico lembrete_servico. Itens do seed fixam os templates da ADR-0014.';
comment on column public.servicos_catalogo.padrao_familia is
  'Item default da familia no escopo. Usado pela ponte familia->item enquanto o cadastro nao envia catalogo_id (F1).';

-- Unicidade de slug por escopo. `uuid` nulo tratado como o UUID zero para que
-- o indice unico funcione com `oficina_id is null` (literal em vez de
-- extensions.uuid_nil(): evita dependencia de extensao dentro do indice).
create unique index if not exists servicos_catalogo_escopo_slug_idx
  on public.servicos_catalogo (
    coalesce(oficina_id, '00000000-0000-0000-0000-000000000000'::uuid),
    slug
  );

-- No maximo um item default por familia em cada escopo.
create unique index if not exists servicos_catalogo_padrao_familia_idx
  on public.servicos_catalogo (
    coalesce(oficina_id, '00000000-0000-0000-0000-000000000000'::uuid),
    familia
  )
  where padrao_familia;

create index if not exists servicos_catalogo_oficina_idx
  on public.servicos_catalogo (oficina_id);

create index if not exists servicos_catalogo_familia_idx
  on public.servicos_catalogo (familia, ativo);

-- HNSW funciona em tabela vazia/pequena (sem etapa de treino do IVFFlat) —
-- mesmo padrao de `faq_vendas_embedding_hnsw_idx`.
create index if not exists servicos_catalogo_embedding_hnsw_idx
  on public.servicos_catalogo using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists servicos_catalogo_nome_trgm_idx
  on public.servicos_catalogo using gin (nome extensions.gin_trgm_ops);

create index if not exists servicos_catalogo_aliases_idx
  on public.servicos_catalogo using gin (aliases);

-- ---------------------------------------------------------------------------
-- produtos_catalogo — O QUE FOI USADO (peca/produto; dado de mercado)
-- ---------------------------------------------------------------------------
-- Escopo global de proposito: "Perfect" e Perfect para toda oficina, e e essa
-- consolidacao que vira base de dados de mercado (ADR-0031 §1).
create table if not exists public.produtos_catalogo (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  nome          text not null,
  marca         text null,
  modelo        text null,
  especificacao text null,
  familia       text not null
                check (familia in ('troca_oleo', 'amortecedor', 'revisao', 'outro')),
  embedding     extensions.vector(1536),
  origem        text not null default 'seed'
                check (origem in ('seed', 'admin', 'oficina', 'agente')),
  ativo         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.produtos_catalogo is
  'Catalogo global de produtos/pecas (ADR-0031 §1). Consolida marca/modelo/especificacao para inteligencia de mercado.';

create index if not exists produtos_catalogo_familia_idx
  on public.produtos_catalogo (familia, ativo);

create index if not exists produtos_catalogo_embedding_hnsw_idx
  on public.produtos_catalogo using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists produtos_catalogo_nome_trgm_idx
  on public.produtos_catalogo using gin (nome extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- RLS: service-role only, mesmo padrao de `tipos_servico_default`
-- ---------------------------------------------------------------------------
-- Sem policy = negacao por default para anon/authenticated. A leitura pelo
-- painel da oficina entra na F4, com a policy correspondente.
alter table public.servicos_catalogo enable row level security;
alter table public.produtos_catalogo enable row level security;

-- ---------------------------------------------------------------------------
-- Vinculo do operacional com o catalogo
-- ---------------------------------------------------------------------------
-- Nulavel nesta fase: o backfill abaixo cobre 100% das linhas existentes e o
-- RPC recriado na proxima migration passa a preencher em todo cadastro novo.
-- O NOT NULL fica para depois da F2 (quando o cadastro envia catalogo_id).
alter table public.servicos
  add column if not exists catalogo_id uuid null references public.servicos_catalogo(id) on delete restrict;

alter table public.servicos
  add column if not exists produto_id uuid null references public.produtos_catalogo(id) on delete restrict;

comment on column public.servicos.catalogo_id is
  'Item de servicos_catalogo que gerou a cadencia deste servico (ADR-0031). Preenchido pelo register_service_with_reminder.';
comment on column public.servicos.produto_id is
  'Produto canonico usado no servico (opcional). Backfill da F1 cobre amortecedor com marca_peca; o fluxo completo entra na F3.';

create index if not exists servicos_catalogo_id_idx on public.servicos (catalogo_id);
create index if not exists servicos_produto_id_idx on public.servicos (produto_id);

-- ---------------------------------------------------------------------------
-- Seed: espelho EXATO de tipos_servico_default (ADR-0031 §6 / plano F1)
-- ---------------------------------------------------------------------------
-- `dias_lembrete`, `template_name` e `template_language` sao copiados 1:1 —
-- e isso que garante "comportamento identico" quando o RPC passar a resolver
-- pelo catalogo. `produto_label` vem de PRODUCT_LABEL_BY_TIPO
-- (lib/whatsapp/service-confirmation.ts), que continua sendo o fallback por
-- familia no codigo.
--
-- Aliases sao conservadores de proposito: um alias errado vira match exato
-- errado (custo zero de LLM, erro silencioso). Sinonimo duvidoso e trabalho do
-- passo de trigrama/embedding, nao do match exato. O item `outro` nao tem
-- alias nenhum: e o catch-all, nunca deve ser alcancado por nome.
insert into public.servicos_catalogo (
  oficina_id, slug, nome, familia, produto_label, aliases,
  base, intervalo_dias, template_name, template_language,
  origem, padrao_familia, ativo
)
values
  (
    null, 'troca-de-oleo', 'Troca de óleo', 'troca_oleo', 'óleo',
    array['troca de óleo do motor', 'óleo do motor', 'troca do óleo', 'óleo'],
    'tempo', 90, 'lembrete_troca_oleo', 'pt_BR', 'seed', true, true
  ),
  (
    null, 'amortecedor', 'Amortecedor', 'amortecedor', 'amortecedor',
    array['amortecedores', 'troca de amortecedor', 'troca de amortecedores', 'amortecedor dianteiro', 'amortecedor traseiro'],
    'tempo', 730, 'lembrete_amortecedor', 'pt_BR', 'seed', true, true
  ),
  (
    null, 'revisao', 'Revisão', 'revisao', 'revisão',
    array['revisão geral', 'revisão completa', 'revisão periódica', 'check-up'],
    'tempo', 180, 'lembrete_revisao_geral', 'pt_BR', 'seed', true, true
  ),
  (
    null, 'outro-servico', 'Outro serviço', 'outro', 'revisão',
    array[]::text[],
    'tempo', 180, 'lembrete_revisao_geral', 'pt_BR', 'seed', true, true
  )
on conflict (coalesce(oficina_id, '00000000-0000-0000-0000-000000000000'::uuid), slug)
do nothing;

-- Produtos: as 4 marcas de amortecedor que hoje vivem em `servicos.marca_peca`.
-- `outra` fica de fora — nao e marca canonica, e a ausencia de marca.
-- O slug e `amortecedor-<marca_peca>`: e por ele (unico e global) que o
-- backfill e o RPC resolvem o produto, sem depender de `lower(marca)`.
insert into public.produtos_catalogo (slug, nome, marca, familia, origem, ativo)
values
  ('amortecedor-perfect', 'Amortecedor Perfect', 'Perfect', 'amortecedor', 'seed', true),
  ('amortecedor-monroe',  'Amortecedor Monroe',  'Monroe',  'amortecedor', 'seed', true),
  ('amortecedor-cofap',   'Amortecedor Cofap',   'Cofap',   'amortecedor', 'seed', true),
  ('amortecedor-nakata',  'Amortecedor Nakata',  'Nakata',  'amortecedor', 'seed', true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Todo servico existente aponta para o item global default da sua familia.
-- Meta verificavel: `select count(*) from servicos where catalogo_id is null` = 0.
update public.servicos s
   set catalogo_id = c.id
  from public.servicos_catalogo c
 where c.oficina_id is null
   and c.padrao_familia
   and c.familia = coalesce(s.tipo_servico, 'troca_oleo')
   and s.catalogo_id is null;

-- Amortecedor com marca conhecida ganha o produto canonico. `outra` continua
-- sem produto (marca desconhecida nao vira item de catalogo).
update public.servicos s
   set produto_id = p.id
  from public.produtos_catalogo p
 where s.marca_peca is not null
   and s.marca_peca <> 'outra'
   and p.slug = 'amortecedor-' || s.marca_peca
   and s.produto_id is null;
