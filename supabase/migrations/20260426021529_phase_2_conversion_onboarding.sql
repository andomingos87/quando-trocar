alter table public.leads_oficina
  drop constraint if exists leads_oficina_status_check;

alter table public.leads_oficina
  add constraint leads_oficina_status_check
  check (status in (
    'novo',
    'em_conversa',
    'qualificado',
    'interessado',
    'teste_aceito',
    'convertido',
    'perdido'
  ));

create table if not exists public.oficinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  responsavel text,
  whatsapp_principal text not null,
  cidade text,
  ticket_medio numeric,
  volume_trocas_mes integer,
  status text not null default 'ativa',
  plano text not null default 'teste',
  origem text not null default 'landing_whatsapp',
  timezone text not null default 'America/Sao_Paulo',
  dias_lembrete_padrao integer not null default 90,
  horario_envio_inicio time not null default '08:00',
  horario_envio_fim time not null default '18:00',
  mensagem_lembrete_padrao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oficinas_whatsapp_principal_e164_check
    check (whatsapp_principal ~ '^\+[1-9][0-9]{7,14}$'),
  constraint oficinas_status_check
    check (status in ('ativa', 'pausada', 'cancelada')),
  constraint oficinas_plano_check
    check (plano in ('teste', 'pago', 'interno')),
  constraint oficinas_origem_check
    check (origem in ('landing_whatsapp', 'manual', 'importacao'))
);

alter table public.leads_oficina
  add column if not exists nome_responsavel text,
  add column if not exists nome_oficina text,
  add column if not exists cidade text,
  add column if not exists volume_trocas_mes integer,
  add column if not exists ticket_medio numeric,
  add column if not exists principal_dor text,
  add column if not exists melhor_horario_contato text,
  add column if not exists interesse_declarado_at timestamptz,
  add column if not exists motivo_perda text,
  add column if not exists oficina_id uuid references public.oficinas(id) on delete set null,
  add column if not exists converted_at timestamptz;

create table if not exists public.oficina_members (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas(id) on delete cascade,
  user_id uuid,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oficina_members_role_check
    check (role in ('owner', 'admin', 'operador'))
);

