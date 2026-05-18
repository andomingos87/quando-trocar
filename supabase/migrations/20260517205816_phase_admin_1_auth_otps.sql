-- Tabela compartilhada entre painel da oficina (Fase 4A) e painel admin (Admin-1).
-- Cada registro representa um codigo OTP gerado para um login.
create table auth_otps (
  id uuid primary key default gen_random_uuid(),
  target text not null check (target in ('oficina', 'admin')),
  target_id uuid not null,
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  code_hash text not null,
  attempts int not null default 0,
  used_at timestamptz,
  expires_at timestamptz not null,
  ip inet,
  created_at timestamptz not null default now()
);

create index auth_otps_target_target_id_created_idx
  on auth_otps(target, target_id, created_at desc);

create index auth_otps_whatsapp_created_idx
  on auth_otps(whatsapp, created_at desc);

create index auth_otps_ip_created_idx
  on auth_otps(ip, created_at desc);

alter table auth_otps enable row level security;
-- Sem policy: acesso apenas via service role.
