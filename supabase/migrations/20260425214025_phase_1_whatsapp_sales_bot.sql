create extension if not exists "pgcrypto";

create table public.leads_oficina (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  nome text,
  origem text not null default 'manual_whatsapp',
  status text not null default 'novo',
  metadata jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_oficina_origem_check
    check (origem in ('landing_page', 'manual_whatsapp')),
  constraint leads_oficina_status_check
    check (status in ('novo', 'em_conversa', 'qualificado', 'interessado', 'perdido')),
  constraint leads_oficina_whatsapp_e164_check
    check (whatsapp ~ '^\+[1-9][0-9]{7,14}$')
);

create table public.conversas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads_oficina(id) on delete set null,
  participant_whatsapp text not null,
  participant_type text not null default 'contato_desconhecido',
  agent_mode text not null default 'vendas',
  handoff_required boolean not null default false,
  handoff_reason text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversas_participant_type_check
    check (participant_type in ('lead_oficina', 'contato_desconhecido')),
  constraint conversas_agent_mode_check
    check (agent_mode in ('vendas')),
  constraint conversas_participant_whatsapp_e164_check
    check (participant_whatsapp ~ '^\+[1-9][0-9]{7,14}$')
);

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads_oficina(id) on delete set null,
  direction text not null,
  whatsapp_message_id text,
  body text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  provider_status text,
  provider_error_code text,
  provider_error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mensagens_direction_check
    check (direction in ('inbound', 'outbound'))
);

create table public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text,
  whatsapp_message_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads_oficina(id) on delete set null,
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads_oficina(id) on delete set null,
  to_whatsapp text not null,
  body text not null,
  status text not null default 'pending',
  whatsapp_message_id text,
  provider_response jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_messages_status_check
    check (status in ('pending', 'sent', 'failed')),
  constraint outbound_messages_to_whatsapp_e164_check
    check (to_whatsapp ~ '^\+[1-9][0-9]{7,14}$')
);

create unique index leads_oficina_whatsapp_uidx
  on public.leads_oficina (whatsapp);

create unique index conversas_participant_agent_uidx
  on public.conversas (participant_whatsapp, agent_mode);

create unique index mensagens_whatsapp_message_id_uidx
  on public.mensagens (whatsapp_message_id)
  where whatsapp_message_id is not null;

create unique index whatsapp_events_provider_event_uidx
  on public.whatsapp_events (provider_event_id)
  where provider_event_id is not null;

create unique index outbound_messages_whatsapp_message_id_uidx
  on public.outbound_messages (whatsapp_message_id)
  where whatsapp_message_id is not null;

create index conversas_lead_id_idx on public.conversas (lead_id);
create index mensagens_conversa_id_created_at_idx on public.mensagens (conversa_id, created_at);
create index agent_tool_calls_conversa_id_created_at_idx on public.agent_tool_calls (conversa_id, created_at);
create index outbound_messages_status_created_at_idx on public.outbound_messages (status, created_at);

alter table public.leads_oficina enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
alter table public.whatsapp_events enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.outbound_messages enable row level security;

comment on table public.leads_oficina is
  'Workshop sales leads created from WhatsApp conversations in phase 1.';
comment on table public.whatsapp_events is
  'Raw WhatsApp webhook events for audit and idempotency. Server-only access in phase 1.';
comment on table public.agent_tool_calls is
  'Audit log of internal tools used by the sales agent.';
