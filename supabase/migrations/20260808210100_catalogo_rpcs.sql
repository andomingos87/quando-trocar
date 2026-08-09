-- ============================================================================
-- F1 do pivot do catalogo de servicos — os RPCs passam a ler o catalogo.
--
-- Plano: docs/backlog-catalogo-servicos/README.md (F1, passos 2 e 4)
-- ADR-0031 (catalogo aberto), ADR-0001 (LLM nao decide estado de negocio).
--
-- Depende de `20260808210000_catalogo_base.sql` (tabelas + seed + backfill).
--
-- Contrato desta fase: comportamento identico. O seed da migration anterior
-- espelha `tipos_servico_default` 1:1, entao resolver pelo catalogo devolve
-- exatamente a mesma cadencia e o mesmo template de antes. Todos os fallbacks
-- antigos continuam no lugar, agora como ultimos degraus da cascata.
--
-- Assinaturas preservadas: nenhum parametro removido. `register_service_with_
-- reminder` mantem os mesmos 10 parametros (a F2 e que passa a enviar
-- `catalogo_id` explicito).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- register_service_with_reminder — cadencia resolvida pelo catalogo
-- ---------------------------------------------------------------------------
-- Cascata de cadencia (plano F1, passo 2):
--   1. item da oficina  (servicos_catalogo.oficina_id = oficina, padrao da familia)
--   2. item global      (servicos_catalogo.oficina_id is null, padrao da familia)
--   3. tipos_servico_default  (fallback preservado)
--   4. oficinas.dias_lembrete_padrao (fallback preservado)
--
-- O item resolvido em 1/2 e gravado em `servicos.catalogo_id`. Um item com
-- `base = 'km'` (sem `intervalo_dias`) e valido: ele identifica o servico, mas
-- a cadencia cai para o proximo degrau ate a F3 converter km em data.
--
-- Mesma assinatura de 10 parametros: `create or replace` preserva os grants.
-- Os revoke/grant sao reexecutados por seguranca (licao 0001: funcao em
-- `public` vaza EXECUTE para anon/authenticated se o grant se perder).
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
  v_catalogo_id uuid;
  v_produto_id uuid;
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

  -- Passos 1 e 2 da cascata numa consulta so: o item da oficina vence o
  -- global porque `false` (oficina_id nao nulo) ordena antes de `true`.
  select c.id, c.intervalo_dias
    into v_catalogo_id, v_dias_lembrete
    from public.servicos_catalogo c
   where c.familia = p_tipo_servico
     and c.padrao_familia
     and c.ativo
     and (c.oficina_id = p_oficina_id or c.oficina_id is null)
   order by (c.oficina_id is null)
   limit 1;

  -- Passo 3: tabela legada de defaults por tipo.
  if v_dias_lembrete is null then
    select dias_lembrete
      into v_dias_lembrete
      from public.tipos_servico_default
     where tipo_servico = p_tipo_servico
       and ativo = true;
  end if;

  -- Passo 4: default da oficina.
  if v_dias_lembrete is null then
    select dias_lembrete_padrao
      into v_dias_lembrete
      from public.oficinas
     where id = p_oficina_id;
  end if;

  if v_dias_lembrete is null then
    raise exception 'cadencia de lembrete nao definida para tipo %', p_tipo_servico;
  end if;

  -- Produto canonico do legado: amortecedor com marca conhecida. `outra` e
  -- ausencia de marca, nao marca — fica sem produto. O vinculo completo
  -- (marca/modelo/especificacao vindos da fala) entra na F3.
  if p_marca_peca is not null and p_marca_peca <> 'outra' then
    select p.id
      into v_produto_id
      from public.produtos_catalogo p
     where p.slug = 'amortecedor-' || p_marca_peca
       and p.ativo;
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
    marca_peca,
    catalogo_id,
    produto_id
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
    p_marca_peca,
    v_catalogo_id,
    v_produto_id
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

  -- `scheduled_at` e `dias_lembrete` sao a fonte unica da data para a copy que
  -- a oficina le. Sem consentimento nao existe lembrete: `scheduled_at` volta
  -- null e o bot nao pode prometer aviso nenhum.
  return jsonb_build_object(
    'cliente_id', v_cliente_id,
    'veiculo_id', v_veiculo_id,
    'servico_id', v_servico_id,
    'lembrete_id', v_lembrete_id,
    'scheduled_at', v_scheduled_at,
    'dias_lembrete', v_dias_lembrete,
    'catalogo_id', v_catalogo_id,
    'produto_id', v_produto_id
  );
