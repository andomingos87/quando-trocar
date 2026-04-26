create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

do $$
begin
  if exists (
    select 1
      from pg_constraint
     where conname = 'outbound_messages_status_check'
  ) then
    alter table public.outbound_messages
      drop constraint outbound_messages_status_check;
  end if;
end
$$;

alter table public.outbound_messages
  add column if not exists lembrete_id uuid references public.lembretes(id) on delete set null,
  add column if not exists message_kind text not null default 'text',
  add column if not exists template_name text,
  add column if not exists template_language text,
  add column if not exists template_params jsonb,
  add column if not exists provider_error_code text,
  add column if not exists provider_error_message text,
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz;

alter table public.outbound_messages
  add constraint outbound_messages_status_check
  check (status in ('pending', 'sent', 'failed', 'retry_scheduled'));

alter table public.outbound_messages
  add constraint outbound_messages_message_kind_check
  check (message_kind in ('text', 'template'));

alter table public.lembretes
  add column if not exists last_attempt_at timestamptz,
  add column if not exists provider_status text,
  add column if not exists provider_error_code text;

create unique index if not exists outbound_messages_active_lembrete_uidx
  on public.outbound_messages (lembrete_id)
  where lembrete_id is not null
    and status in ('pending', 'sent', 'retry_scheduled');

create index if not exists outbound_messages_lembrete_id_idx
  on public.outbound_messages (lembrete_id);

create index if not exists outbound_messages_next_attempt_at_idx
  on public.outbound_messages (status, next_attempt_at)
  where status = 'retry_scheduled';

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
set search_path = public, pg_temp
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
        v.descricao as vehicle_description
      from public.lembretes l
      join public.oficinas o on o.id = l.oficina_id
      join public.clientes_finais c on c.id = l.cliente_id
      join public.veiculos v on v.id = l.veiculo_id
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

    v_body := format(
      'Oi %s, aqui e da %s.%sJa esta na hora da proxima troca de oleo do seu %s.%sQuer agendar?',
      v_row.customer_name,
      v_row.workshop_name,
      E'\n',
      v_row.vehicle_description,
      E'\n'
    );

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
      'lembrete_troca_oleo',
      'pt_BR',
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
  attempts integer
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
    om.attempts
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
    on v.id = l.veiculo_id;
$$;

create or replace function public.archive_whatsapp_reminder_message(
  p_queue_message_id bigint
)
returns boolean
language sql
set search_path = public, pgmq, pg_temp
as $$
  select coalesce((select true from pgmq.archive('whatsapp_outbound', p_queue_message_id)), false);
$$;

create or replace function public.dispatch_whatsapp_reminder_consumer()
returns bigint
language plpgsql
set search_path = public, net, vault, pg_temp
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'whatsapp_consumer_url'
   limit 1;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'internal_job_secret'
   limit 1;

  if v_url is null or v_secret is null then
    return null;
  end if;

  return net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('batchSize', 10),
    timeout_milliseconds := 5000
  );
end;
$$;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'whatsapp-reminders-enqueue') then
    perform cron.schedule(
      'whatsapp-reminders-enqueue',
      '*/5 * * * *',
      $cron$select public.enqueue_due_whatsapp_reminders(100);$cron$
    );
  end if;

  if not exists (select 1 from cron.job where jobname = 'whatsapp-reminders-consume') then
    perform cron.schedule(
      'whatsapp-reminders-consume',
      '* * * * *',
      $cron$select public.dispatch_whatsapp_reminder_consumer();$cron$
    );
  end if;
end
$$;
