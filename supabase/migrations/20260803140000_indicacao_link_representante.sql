-- ============================================================================
-- Link de indicação do representante no site (estende ADR-0019).
-- Objetivo: o representante compartilha um link do SITE (/r/<codigo>), não só
-- o wa.me, e o lead que chegou por aquele link continua sendo dele por uma
-- janela determinada — mesmo que depois abra o link de outro representante.
--
-- Duas camadas de proteção (regras-de-negocio.md §18.9):
--   1. Cookie first-party `qt_ref` (30 dias, HMAC-assinado, first-touch
--      sticky): dentro da janela, o clique em link de outro rep NÃO
--      sobrescreve. Só o cookie atravessa a fase "visitante anônimo".
--   2. Banco (aqui): `representante_atribuido_em` datar a atribuição, para que
--      um lead parado possa voltar a ser atribuível (liberação por
--      inatividade — 90 dias sem evolução), em vez de ficar travado para
--      sempre no primeiro rep.
--
-- A atribuição em si continua entrando pelo mesmo caminho já auditado: o CTA
-- do site embute "#REP-<codigo>.<click_token>" na mensagem do wa.me, e
-- lib/whatsapp/repository.ts resolve o código no upsert do lead. Nenhum motor
-- de atribuição novo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Metadados de atribuição no lead.
-- ----------------------------------------------------------------------------
alter table public.leads_oficina
  add column if not exists representante_atribuido_em timestamptz,
  add column if not exists representante_atribuido_via text,
  add column if not exists representante_click_token text;

alter table public.leads_oficina
  drop constraint if exists leads_oficina_representante_atribuido_via_check;
alter table public.leads_oficina
  add constraint leads_oficina_representante_atribuido_via_check
  check (
    representante_atribuido_via is null
    or representante_atribuido_via in ('wa_prefill', 'site_link', 'manual')
  );

comment on column public.leads_oficina.representante_atribuido_em is
  'Quando o lead foi atribuído ao representante atual. Base da janela de reatribuição por inatividade (§18.9).';
comment on column public.leads_oficina.representante_atribuido_via is
  'Canal da atribuição: wa_prefill (código no texto do wa.me), site_link (cookie de indicação do site) ou manual (admin).';
comment on column public.leads_oficina.representante_click_token is
  'Token do clique em /r/<codigo> que originou a atribuição. Liga o lead à linha exata em representante_link_cliques.';

-- Backfill: leads já atribuídos passam a ter data de atribuição, senão a regra
-- de inatividade os trataria como "atribuídos agora" (ou como nulos, ficando
-- imediatamente reatribuíveis). created_at é a melhor aproximação disponível.
update public.leads_oficina
  set representante_atribuido_em = coalesce(representante_atribuido_em, created_at),
      representante_atribuido_via = coalesce(representante_atribuido_via, 'wa_prefill')
  where representante_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Cliques no link de indicação.
-- Sem PII: IP e user-agent apenas como hash (LGPD — mesma postura do portal do
-- representante, que nunca expõe dado de cliente final).
-- ----------------------------------------------------------------------------
create table if not exists public.representante_link_cliques (
  id uuid primary key default gen_random_uuid(),
  representante_id uuid not null references public.representantes (id) on delete cascade,
  codigo text not null,
  click_token text not null unique,
  -- false = o visitante já estava dentro da janela de outro rep; o clique é
  -- registrado (o rep vê o esforço) mas não gera atribuição.
  atribuiu boolean not null default true,
  referer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

alter table public.representante_link_cliques enable row level security;
-- Sem policy: acesso apenas via service-role (rota /r/<codigo> e portal do rep
-- no server). Escopo do rep é imposto no código, nunca no request (ADR-0003).

create index if not exists representante_link_cliques_rep_idx
  on public.representante_link_cliques (representante_id, created_at desc);

comment on table public.representante_link_cliques is
  'Cliques em /r/<codigo> (link de indicação do representante). Base do contador de cliques do portal e da auditoria de atribuição.';
comment on column public.representante_link_cliques.atribuiu is
  'false quando o visitante já estava na janela de indicação de outro representante (first-touch sticky) — clique contabilizado, sem atribuição.';

create index if not exists leads_oficina_representante_click_token_idx
  on public.leads_oficina (representante_click_token)
  where representante_click_token is not null;
