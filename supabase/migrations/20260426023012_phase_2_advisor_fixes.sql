alter function public.register_service_with_reminder(
  uuid,
  text,
  text,
  text,
  text,
  date,
  numeric,
  boolean
) set search_path = public, pg_temp;

create index if not exists agent_tool_calls_oficina_id_idx
  on public.agent_tool_calls (oficina_id);

create index if not exists agent_tool_calls_cliente_id_idx
  on public.agent_tool_calls (cliente_id);

create index if not exists mensagens_cliente_id_idx
  on public.mensagens (cliente_id);

create index if not exists outbound_messages_cliente_id_idx
  on public.outbound_messages (cliente_id);

create index if not exists veiculos_cliente_id_idx
  on public.veiculos (cliente_id);

create index if not exists servicos_veiculo_id_idx
  on public.servicos (veiculo_id);

create index if not exists lembretes_cliente_id_idx
  on public.lembretes (cliente_id);

create index if not exists lembretes_veiculo_id_idx
  on public.lembretes (veiculo_id);

create index if not exists lembretes_servico_id_idx
  on public.lembretes (servico_id);
