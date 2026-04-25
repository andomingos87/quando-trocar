create index if not exists mensagens_lead_id_idx
  on public.mensagens (lead_id);

create index if not exists agent_tool_calls_lead_id_idx
  on public.agent_tool_calls (lead_id);

create index if not exists outbound_messages_conversa_id_idx
  on public.outbound_messages (conversa_id);

create index if not exists outbound_messages_lead_id_idx
  on public.outbound_messages (lead_id);
