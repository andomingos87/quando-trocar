-- ============================================================================
-- Admin-0: base do painel admin (modelo de dados)
-- Fonte: docs/product/PRD-painel-admin.md §8, ADR-0013, ADR-0012.
-- ============================================================================

create table planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco_base numeric(10,2) not null check (preco_base >= 0),
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table oficinas
  add column motivo_pausa text,
  add column proximo_vencimento date,
  add column plano_id uuid references planos(id),
  add column preco_negociado numeric(10,2);

alter table oficinas
  add constraint oficinas_motivo_pausa_check
    check (
      motivo_pausa is null
      or motivo_pausa in ('inadimplencia', 'voluntaria', 'admin')
    );

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null unique
    check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  nome text not null,
  ativo boolean not null default true,
  ultimo_acesso_em timestamptz,
  created_at timestamptz not null default now()
);

create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admin_users(id),
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  payload jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index admin_audit_log_admin_idx
  on admin_audit_log(admin_id, created_at desc);

create index admin_audit_log_entidade_idx
  on admin_audit_log(entidade, entidade_id, created_at desc);

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references oficinas(id),
  valor numeric(10,2) not null check (valor > 0),
  status text not null check (status in ('pendente', 'pago', 'falhou', 'cancelado')),
  mp_preference_id text,
  mp_payment_id text unique,
  descricao text,
  vencimento date,
  tentativa int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index pagamentos_oficina_idx on pagamentos(oficina_id, created_at desc);
create index pagamentos_status_idx on pagamentos(status, vencimento);

create table cobranca_jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('cobranca_proxima', 'auto_pausa_inadimplencia')),
  executado_em timestamptz not null default now(),
  oficinas_avaliadas int not null default 0,
  preferencias_geradas int not null default 0,
  pausas_aplicadas int not null default 0,
  erros jsonb
);

alter table planos enable row level security;
alter table admin_users enable row level security;
alter table admin_audit_log enable row level security;
alter table pagamentos enable row level security;
alter table cobranca_jobs enable row level security;

create policy planos_select_authenticated
  on planos for select
  to authenticated
  using (true);

insert into planos (nome, preco_base, descricao, ativo)
values (
  'Quando Trocar Mensal',
  0,
  'Plano unico do MVP. Preco configurado por oficina via preco_negociado.',
  true
);

insert into admin_users (whatsapp, nome, ativo)
values ('+5511945207618', 'Anderson Domingos', true);

update oficinas
   set plano_id = (
     select id from planos where nome = 'Quando Trocar Mensal' limit 1
   )
 where plano_id is null;
