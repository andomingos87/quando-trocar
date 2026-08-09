-- Prospeccao de oficinas ICP — base de dados (P1)
-- Plano tecnico: docs/architecture/prospeccao-icp-oficinas.md
--
-- Estrategia de fonte (secao 2 do plano): a base PERSISTENTE vem do CNPJ da Receita
-- Federal (dado publico, sem restricao de armazenamento). O Google Places entra depois
-- so como descoberta e sinal de vitalidade, e o que vier dele vive em `places_cache`
-- com expiracao — os Termos do Maps Platform permitem guardar `place_id`
-- indefinidamente e lat/lng por ate 30 dias, mas nao nome/telefone/endereco.
--
-- Todas as tabelas sao internas (admin / service role). RLS habilitada SEM policy:
-- negacao por padrao para anon e authenticated.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Areas: a unidade de segmentacao (Cidade/UF)
-- ---------------------------------------------------------------------------
create table public.prospeccao_areas (
  id                    uuid primary key default gen_random_uuid(),
  cidade                text not null,
  uf                    char(2) not null,
  codigo_ibge           text null,
  -- codigo do municipio na tabela da RFB (Municipios.zip). NAO e o codigo IBGE.
  codigo_municipio_rfb  text null,
  bbox                  jsonb null,
  status                text not null default 'pendente'
                        check (status in ('pendente','ingerindo','ingerida','pausada','concluida')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (cidade, uf)
);

comment on column public.prospeccao_areas.codigo_municipio_rfb is
  'Codigo do municipio na tabela Municipios da Receita Federal (ex.: 6477 = Guarulhos). Nao confundir com o codigo IBGE.';

-- ---------------------------------------------------------------------------
-- Execucoes: observabilidade e custo por rodada de ingestao
-- ---------------------------------------------------------------------------
create table public.prospeccao_execucoes (
  id                uuid primary key default gen_random_uuid(),
  area_id           uuid not null references public.prospeccao_areas(id) on delete cascade,
  fonte             text not null check (fonte in ('rfb','places')),
  competencia       text null,          -- 'AAAA-MM' da extracao da RFB
  iniciada_em       timestamptz not null default now(),
  finalizada_em     timestamptz null,
  metricas          jsonb not null default '{}'::jsonb,
  lidos             integer not null default 0,
  descobertos       integer not null default 0,
  novos             integer not null default 0,
  erro              text null
);
create index prospeccao_execucoes_area_idx on public.prospeccao_execucoes (area_id, iniciada_em desc);

-- ---------------------------------------------------------------------------
-- Estabelecimentos
-- ---------------------------------------------------------------------------
create table public.prospeccao_estabelecimentos (
  id                   uuid primary key default gen_random_uuid(),
  area_id              uuid not null references public.prospeccao_areas(id) on delete cascade,
  fontes               text[] not null default '{}',   -- 'rfb' | 'places'

  -- chaves permanentes
  cnpj                 text null unique check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  google_place_id      text null unique,

  -- cadastro persistivel (origem: Receita Federal)
  razao_social         text null,
  nome_fantasia        text null,
  nome_canonico        text null,       -- usado no dedupe fuzzy
  cnae_principal       text null,
  cnae_secundarios     text[] not null default '{}',
  situacao_cadastral   text null,       -- 'ativa' | 'baixada' | 'suspensa' | 'inapta' | 'nula'
  data_abertura        date null,
  porte                text null,
  matriz_filial        text null check (matriz_filial is null or matriz_filial in ('matriz','filial')),
  logradouro           text null,
  numero               text null,
  complemento          text null,
  bairro               text null,
  cidade               text not null,
  uf                   char(2) not null,
  cep                  text null,
  email                text null,

  -- cache do Google Places: NAO e fonte de verdade, expira (ver secao 2 do plano)
  places_cache         jsonb null,
  places_cached_at     timestamptz null,

  -- dado proprio: nasce aqui e persiste sem restricao
  telefone_e164        text null check (telefone_e164 is null or telefone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  telefone_secundario_e164 text null
                       check (telefone_secundario_e164 is null or telefone_secundario_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  telefone_movel       boolean null,
  score_icp            integer null check (score_icp between 0 and 100),
  score_versao         text null,
  score_motivos        jsonb not null default '[]'::jsonb,
  classificacao        text null,
  classificacao_origem text null check (classificacao_origem in ('regra','llm','humano')),
  status               text not null default 'descoberto'
                       check (status in ('descoberto','qualificado','descartado',
                                         'aprovado','promovido','duplicado')),
  motivo_descarte      text null,
  duplicado_de         uuid null references public.prospeccao_estabelecimentos(id) on delete set null,
  lead_id              uuid null references public.leads_oficina(id) on delete set null,
  revisado_por         uuid null,
  revisado_em          timestamptz null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on column public.prospeccao_estabelecimentos.places_cache is
  'Cache volatil de conteudo do Google Places. Expira em 30 dias via prospeccao_expirar_cache_places(). Nunca tratar como cadastro.';

create index prospeccao_estab_fila_idx
  on public.prospeccao_estabelecimentos (cidade, uf, status, score_icp desc);
create index prospeccao_estab_area_idx
  on public.prospeccao_estabelecimentos (area_id, status);
create index prospeccao_estab_telefone_idx
  on public.prospeccao_estabelecimentos (telefone_e164) where telefone_e164 is not null;
create index prospeccao_estab_cnae_idx
  on public.prospeccao_estabelecimentos (cnae_principal);
create index prospeccao_estab_lead_idx
  on public.prospeccao_estabelecimentos (lead_id) where lead_id is not null;
create index prospeccao_estab_dup_idx
  on public.prospeccao_estabelecimentos (duplicado_de) where duplicado_de is not null;
-- dedupe fuzzy por nome (secao 6.2 do plano)
create index prospeccao_estab_nome_trgm_idx
  on public.prospeccao_estabelecimentos using gin (nome_canonico extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Expiracao do cache do Places (secao 5.1 do plano)
-- Sem isso a politica da secao 2 vira letra morta.
-- ---------------------------------------------------------------------------
create or replace function public.prospeccao_expirar_cache_places()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetados integer;
begin
  update public.prospeccao_estabelecimentos
     set places_cache = null,
         places_cached_at = null,
         updated_at = now()
   where places_cached_at is not null
     and places_cached_at < now() - interval '30 days';

  get diagnostics v_afetados = row_count;
  return v_afetados;
end;
$$;

-- SECURITY DEFINER em public recebe EXECUTE de public por padrao — revogar de todos
-- os papeis expostos, nao so de `public` (ver .context/lessons/0001-security-definer-grants-vazam.md).
revoke all on function public.prospeccao_expirar_cache_places() from public;
revoke all on function public.prospeccao_expirar_cache_places() from anon;
revoke all on function public.prospeccao_expirar_cache_places() from authenticated;
grant execute on function public.prospeccao_expirar_cache_places() to service_role;

-- 1×/dia de madrugada. Idempotente: reaplica sem duplicar o job.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'prospeccao-expirar-cache-places') then
    perform cron.schedule(
      'prospeccao-expirar-cache-places',
      '17 4 * * *',
      $cron$select public.prospeccao_expirar_cache_places();$cron$
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS: negacao por padrao. Nenhuma policy — so service role acessa.
-- ---------------------------------------------------------------------------
alter table public.prospeccao_areas             enable row level security;
alter table public.prospeccao_execucoes         enable row level security;
alter table public.prospeccao_estabelecimentos  enable row level security;

revoke all on public.prospeccao_areas            from anon, authenticated;
revoke all on public.prospeccao_execucoes        from anon, authenticated;
revoke all on public.prospeccao_estabelecimentos from anon, authenticated;
