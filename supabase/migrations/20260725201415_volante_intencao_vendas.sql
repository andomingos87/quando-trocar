-- QTR-35 P1-4c / ADR-0028: diferenças entre a regra determinística e a
-- classificação LLM. O volante só aceita promover intents não-terminais:
-- perda continua exclusiva de isExplicitLossMessage no backend.

create table if not exists public.divergencias_intencao_vendas (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads_oficina(id) on delete set null,
  mensagem text not null,
  intent_deterministico text not null,
  confidence_deterministica numeric not null,
  intent_llm text not null,
  confidence_llm numeric not null,
  intent_aplicado text not null,
  status text not null default 'aberta',
  created_at timestamptz not null default now(),
  constraint divergencias_intencao_vendas_mensagem_length_check
    check (char_length(mensagem) between 1 and 500),
  constraint divergencias_intencao_vendas_status_check
    check (status in ('aberta', 'promovida', 'ignorada'))
);

create index if not exists divergencias_intencao_vendas_status_created_at_idx
  on public.divergencias_intencao_vendas (status, created_at desc);
create index if not exists divergencias_intencao_vendas_conversa_id_idx
  on public.divergencias_intencao_vendas (conversa_id);
create index if not exists divergencias_intencao_vendas_lead_id_idx
  on public.divergencias_intencao_vendas (lead_id);

alter table public.divergencias_intencao_vendas enable row level security;
-- Sem policies de propósito: é auditoria interna do bot/painel server-side.

create table if not exists public.gatilhos_intencao_vendas (
  id uuid primary key default gen_random_uuid(),
  padrao text not null,
  intent text not null,
  ativo boolean not null default true,
  origem_divergencia_id uuid references public.divergencias_intencao_vendas(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gatilhos_intencao_vendas_padrao_length_check
    check (char_length(btrim(padrao)) between 2 and 200),
  constraint gatilhos_intencao_vendas_intent_safe_check
    check (intent in (
      'quer_testar',
      'pergunta_preco',
      'pergunta_funcionamento',
      'quer_humano',
      'vai_pensar'
    )),
  constraint gatilhos_intencao_vendas_padrao_unique unique (padrao)
);

create index if not exists gatilhos_intencao_vendas_ativo_created_at_idx
  on public.gatilhos_intencao_vendas (ativo, created_at desc);

alter table public.gatilhos_intencao_vendas enable row level security;
-- Sem policies de propósito: promoção é operação interna via service-role.

comment on table public.divergencias_intencao_vendas is
  'Auditoria de divergências entre classificação determinística e LLM em vendas. Volante da ADR-0028; não altera estado de lead.';
comment on column public.divergencias_intencao_vendas.intent_aplicado is
  'Intent decidido pelo backend após os guardrails; LLM nunca decide estado terminal.';
comment on table public.gatilhos_intencao_vendas is
  'Padrões promovidos manualmente a partir de divergências. Só intents comerciais não-terminais podem ser ativados sem deploy.';
