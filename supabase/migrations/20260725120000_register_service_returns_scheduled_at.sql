-- QTR-35 P0-3: o RPC passa a devolver a data que ele mesmo agendou.
--
-- Havia duas fontes de verdade para "quando o cliente vai ser lembrado":
--   * o RPC agenda por `tipos_servico_default.dias_lembrete` do TIPO do serviço
--     (amortecedor = 730, troca_oleo = 90, revisao/outro = 180);
--   * a copy para a oficina (`lib/whatsapp/webhook-handler.ts`) usava
--     `oficinas.dias_lembrete_padrao`.
-- Resultado no caso real: o bot disse "vou lembrar em 90 dias" e gravou
-- `lembretes.scheduled_at = 2028-07-23` (730 dias). A oficina não tinha como
-- conferir. Quem sabe a data é o RPC, então é ele que a devolve.
--
-- Mesma assinatura de 10 parâmetros da Fase 1 e da migration
-- 20260522000000: `create or replace` preserva os grants. Os revoke/grant são
-- reexecutados de forma idempotente por segurança (funções em `public` vazam
-- para anon/authenticated se o grant se perder — ver
-- .context/lessons sobre SECURITY DEFINER).
--
-- Nenhuma outra mudança de comportamento: cadência, upserts, consentimento e
-- validações seguem idênticos.

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
  v_scheduled_at timestamptz;
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
    returning id, scheduled_at into v_lembrete_id, v_scheduled_at;
  end if;

  -- `scheduled_at` e `dias_lembrete` são a fonte única da data para a copy que
  -- a oficina lê. Sem consentimento não existe lembrete: `scheduled_at` volta
  -- null e o bot não pode prometer aviso nenhum.
  return jsonb_build_object(
    'cliente_id', v_cliente_id,
    'veiculo_id', v_veiculo_id,
    'servico_id', v_servico_id,
    'lembrete_id', v_lembrete_id,
    'scheduled_at', v_scheduled_at,
    'dias_lembrete', v_dias_lembrete
  );
end;
$$;

revoke execute on function public.register_service_with_reminder(
  uuid, text, text, text, text, date, numeric, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.register_service_with_reminder(
  uuid, text, text, text, text, date, numeric, boolean, text, text
) to service_role;
