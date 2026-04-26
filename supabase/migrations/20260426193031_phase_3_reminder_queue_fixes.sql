grant usage on schema pgmq to postgres, authenticator, service_role;
grant execute on all functions in schema pgmq to postgres, authenticator, service_role;

create or replace function public.requeue_whatsapp_reminder_message(
  p_outbound_message_id uuid,
  p_lembrete_id uuid,
  p_oficina_id uuid,
  p_cliente_id uuid,
  p_delay_seconds integer
)
returns bigint
language sql
set search_path = public, pgmq, pg_temp
as $$
  select *
    from pgmq.send(
      'whatsapp_outbound',
      jsonb_build_object(
        'outbound_message_id', p_outbound_message_id,
        'lembrete_id', p_lembrete_id,
        'oficina_id', p_oficina_id,
        'cliente_id', p_cliente_id
      ),
      greatest(coalesce(p_delay_seconds, 0), 0)
    );
$$;

grant execute on function public.requeue_whatsapp_reminder_message(uuid, uuid, uuid, uuid, integer)
  to postgres, authenticator, service_role;
