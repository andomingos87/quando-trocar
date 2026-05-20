-- Fase 2 do plano "3 niveis de produto":
-- Cadencia e template Meta por tipo_servico. Cada tipo tem sua propria
-- frequencia de lembrete e seu template Meta (oleo continua usando o atual,
-- amortecedor e revisao ganham templates novos).
--
-- Templates referenciados aqui DEVEM estar aprovados na Meta antes do enqueue
-- comecar a usa-los, senao o envio quebra (codigo 132001).

create table if not exists public.tipos_servico_default (
  tipo_servico text primary key,
  label text not null,
  dias_lembrete int not null check (dias_lembrete > 0),
  template_name text not null,
  template_language text not null default 'pt_BR',
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.tipos_servico_default (tipo_servico, label, dias_lembrete, template_name, template_language, ativo)
values
  ('troca_oleo', 'Troca de oleo', 90, 'lembrete_troca_oleo', 'pt_BR', true),
  ('amortecedor', 'Amortecedor', 730, 'lembrete_amortecedor', 'pt_BR', true),
  ('revisao', 'Revisao', 180, 'lembrete_revisao_geral', 'pt_BR', true),
  ('outro', 'Outro', 180, 'lembrete_revisao_geral', 'pt_BR', true)
on conflict (tipo_servico) do nothing;

alter table public.tipos_servico_default enable row level security;
-- Sem policies: acesso via service-role apenas (admin-only).

-- Recriar register_service_with_reminder para ler cadencia da tabela nova.
-- Mesma signature da Fase 1 (10 params).
drop function if exists public.register_service_with_reminder(
  uuid, text, text, text, text, date, numeric, boolean, text, text
);

create or replace function public.register_service_with_reminder(
  p_oficina_id uuid,
  p_nome_cliente text,
  p_whatsapp_cliente text,
  p_veiculo text,
  p_servico text,
  p_data_servico date,
  p_valor numeric,
  p_consentimento_whatsapp boolean,
  p_tipo_servico text default 'troca_oleo',
  p_marca_peca text default null
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_cliente_id uuid;
  v_veiculo_id uuid;
  v_servico_id uuid;
  v_lembrete_id uuid;
  v_dias_lembrete integer;
  v_oficina_ativa boolean;
begin
  if p_tipo_servico not in ('troca_oleo', 'amortecedor', 'revisao', 'outro') then
    raise exception 'tipo_servico invalido: %', p_tipo_servico;
  end if;

  if p_marca_peca is not null and p_tipo_servico <> 'amortecedor' then
    raise exception 'marca_peca so e permitido quando tipo_servico = amortecedor';
  end if;

  if p_marca_peca is not null and p_marca_peca not in ('perfect', 'monroe', 'cofap', 'nakata', 'outra') then
    raise exception 'marca_peca invalida: %', p_marca_peca;
  end if;

  select status = 'ativa'
    into v_oficina_ativa
    from public.oficinas
   where id = p_oficina_id;

  if v_oficina_ativa is null or v_oficina_ativa = false then
    raise exception 'oficina ativa nao encontrada';
  end if;

  -- Cadencia: tabela tipos_servico_default (ativa) prevalece.
  -- Fallback: dias_lembrete_padrao da oficina (compatibilidade).
  select dias_lembrete
    into v_dias_lembrete
    from public.tipos_servico_default
   where tipo_servico = p_tipo_servico
     and ativo = true;

  if v_dias_lembrete is null then
    select dias_lembrete_padrao
      into v_dias_lembrete
      from public.oficinas
     where id = p_oficina_id;
  end if;

  if v_dias_lembrete is null then
    raise exception 'cadencia de lembrete nao definida para tipo %', p_tipo_servico;
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
    consentimento_whatsapp = case
      when clientes_finais.status in ('opt_out', 'numero_errado')
        then clientes_finais.consentimento_whatsapp
      else excluded.consentimento_whatsapp
    end,
    origem_consentimento = case
      when clientes_finais.status in ('opt_out', 'numero_errado')
        then clientes_finais.origem_consentimento
      else excluded.origem_consentimento
    end,
    data_consentimento = case
      when clientes_finais.status in ('opt_out', 'numero_errado')
        then clientes_finais.data_consentimento
      else excluded.data_consentimento
    end,
    opt_out_at = case
      when clientes_finais.status = 'opt_out'
        then clientes_finais.opt_out_at
      else null
    end,
    status = case
      when clientes_finais.status in ('opt_out', 'numero_errado')
        then clientes_finais.status
      else 'ativo'
    end,
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
    valor,
    tipo_servico,
    marca_peca
  )
  values (
    p_oficina_id,
    v_cliente_id,
    v_veiculo_id,
    p_servico,
    p_servico,
    p_data_servico,
    p_valor,
    p_tipo_servico,
    p_marca_peca
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
  uuid, text, text, text, text, date, numeric, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.register_service_with_reminder(
  uuid, text, text, text, text, date, numeric, boolean, text, text
) to service_role;

-- Recriar enqueue_due_whatsapp_reminders para resolver template e body
-- por tipo_servico.
create or replace function public.enqueue_due_whatsapp_reminders(
  p_limit integer default 100
)
returns table (
  lembrete_id uuid,
  outbound_message_id uuid,
  queue_message_id bigint
)
language plpgsql
set search_path = public, pgmq, pg_temp
as $$
declare
  v_row record;
  v_conversation_id uuid;
  v_outbound_message_id uuid;
  v_queue_message_id bigint;
  v_template_params jsonb;
  v_body text;
begin
  begin
    perform pgmq.create('whatsapp_outbound');
  exception
    when others then
      null;
  end;

  for v_row in
    with eligible as (
      select
        l.id as lembrete_id,
        l.oficina_id,
        l.cliente_id,
        l.veiculo_id,
        c.whatsapp,
        c.nome as customer_name,
        o.nome as workshop_name,
        v.descricao as vehicle_description,
        coalesce(s.tipo_servico, 'troca_oleo') as tipo_servico,
        t.template_name,
        t.template_language
      from public.lembretes l
      join public.oficinas o on o.id = l.oficina_id
      join public.clientes_finais c on c.id = l.cliente_id
      join public.veiculos v on v.id = l.veiculo_id
      left join public.servicos s on s.id = l.servico_id
      left join public.tipos_servico_default t
        on t.tipo_servico = coalesce(s.tipo_servico, 'troca_oleo')
       and t.ativo = true
      where l.status in ('pendente', 'erro_envio')
        and l.scheduled_at <= now()
        and o.status = 'ativa'
        and c.status = 'ativo'
        and c.consentimento_whatsapp = true
        and c.opt_out_at is null
        and (now() at time zone o.timezone)::time between o.horario_envio_inicio and o.horario_envio_fim
        and not exists (
          select 1
            from public.outbound_messages om
           where om.lembrete_id = l.id
             and om.status in ('pending', 'sent', 'retry_scheduled')
        )
      order by l.scheduled_at asc
      limit p_limit
      for update of l skip locked
    )
    select * from eligible
  loop
    -- Se tipos_servico_default nao tiver linha ativa, fallback hard-coded
    -- (preserva continuidade do envio de oleo mesmo se admin desativar a linha).
    if v_row.template_name is null then
      v_row.template_name := 'lembrete_troca_oleo';
      v_row.template_language := 'pt_BR';
    end if;

    insert into public.conversas (
      oficina_id,
      cliente_id,
      lead_id,
      participant_whatsapp,
      participant_type,
      agent_mode,
      context,
      last_message_at,
      updated_at
    )
    values (
      v_row.oficina_id,
      v_row.cliente_id,
      null,
      v_row.whatsapp,
      'cliente_final',
      'cliente_final_lembrete',
      jsonb_build_object('lastReminderId', v_row.lembrete_id),
      now(),
      now()
    )
    on conflict (participant_whatsapp, agent_mode)
    do update set
      oficina_id = excluded.oficina_id,
      cliente_id = excluded.cliente_id,
      context = excluded.context,
      updated_at = now()
    returning id into v_conversation_id;

    v_template_params := jsonb_build_array(
      v_row.customer_name,
      v_row.workshop_name,
      v_row.vehicle_description
    );

    -- Body renderizado em portugues por tipo (auditoria em outbound_messages.body).
    v_body := case v_row.tipo_servico
      when 'amortecedor' then format(
        'Oi %s, aqui e da %s.%sJa faz um tempo que voce trocou os amortecedores do seu %s. Recomendamos uma checagem. Quer agendar?',
        v_row.customer_name, v_row.workshop_name, E'\n', v_row.vehicle_description
      )
      when 'revisao' then format(
        'Oi %s, aqui e da %s.%sJa esta na hora da proxima revisao do seu %s. Quer agendar?',
        v_row.customer_name, v_row.workshop_name, E'\n', v_row.vehicle_description
      )
      when 'outro' then format(
        'Oi %s, aqui e da %s.%sEsta na hora do proximo servico do seu %s. Quer agendar?',
        v_row.customer_name, v_row.workshop_name, E'\n', v_row.vehicle_description
      )
      else format(
        'Oi %s, aqui e da %s.%sJa esta na hora da proxima troca de oleo do seu %s.%sQuer agendar?',
        v_row.customer_name, v_row.workshop_name, E'\n', v_row.vehicle_description, E'\n'
      )
    end;

    insert into public.outbound_messages (
      conversa_id,
      oficina_id,
      cliente_id,
      to_whatsapp,
      body,
      status,
      lembrete_id,
      message_kind,
      template_name,
      template_language,
      template_params,
      attempts,
      updated_at
    )
    values (
      v_conversation_id,
      v_row.oficina_id,
      v_row.cliente_id,
      v_row.whatsapp,
      v_body,
      'pending',
      v_row.lembrete_id,
      'template',
      v_row.template_name,
      v_row.template_language,
      v_template_params,
      0,
      now()
    )
    returning id into v_outbound_message_id;

    update public.lembretes
       set status = 'enfileirado',
           updated_at = now()
     where id = v_row.lembrete_id;

    select *
      into v_queue_message_id
      from pgmq.send(
        'whatsapp_outbound',
        jsonb_build_object(
          'outbound_message_id', v_outbound_message_id,
          'lembrete_id', v_row.lembrete_id,
          'oficina_id', v_row.oficina_id,
          'cliente_id', v_row.cliente_id
        )
      );

    lembrete_id := v_row.lembrete_id;
    outbound_message_id := v_outbound_message_id;
    queue_message_id := v_queue_message_id;
    return next;
  end loop;
end;
$$;

-- Recriar dequeue_whatsapp_reminder_messages devolvendo template_name/language
-- ja resolvidos pelo enqueue. Worker passa direto pro provedor.
drop function if exists public.dequeue_whatsapp_reminder_messages(integer, integer);

create or replace function public.dequeue_whatsapp_reminder_messages(
  p_batch_size integer default 20,
  p_visibility_timeout_seconds integer default 60
)
returns table (
  queue_message_id bigint,
  outbound_message_id uuid,
  lembrete_id uuid,
  conversa_id uuid,
  oficina_id uuid,
  cliente_id uuid,
  to_whatsapp text,
  customer_name text,
  workshop_name text,
  vehicle_description text,
  attempts integer,
  template_name text,
  template_language text,
  tipo_servico text
)
language sql
set search_path = public, pgmq, pg_temp
as $$
  with queue_messages as (
    select *
      from pgmq.read('whatsapp_outbound', p_visibility_timeout_seconds, p_batch_size)
  )
  select
    q.msg_id as queue_message_id,
    (q.message ->> 'outbound_message_id')::uuid as outbound_message_id,
    om.lembrete_id,
    om.conversa_id,
    om.oficina_id,
    om.cliente_id,
    om.to_whatsapp,
    cf.nome as customer_name,
    o.nome as workshop_name,
    v.descricao as vehicle_description,
    om.attempts,
    om.template_name,
    om.template_language,
    coalesce(s.tipo_servico, 'troca_oleo') as tipo_servico
  from queue_messages q
  join public.outbound_messages om
    on om.id = (q.message ->> 'outbound_message_id')::uuid
  join public.lembretes l
    on l.id = om.lembrete_id
  join public.clientes_finais cf
    on cf.id = om.cliente_id
  join public.oficinas o
    on o.id = om.oficina_id
  join public.veiculos v
    on v.id = l.veiculo_id
  left join public.servicos s
    on s.id = l.servico_id;
$$;