end;
$$;

revoke execute on function public.register_service_with_reminder(
  uuid, text, text, text, text, date, numeric, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.register_service_with_reminder(
  uuid, text, text, text, text, date, numeric, boolean, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- enqueue_due_whatsapp_reminders — template resolvido pelo catalogo
-- ---------------------------------------------------------------------------
-- Cascata de template: item de catalogo do servico > tipos_servico_default >
-- hard-coded `lembrete_troca_oleo` (todos os degraus antigos preservados).
--
-- `template_name` e `template_language` andam juntos: se o item de catalogo
-- nao fixa o template (`template_name is null` = generico da ADR-0031 §6, ainda
-- pendente de aprovacao na Meta), o par inteiro vem do degrau seguinte — nunca
-- um nome de um degrau com o idioma de outro.
--
-- O corpo em portugues (`v_body`, auditado em `outbound_messages.body`) NAO
-- muda nesta fase: qualquer alteracao aqui seria mudanca observavel.
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
        case
          when cat.template_name is not null then cat.template_name
          else t.template_name
        end as template_name,
        case
          when cat.template_name is not null then cat.template_language
          else t.template_language
        end as template_language
      from public.lembretes l
      join public.oficinas o on o.id = l.oficina_id
      join public.clientes_finais c on c.id = l.cliente_id
      join public.veiculos v on v.id = l.veiculo_id
      left join public.servicos s on s.id = l.servico_id
      left join public.servicos_catalogo cat
        on cat.id = s.catalogo_id
       and cat.ativo = true
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
    -- Ultimo degrau: nem catalogo nem tipos_servico_default resolveram
    -- (preserva continuidade do envio de oleo mesmo se o admin desativar a
    -- linha ou o item).
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

revoke execute on function public.enqueue_due_whatsapp_reminders(integer)
  from public, anon, authenticated;

grant execute on function public.enqueue_due_whatsapp_reminders(integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- dequeue_whatsapp_reminder_messages — devolve tambem o produto_label do item
-- ---------------------------------------------------------------------------
-- `produto_label` e o {{4}} do template generico da ADR-0031 §6. Nesta fase o
-- worker ainda envia 3 parametros (nenhum item usa o generico), mas o dado ja
-- viaja com a mensagem: a F2 so precisa passa-lo adiante.
--
-- Vem cru do catalogo (null quando o item nao tem label). O fallback por
-- familia continua sendo um so, em TypeScript (`PRODUCT_LABEL_BY_TIPO`, em
-- lib/whatsapp/service-confirmation.ts) — duplicar o mapa aqui criaria duas
-- fontes de verdade para o texto que o cliente final le.
--
-- Coluna nova no retorno => drop obrigatorio antes do create.
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
  tipo_servico text,
  produto_label text
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
    coalesce(s.tipo_servico, 'troca_oleo') as tipo_servico,
    cat.produto_label
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
    on s.id = l.servico_id
  left join public.servicos_catalogo cat
    on cat.id = s.catalogo_id
   and cat.ativo = true;
$$;

revoke execute on function public.dequeue_whatsapp_reminder_messages(integer, integer)
  from public, anon, authenticated;

grant execute on function public.dequeue_whatsapp_reminder_messages(integer, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- match_servicos_catalogo — dedupe em cascata (ADR-0031 §3)
-- ---------------------------------------------------------------------------
-- Criada na F1, consumida na F2. Devolve, para o texto que a oficina falou, os
-- candidatos do escopo (itens da propria oficina + globais) com os tres sinais
-- da cascata separados, para que o agente aplique as faixas de decisao
-- (>= 0.90 usa · 0.75-0.90 pergunta · < 0.75 candidato a novo). A funcao NAO
-- decide e NAO escreve: quem cria item e a oficina, no card de confirmacao
-- (ADR-0001 / ADR-0017).
--
-- `exato` cobre o passo 1 da cascata (slug/alias/nome normalizados, custo zero).
-- `similaridade_texto` e o passo 2 (trigrama sobre nome e aliases).
-- `similaridade_embedding` e o passo 3 (cosseno; null quando nao ha embedding
-- de um dos lados — o item do seed nasce sem embedding e cai no trigrama).
--
-- Uma linha entra no resultado se casar em QUALQUER um dos sinais: sinonimo
-- verdadeiro ("suspensao" x "amortecedor") tem trigrama baixo e cosseno alto,
-- e erro de digitacao ("correa dentada") o oposto.
--
-- SECURITY DEFINER com search_path fixo: le uma tabela service-role only.
-- Revogada nominalmente de anon/authenticated (licao 0001).
create or replace function public.match_servicos_catalogo(
  p_oficina_id uuid,
  p_texto text,
  p_embedding extensions.vector(1536) default null,
  p_limit int default 5,
  p_min_trigram double precision default 0.6,
  p_min_embedding double precision default 0.75
)
returns table (
  id uuid,
  oficina_id uuid,
  escopo text,
  slug text,
  nome text,
  familia text,
  produto_label text,
  aliases text[],
  base text,
  intervalo_dias int,
  intervalo_km int,
  template_name text,
  template_language text,
  exato boolean,
  similaridade_texto double precision,
  similaridade_embedding double precision,
  score double precision
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with entrada as (
    select public.catalogo_normalize_texto(p_texto) as texto
  ),
  candidatos as (
    select
      c.id as c_id,
      c.oficina_id as c_oficina_id,
      c.slug as c_slug,
      c.nome as c_nome,
      c.familia as c_familia,
      c.produto_label as c_produto_label,
      c.aliases as c_aliases,
      c.base as c_base,
      c.intervalo_dias as c_intervalo_dias,
      c.intervalo_km as c_intervalo_km,
      c.template_name as c_template_name,
      c.template_language as c_template_language,
      (
        e.texto is not null
        and (
          c.slug = replace(e.texto, ' ', '-')
          or public.catalogo_normalize_texto(c.nome) = e.texto
          or exists (
            select 1
              from unnest(c.aliases) a
             where public.catalogo_normalize_texto(a) = e.texto
          )
        )
      ) as c_exato,
      greatest(
        similarity(public.catalogo_normalize_texto(c.nome), coalesce(e.texto, '')),
        coalesce(
          (
            select max(similarity(public.catalogo_normalize_texto(a), e.texto))
              from unnest(c.aliases) a
          ),
          0
        )
      )::double precision as c_sim_texto,
      case
        when p_embedding is null or c.embedding is null then null
        else (1 - (c.embedding operator(extensions.<=>) p_embedding))::double precision
      end as c_sim_embedding
    from public.servicos_catalogo c
    cross join entrada e
    where c.ativo = true
      and (c.oficina_id = p_oficina_id or c.oficina_id is null)
  )
  select
    k.c_id,
    k.c_oficina_id,
    case when k.c_oficina_id is null then 'global' else 'oficina' end,
    k.c_slug,
    k.c_nome,
    k.c_familia,
    k.c_produto_label,
    k.c_aliases,
    k.c_base,
    k.c_intervalo_dias,
    k.c_intervalo_km,
    k.c_template_name,
    k.c_template_language,
    k.c_exato,
    k.c_sim_texto,
    k.c_sim_embedding,
    case
      when k.c_exato then 1::double precision
      else greatest(k.c_sim_texto, coalesce(k.c_sim_embedding, 0))
    end
  from candidatos k
  where k.c_exato
     or k.c_sim_texto >= p_min_trigram
     or k.c_sim_embedding >= p_min_embedding
  order by
    k.c_exato desc,
    -- item da oficina antes do global no empate (false ordena antes de true)
    (k.c_oficina_id is null),
    case
      when k.c_exato then 1::double precision
      else greatest(k.c_sim_texto, coalesce(k.c_sim_embedding, 0))
    end desc
  limit greatest(coalesce(p_limit, 5), 1);
$$;

comment on function public.match_servicos_catalogo(uuid, text, extensions.vector, int, double precision, double precision) is
  'Candidatos do catalogo para um texto livre (ADR-0031 §3). Devolve exato/trigrama/cosseno separados; a decisao e do agente + confirmacao da oficina.';

revoke all on function public.match_servicos_catalogo(uuid, text, extensions.vector, int, double precision, double precision)
  from public, anon, authenticated;

grant execute on function public.match_servicos_catalogo(uuid, text, extensions.vector, int, double precision, double precision)
  to service_role;
