-- ============================================================================
-- Representantes comerciais + comissao configuravel (ADR-0019, supersede 0011)
-- Fonte: docs/backlog-whatsapp-bot/fase-representantes-comissao.md,
--        docs/regras-de-negocio.md §18.
-- - representantes: cadastro + codigo unico do link wa.me + override de comissao
-- - configuracoes_comissao: singleton com a politica default global
-- - comissoes: uma linha por pagamento confirmado (snapshot da regra vigente)
-- - representante_id em leads_oficina e oficinas (atribuicao)
-- - RPC convert_lead_to_oficina_manual atualizada para propagar a atribuicao
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. representantes
-- ----------------------------------------------------------------------------
create table representantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  codigo text not null check (codigo ~ '^[A-Z0-9][A-Z0-9-]{1,29}$'),
  ativo boolean not null default true,
  -- Override opcional da politica global (ADR-0019 §Comissao).
  -- tipo+valor andam juntos: ou ambos null (usa global) ou ambos preenchidos.
  comissao_tipo text check (comissao_tipo in ('percentual', 'fixo')),
  comissao_valor numeric(10,2) check (comissao_valor >= 0),
  comissao_duracao_meses int check (comissao_duracao_meses >= 1),
  deleted_at timestamptz,
  deleted_by uuid references admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint representantes_comissao_override_atomica check (
    (comissao_tipo is null and comissao_valor is null)
    or (comissao_tipo is not null and comissao_valor is not null)
  )
);

-- Unicidade case-insensitive do codigo e do whatsapp, ignorando soft-deleted
-- (mesmo criterio de oficinas: excluido libera o valor para reuso).
create unique index representantes_codigo_unique_idx
  on representantes (upper(codigo))
  where deleted_at is null;
create unique index representantes_whatsapp_unique_idx
  on representantes (whatsapp)
  where deleted_at is null;
create index representantes_ativo_idx
  on representantes (ativo)
  where deleted_at is null;

alter table representantes enable row level security;
-- Sem policies de proposito: acesso apenas via service-role (padrao admin).

-- ----------------------------------------------------------------------------
-- 2. configuracoes_comissao (singleton: sempre exatamente 1 linha)
-- ----------------------------------------------------------------------------
create table configuracoes_comissao (
  id uuid primary key default gen_random_uuid(),
  comissao_tipo text not null default 'percentual'
    check (comissao_tipo in ('percentual', 'fixo')),
  comissao_valor numeric(10,2) not null default 20.00
    check (comissao_valor >= 0),
  comissao_duracao_meses int
    check (comissao_duracao_meses >= 1),
  comissao_base text not null default 'valor_pago'
    check (comissao_base in ('valor_pago', 'preco_tabela')),
  updated_at timestamptz not null default now(),
  updated_by uuid references admin_users(id)
);

create unique index configuracoes_comissao_singleton_idx
  on configuracoes_comissao((true));

alter table configuracoes_comissao enable row level security;

insert into configuracoes_comissao (comissao_tipo, comissao_valor, comissao_duracao_meses, comissao_base)
values ('percentual', 20.00, null, 'valor_pago');

-- ----------------------------------------------------------------------------
-- 3. Atribuicao: representante_id em leads_oficina e oficinas
-- ----------------------------------------------------------------------------
alter table leads_oficina
  add column representante_id uuid references representantes(id);
alter table oficinas
  add column representante_id uuid references representantes(id);

create index leads_oficina_representante_idx
  on leads_oficina (representante_id)
  where representante_id is not null;
create index oficinas_representante_idx
  on oficinas (representante_id)
  where representante_id is not null;