create table if not exists public.clientes_finais (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas(id) on delete cascade,
  nome text not null,
  whatsapp text not null,
  consentimento_whatsapp boolean not null default true,
  origem_consentimento text,
  data_consentimento timestamptz,
  opt_out_at timestamptz,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_finais_whatsapp_e164_check
    check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  constraint clientes_finais_status_check
    check (status in ('ativo', 'opt_out', 'numero_errado')),
  constraint clientes_finais_origem_consentimento_check
    check (
      origem_consentimento is null
      or origem_consentimento in ('oficina_informou_cliente', 'cliente_confirmou', 'manual')
    )
);

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas(id) on delete cascade,
  cliente_id uuid not null references public.clientes_finais(id) on delete cascade,
  descricao text not null,
  placa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.servicos (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas(id) on delete cascade,
  cliente_id uuid not null references public.clientes_finais(id) on delete cascade,
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  tipo text not null,
  descricao text,
  data_servico date not null,
  valor numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.lembretes (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas(id) on delete cascade,
  cliente_id uuid not null references public.clientes_finais(id) on delete cascade,
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pendente',
  whatsapp_message_id text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lembretes_status_check
    check (status in (
      'pendente',
      'enfileirado',
      'enviado',
      'respondido',
      'agendado',
      'sem_resposta',
      'cancelado',
      'erro_envio'
    ))
);

alter table public.conversas
  add column if not exists oficina_id uuid references public.oficinas(id) on delete set null,
  add column if not exists cliente_id uuid references public.clientes_finais(id) on delete set null,
  add column if not exists context jsonb not null default '{}'::jsonb;

alter table public.conversas
  drop constraint if exists conversas_participant_type_check;

alter table public.conversas
  add constraint conversas_participant_type_check
  check (participant_type in (
    'lead_oficina',
    'oficina_cliente',
    'cliente_final',
    'contato_desconhecido'
  ));

alter table public.conversas
  drop constraint if exists conversas_agent_mode_check;

alter table public.conversas
  add constraint conversas_agent_mode_check
  check (agent_mode in (
    'vendas',
    'onboarding',
    'operacao',
    'cliente_final_lembrete',
    'suporte'
  ));

alter table public.mensagens
  add column if not exists oficina_id uuid references public.oficinas(id) on delete set null,
  add column if not exists cliente_id uuid references public.clientes_finais(id) on delete set null;

alter table public.outbound_messages
  add column if not exists oficina_id uuid references public.oficinas(id) on delete set null,
  add column if not exists cliente_id uuid references public.clientes_finais(id) on delete set null;

alter table public.agent_tool_calls
  add column if not exists oficina_id uuid references public.oficinas(id) on delete set null,
  add column if not exists cliente_id uuid references public.clientes_finais(id) on delete set null;

create unique index if not exists oficinas_whatsapp_principal_uidx
  on public.oficinas (whatsapp_principal);

create index if not exists leads_oficina_oficina_id_idx
  on public.leads_oficina (oficina_id);

create index if not exists oficina_members_oficina_id_idx
  on public.oficina_members (oficina_id);

create unique index if not exists clientes_finais_oficina_whatsapp_uidx
  on public.clientes_finais (oficina_id, whatsapp);

create index if not exists clientes_finais_oficina_id_idx
  on public.clientes_finais (oficina_id);

create index if not exists veiculos_oficina_id_idx
  on public.veiculos (oficina_id);

create index if not exists veiculos_cliente_descricao_idx
  on public.veiculos (oficina_id, cliente_id, descricao);

create index if not exists servicos_oficina_id_idx
  on public.servicos (oficina_id);

create index if not exists servicos_cliente_id_data_idx
  on public.servicos (cliente_id, data_servico desc);

create index if not exists lembretes_oficina_id_idx
  on public.lembretes (oficina_id);

create index if not exists lembretes_due_idx
  on public.lembretes (status, scheduled_at)
  where status = 'pendente';

create index if not exists conversas_oficina_id_idx
  on public.conversas (oficina_id);

create index if not exists conversas_cliente_id_idx
  on public.conversas (cliente_id);

create index if not exists mensagens_oficina_id_idx
  on public.mensagens (oficina_id);

create index if not exists outbound_messages_oficina_id_idx
  on public.outbound_messages (oficina_id);

alter table public.oficinas enable row level security;
alter table public.oficina_members enable row level security;
alter table public.clientes_finais enable row level security;
alter table public.veiculos enable row level security;
alter table public.servicos enable row level security;
alter table public.lembretes enable row level security;

create or replace function public.register_service_with_reminder(
  p_oficina_id uuid,
  p_nome_cliente text,
  p_whatsapp_cliente text,
  p_veiculo text,
  p_servico text,
  p_data_servico date,
  p_valor numeric,
  p_consentimento_whatsapp boolean
)
returns jsonb
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_veiculo_id uuid;
  v_servico_id uuid;
  v_lembrete_id uuid;
  v_dias_lembrete integer;
begin
  select dias_lembrete_padrao
    into v_dias_lembrete
    from public.oficinas
   where id = p_oficina_id
     and status = 'ativa';

  if v_dias_lembrete is null then
    raise exception 'oficina ativa nao encontrada';
  end if;

  insert into public.clientes_finais (
    oficina_id,
    nome,
    whatsapp,
    consentimento_whatsapp,
    origem_consentimento,
    data_consentimento,
    status,
    updated_at
  )
  values (
    p_oficina_id,
    p_nome_cliente,
    p_whatsapp_cliente,
    p_consentimento_whatsapp,
    case
      when p_consentimento_whatsapp then 'oficina_informou_cliente'
      else null
    end,
    case
      when p_consentimento_whatsapp then now()
      else null
    end,
    'ativo',
    now()
  )
  on conflict (oficina_id, whatsapp)
  do update set
    nome = excluded.nome,
    consentimento_whatsapp = excluded.consentimento_whatsapp,
    origem_consentimento = excluded.origem_consentimento,
    data_consentimento = excluded.data_consentimento,
    status = 'ativo',
    updated_at = now()
  returning id into v_cliente_id;

  select id
    into v_veiculo_id
    from public.veiculos
   where oficina_id = p_oficina_id
     and cliente_id = v_cliente_id
     and lower(descricao) = lower(p_veiculo)
   order by created_at asc
   limit 1;

  if v_veiculo_id is null then
    insert into public.veiculos (
      oficina_id,
      cliente_id,
      descricao
    )
    values (
      p_oficina_id,
      v_cliente_id,
      p_veiculo
    )
    returning id into v_veiculo_id;
  end if;

  insert into public.servicos (
    oficina_id,
    cliente_id,
    veiculo_id,
    tipo,
    descricao,
    data_servico,
    valor
  )
  values (
    p_oficina_id,
    v_cliente_id,
    v_veiculo_id,
    p_servico,
    p_servico,
    p_data_servico,
    p_valor
  )
  returning id into v_servico_id;

  if p_consentimento_whatsapp then
    insert into public.lembretes (
      oficina_id,
      cliente_id,
      veiculo_id,
      servico_id,
      scheduled_at,
      status
    )
    values (
      p_oficina_id,
      v_cliente_id,
      v_veiculo_id,
      v_servico_id,
      (p_data_servico::timestamptz + make_interval(days => v_dias_lembrete)),
      'pendente'
    )
    returning id into v_lembrete_id;
  end if;

  return jsonb_build_object(
    'cliente_id', v_cliente_id,
    'veiculo_id', v_veiculo_id,
    'servico_id', v_servico_id,
    'lembrete_id', v_lembrete_id
  );
end;
$$;

revoke execute on function public.register_service_with_reminder(
  uuid,
  text,
  text,
  text,
  text,
  date,
  numeric,
  boolean
) from public, anon, authenticated;

grant execute on function public.register_service_with_reminder(
  uuid,
  text,
  text,
  text,
  text,
  date,
  numeric,
  boolean
) to service_role;
