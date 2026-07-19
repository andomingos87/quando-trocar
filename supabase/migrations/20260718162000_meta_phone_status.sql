-- ============================================================================
-- CV7 (QTR-16): status/qualidade do número Meta (quality rating).
-- Fonte: docs/backlog-whatsapp-bot/fase-camada-conversacional.md (Fase CV7).
-- Guarda o último evento de qualidade recebido no webhook
-- (`phone_number_quality_update` / `account_update`) por número, para o admin
-- ver quando o rating cai (o número é o ativo mais caro do produto). Requer que
-- a WABA esteja inscrita nesse campo de webhook.
-- ============================================================================

create table if not exists public.meta_phone_status (
  id uuid primary key default gen_random_uuid(),
  display_phone_number text not null unique,
  quality_rating text,
  event text,
  current_limit text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.meta_phone_status enable row level security;
-- Sem policy: acesso apenas via service-role (webhook e painel admin no server).

comment on table public.meta_phone_status is
  'Último evento de qualidade do número Meta por webhook (quality rating / limite) — CV7.';
