-- Add 'cobranca' to the allowed values of conversas.agent_mode.
-- Quando oficina entra em modo de cobranca (inadimplencia ou winback voluntario),
-- o webhook roteia para o cobranca-agent ao inves de bloquear com mensagem fixa.

alter table public.conversas
  drop constraint if exists conversas_agent_mode_check;

alter table public.conversas
  add constraint conversas_agent_mode_check
  check (agent_mode in (
    'vendas',
    'onboarding',
    'operacao',
    'cliente_final_lembrete',
    'suporte',
    'cobranca'
  ));
