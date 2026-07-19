-- ============================================================================
-- CV7 (QTR-16): métricas da camada conversacional para o admin.
-- Fonte: docs/backlog-whatsapp-bot/fase-camada-conversacional.md (Fase CV7).
-- Agrega sobre agent_tool_calls (geração) / conversas (handoff) / mensagens.
-- RPC SECURITY DEFINER, só service-role (painel admin no server).
-- ============================================================================

create or replace function public.get_conversational_metrics(p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with since as (
    select now() - make_interval(days => greatest(1, least(p_days, 90))) as ts
  ),
  gen as (
    select
      count(*) filter (where tool_name = 'reply_generation') as total,
      count(*) filter (
        where tool_name = 'reply_generation'
          and (output->>'usedFallback')::boolean is false
      ) as enviada_gerada,
      count(*) filter (
        where tool_name = 'reply_generation'
          and (output->>'usedFallback')::boolean is true
      ) as enviada_enlatada,
      count(*) filter (
        where tool_name = 'reply_generation'
          and (output->>'approved')::boolean is false
          and coalesce(output->>'rejectionReason','') not in
              ('generation_dont_know','generation_failed_or_null')
      ) as reprovada
    from public.agent_tool_calls, since
    where created_at >= since.ts
  ),
  by_intent as (
    select coalesce(
      jsonb_agg(jsonb_build_object('intent', intent, 'total', total) order by total desc),
      '[]'::jsonb
    ) as arr
    from (
      select coalesce(input->>'intent', 'desconhecido') as intent, count(*) as total
      from public.agent_tool_calls, since
      where tool_name = 'reply_generation' and created_at >= since.ts
      group by 1
    ) t
  ),
  handoff as (
    select
      count(*) filter (where tool_name = 'handoff_summary') as handoff_events
    from public.agent_tool_calls, since
    where created_at >= since.ts
  ),
  msgs as (
    select
      count(*) filter (where direction = 'inbound') as inbound,
      count(*) filter (where direction = 'outbound') as outbound
    from public.mensagens, since
    where created_at >= since.ts
  ),
  handoff_now as (
    select count(*) filter (where handoff_required) as em_handoff,
           count(*) as total
    from public.conversas
  )
  select jsonb_build_object(
    'periodoDias', greatest(1, least(p_days, 90)),
    'geracao', jsonb_build_object(
      'total', gen.total,
      'enviadaGerada', gen.enviada_gerada,
      'enviadaEnlatada', gen.enviada_enlatada,
      'reprovada', gen.reprovada
    ),
    'porIntent', by_intent.arr,
    'handoffEventos', handoff.handoff_events,
    'conversasEmHandoff', handoff_now.em_handoff,
    'conversasTotal', handoff_now.total,
    'mensagens', jsonb_build_object('inbound', msgs.inbound, 'outbound', msgs.outbound)
  )
  from gen, by_intent, handoff, msgs, handoff_now;
$$;

revoke all on function public.get_conversational_metrics(int)
  from public, anon, authenticated;
