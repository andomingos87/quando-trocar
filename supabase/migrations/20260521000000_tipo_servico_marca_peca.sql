-- Fase 1 do plano "3 niveis de produto":
-- Adiciona tipo_servico (enum logico) e marca_peca (nullable) em servicos.
-- Lembrete continua usando dias_lembrete_padrao (90d) e template oleo ate Fase 2.

alter table public.servicos
  add column if not exists tipo_servico text not null default 'troca_oleo';

alter table public.servicos
  add column if not exists marca_peca text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'servicos_tipo_servico_check'
  ) then
    alter table public.servicos
      add constraint servicos_tipo_servico_check
      check (tipo_servico in ('troca_oleo', 'amortecedor', 'revisao', 'outro'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'servicos_marca_peca_tipo_check'
  ) then
    alter table public.servicos
      add constraint servicos_marca_peca_tipo_check
      check (marca_peca is null or tipo_servico = 'amortecedor');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'servicos_marca_peca_valor_check'
  ) then
    alter table public.servicos
      add constraint servicos_marca_peca_valor_check
      check (marca_peca is null or marca_peca in ('perfect', 'monroe', 'cofap', 'nakata', 'outra'));
  end if;
end
$$;

comment on column public.servicos.tipo_servico is 'troca_oleo | amortecedor | revisao | outro';
comment on column public.servicos.marca_peca is 'Nullable. Hoje so populado para amortecedor: perfect|monroe|cofap|nakata|outra.';

create index if not exists servicos_tipo_servico_idx
  on public.servicos (oficina_id, tipo_servico, data_servico desc);

-- Recriar register_service_with_reminder com 2 parametros novos no final.
-- Adicionar params requer drop (signature muda).
drop function if exists public.register_service_with_reminder(
  uuid, text, text, text, text, date, numeric, boolean
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
  uuid,
  text,
  text,
  text,
  text,
  date,
  numeric,
  boolean,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.register_service_with_reminder(
  uuid,
  text,
  text,
  text,
  text,
  date,
  numeric,
  boolean,
  text,
  text
) to service_role;
