-- ============================================================================
-- Admin: expansao de acoes sobre leads_oficina e clientes_finais
-- - soft delete em leads_oficina e clientes_finais
-- - RPC public.convert_lead_to_oficina_manual (atomica)
-- Fonte: plano /Users/mac/.claude/plans/sim-synthetic-quasar.md secao 1
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Soft delete em leads_oficina
-- ---------------------------------------------------------------------------
alter table public.leads_oficina
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.admin_users(id),
  add column if not exists deleted_reason text;

create index if not exists leads_oficina_active_idx
  on public.leads_oficina (created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Soft delete em clientes_finais
-- ---------------------------------------------------------------------------
alter table public.clientes_finais
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.admin_users(id),
  add column if not exists deleted_reason text;

create index if not exists clientes_finais_active_idx
  on public.clientes_finais (oficina_id, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- RPC: convert_lead_to_oficina_manual
-- Cria oficina manual a partir de um lead vivo e nao-terminal, atualiza o
-- lead (status='convertido') e, se existir, a conversa ligada (agent_mode
-- 'onboarding', participant_type 'oficina_cliente'). Tudo em uma transacao
-- implicita (funcoes plpgsql).
-- ---------------------------------------------------------------------------
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

  select id, whatsapp, nome, nome_oficina, nome_responsavel, status, deleted_at
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
  'Conversao manual de lead em oficina disparada pelo admin. Atomica: oficina + lead + conversa em uma transacao.';

revoke all on function public.convert_lead_to_oficina_manual(uuid, uuid, numeric, integer, text, uuid) from public;
revoke execute on function public.convert_lead_to_oficina_manual(uuid, uuid, numeric, integer, text, uuid) from anon, authenticated;
grant execute on function public.convert_lead_to_oficina_manual(uuid, uuid, numeric, integer, text, uuid)
  to service_role;