-- ----------------------------------------------------------------------------
-- 4. comissoes (uma linha por pagamento confirmado; snapshot da regra vigente)
-- ----------------------------------------------------------------------------
create table comissoes (
  id uuid primary key default gen_random_uuid(),
  representante_id uuid not null references representantes(id),
  oficina_id uuid not null references oficinas(id),
  -- Idempotencia da geracao via webhook (mesmo padrao de mp_payment_id).
  pagamento_id uuid not null unique references pagamentos(id),
  base_valor numeric(10,2) not null check (base_valor >= 0),
  tipo text not null check (tipo in ('percentual', 'fixo')),
  taxa_aplicada numeric(10,2) not null check (taxa_aplicada >= 0),
  valor numeric(10,2) not null check (valor >= 0),
  status text not null default 'prevista'
    check (status in ('prevista', 'paga', 'cancelada')),
  paga_em timestamptz,
  cancelada_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comissoes_representante_status_idx
  on comissoes (representante_id, status, created_at desc);
create index comissoes_oficina_idx on comissoes (oficina_id);

alter table comissoes enable row level security;

-- ----------------------------------------------------------------------------
-- 5. RPC convert_lead_to_oficina_manual: propagar representante_id do lead
--    (corpo identico ao de 20260520120000 + atribuicao)
-- ----------------------------------------------------------------------------
create or replace function public.convert_lead_to_oficina_manual(
  p_lead_id uuid,
  p_plano_id uuid,
  p_preco_negociado numeric,
  p_dias_lembrete integer,
  p_status text,
  p_admin_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_plano record;
  v_existing_oficina uuid;
  v_oficina_id uuid;
  v_proximo_vencimento date;
  v_conversa_id uuid;
begin
  if p_status not in ('ativa', 'pausada') then
    raise exception 'status_invalido' using errcode = '22023';
  end if;
  if p_dias_lembrete is null or p_dias_lembrete < 1 or p_dias_lembrete > 365 then
    raise exception 'dias_lembrete_invalido' using errcode = '22023';
  end if;
  if p_preco_negociado is not null and p_preco_negociado < 0 then
    raise exception 'preco_negociado_invalido' using errcode = '22023';
  end if;

  select id, whatsapp, nome, nome_oficina, nome_responsavel, status, deleted_at, representante_id
    into v_lead
    from public.leads_oficina
   where id = p_lead_id
   for update;

  if not found then
    raise exception 'lead_not_found' using errcode = 'P0002';
  end if;
  if v_lead.deleted_at is not null then
    raise exception 'lead_deleted' using errcode = '22023';
  end if;
  if v_lead.status in ('convertido', 'perdido') then
    raise exception 'lead_terminal_%', v_lead.status using errcode = '22023';
  end if;

  select id, ativo into v_plano
    from public.planos
   where id = p_plano_id;
  if not found or not v_plano.ativo then
    raise exception 'plano_inativo' using errcode = '22023';
  end if;

  select id into v_existing_oficina
    from public.oficinas
   where whatsapp_principal = v_lead.whatsapp
     and status <> 'cancelada'
   limit 1;
  if v_existing_oficina is not null then
    raise exception 'oficina_whatsapp_em_uso' using errcode = '23505';
  end if;

  if p_status = 'ativa' then
    v_proximo_vencimento := (current_date + interval '30 days')::date;
  else
    v_proximo_vencimento := null;
  end if;

  insert into public.oficinas (
    nome,
    responsavel,
    whatsapp_principal,
    status,
    plano,
    plano_id,
    preco_negociado,
    origem,
    dias_lembrete_padrao,
    proximo_vencimento,
    representante_id,
    updated_at
  ) values (
    coalesce(nullif(v_lead.nome_oficina, ''), nullif(v_lead.nome, ''), 'Oficina sem nome'),
    nullif(v_lead.nome_responsavel, ''),
    v_lead.whatsapp,
    p_status,
    'pago',
    p_plano_id,
    p_preco_negociado,
    'manual',
    p_dias_lembrete,
    v_proximo_vencimento,
    v_lead.representante_id,
    now()
  ) returning id into v_oficina_id;

  update public.leads_oficina
     set status = 'convertido',
         oficina_id = v_oficina_id,
         converted_at = now(),
         updated_at = now()
   where id = p_lead_id;

  select id into v_conversa_id
    from public.conversas
   where lead_id = p_lead_id
   order by created_at desc
   limit 1;

  if v_conversa_id is not null then
    update public.conversas
       set oficina_id = v_oficina_id,
           participant_type = 'oficina_cliente',
           agent_mode = 'onboarding',
           updated_at = now()
     where id = v_conversa_id;
  end if;

  return jsonb_build_object(
    'oficina_id', v_oficina_id,
    'lead_id', p_lead_id,
    'conversa_id', v_conversa_id,
    'proximo_vencimento', v_proximo_vencimento,
    'admin_id', p_admin_id
  );
end;
$$;

comment on function public.convert_lead_to_oficina_manual is
  'Conversao manual de lead em oficina disparada pelo admin. Atomica: oficina + lead + conversa em uma transacao. Propaga representante_id (ADR-0019).';
