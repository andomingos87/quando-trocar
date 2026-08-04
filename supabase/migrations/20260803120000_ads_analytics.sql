-- ============================================================================
-- Analytics de anúncios (Meta Ads via Instagram/WhatsApp click-to-chat).
-- Objetivo: ligar o funil real do CRM (lead -> qualificado -> convertido) ao
-- gasto/resultado do anúncio que originou a conversa, respondendo "esse
-- anúncio gerou venda de verdade?".
--
-- Fonte de atribuição: a Meta envia um objeto `referral` (ctwa_clid, source_id
-- = id do anúncio, source_type, headline) na primeira mensagem de quem clicou
-- em "Enviar mensagem" num anúncio do Instagram/Facebook. Capturado em
-- lib/whatsapp/payload.ts e persistido aqui (first-touch, nunca sobrescrito).
--
-- Fonte do gasto/resultado do anúncio: sincronizado 1x/dia via Windsor.ai
-- (rota app/api/internal/sync-ad-insights) para ad_insights_daily.
-- ============================================================================

alter table public.leads_oficina
  add column if not exists ad_ctwa_clid text,
  add column if not exists ad_id text,
  add column if not exists ad_source_type text,
  add column if not exists ad_source_url text,
  add column if not exists ad_headline text,
  add column if not exists ad_attributed_at timestamptz;

comment on column public.leads_oficina.ad_ctwa_clid is
  'Click ID do Meta (referral.ctwa_clid) da mensagem que originou o lead — first-touch, nunca sobrescrito.';
comment on column public.leads_oficina.ad_id is
  'Id do anúncio Meta (referral.source_id) que originou o lead. Chave de junção com ad_insights_daily.ad_id.';
comment on column public.leads_oficina.ad_source_type is
  'referral.source_type (ex.: ad, post, ig_reel).';
comment on column public.leads_oficina.ad_source_url is
  'referral.source_url — permalink do anúncio/post de origem.';
comment on column public.leads_oficina.ad_headline is
  'referral.headline — texto do anúncio, útil quando o ad_id não bate mais com a campanha ativa.';
comment on column public.leads_oficina.ad_attributed_at is
  'Quando a atribuição foi capturada. Null = lead sem origem de anúncio rastreada (mensagem direta, sem clique em anúncio).';

create index if not exists leads_oficina_ad_id_idx
  on public.leads_oficina (ad_id)
  where ad_id is not null;

-- ----------------------------------------------------------------------------
-- Snapshot diário do Meta Ads (via Windsor.ai), por anúncio.
-- ----------------------------------------------------------------------------
create table if not exists public.ad_insights_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  ad_id text not null,
  ad_name text,
  adset_id text,
  adset_name text,
  campaign_id text,
  campaign_name text,
  spend numeric not null default 0,
  impressions int not null default 0,
  clicks int not null default 0,
  results int not null default 0,
  cost_per_result numeric,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  constraint ad_insights_daily_date_ad_unique unique (date, ad_id)
);

alter table public.ad_insights_daily enable row level security;
-- Sem policy: acesso apenas via service-role (rota de sync e painel admin no server).

create index if not exists ad_insights_daily_ad_id_idx
  on public.ad_insights_daily (ad_id, date desc);

comment on table public.ad_insights_daily is
  'Snapshot diário de spend/resultado por anúncio Meta Ads, sincronizado do Windsor.ai.';

-- ----------------------------------------------------------------------------
-- RPC de agregação: funil ads -> leads -> qualificados -> convertidos.
-- SECURITY DEFINER, só service-role (painel admin no server), mesmo padrão de
-- get_conversational_metrics.
-- ----------------------------------------------------------------------------
create or replace function public.get_ads_analytics(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with since as (
    select (now() - make_interval(days => greatest(1, least(p_days, 180))))::date as ts
  ),
  insights as (
    select
      ad_id,
      max(ad_name) as ad_name,
      max(adset_id) as adset_id,
      max(adset_name) as adset_name,
      max(campaign_id) as campaign_id,
      max(campaign_name) as campaign_name,
      sum(spend) as spend,
      sum(impressions) as impressions,
      sum(clicks) as clicks,
      sum(results) as results
    from public.ad_insights_daily, since
    where date >= since.ts
    group by ad_id
  ),
  leads_por_ad as (
    select
      ad_id,
      count(*) as leads,
      count(*) filter (
        where status in ('qualificado', 'interessado', 'teste_aceito', 'convertido')
      ) as qualificados,
      count(*) filter (where status = 'convertido') as convertidos
    from public.leads_oficina, since
    where ad_id is not null
      and deleted_at is null
      and created_at >= since.ts
    group by ad_id
  ),
  combined as (
    select
      coalesce(i.ad_id, l.ad_id) as ad_id,
      i.ad_name,
      i.campaign_id,
      i.campaign_name,
      coalesce(i.spend, 0) as spend,
      coalesce(i.results, 0) as resultados_meta,
      coalesce(l.leads, 0) as leads,
      coalesce(l.qualificados, 0) as qualificados,
      coalesce(l.convertidos, 0) as convertidos
    from insights i
    full outer join leads_por_ad l using (ad_id)
  ),
  por_campanha as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'adId', ad_id,
          'adNome', ad_name,
          'campanhaId', campaign_id,
          'campanhaNome', coalesce(campaign_name, 'Sem campanha (não sincronizado ainda)'),
          'gasto', spend,
          'resultadosMeta', resultados_meta,
          'leads', leads,
          'qualificados', qualificados,
          'convertidos', convertidos,
          'custoPorLead', case when leads > 0 then round(spend / leads, 2) else null end,
          'custoPorQualificado',
            case when qualificados > 0 then round(spend / qualificados, 2) else null end
        )
        order by spend desc
      ),
      '[]'::jsonb
    ) as arr
    from combined
  ),
  overview as (
    select
      coalesce(sum(spend), 0) as spend,
      coalesce(sum(resultados_meta), 0) as resultados_meta,
      coalesce(sum(leads), 0) as leads,
      coalesce(sum(qualificados), 0) as qualificados,
      coalesce(sum(convertidos), 0) as convertidos
    from combined
  )
  select jsonb_build_object(
    'periodoDias', greatest(1, least(p_days, 180)),
    'overview', jsonb_build_object(
      'gasto', overview.spend,
      'resultadosMeta', overview.resultados_meta,
      'leads', overview.leads,
      'qualificados', overview.qualificados,
      'convertidos', overview.convertidos,
      'custoPorLead',
        case when overview.leads > 0 then round(overview.spend / overview.leads, 2) else null end,
      'custoPorQualificado',
        case when overview.qualificados > 0
          then round(overview.spend / overview.qualificados, 2)
          else null
        end,
      'cac',
        case when overview.convertidos > 0
          then round(overview.spend / overview.convertidos, 2)
          else null
        end
    ),
    'porCampanha', por_campanha.arr
  )
  from overview, por_campanha;
$$;

revoke all on function public.get_ads_analytics(int) from public, anon, authenticated;
