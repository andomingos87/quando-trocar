-- Perguntas que o modo respond (ADR-0022) nao soube responder (dontKnow).
-- Volante de aprendizado (ADR-0023): o admin transforma cada registro em FAQ
-- (faq_vendas) e o bot aprende sem deploy.

create table public.perguntas_sem_resposta (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  lead_id uuid references public.leads_oficina(id) on delete set null,
  oficina_id uuid references public.oficinas(id) on delete set null,
  agent_mode text not null,
  pergunta text not null,
  resposta_enviada text not null,
  motivo text not null default 'dont_know',
  geracao_modo text not null,
  prompt_version text not null,
  status text not null default 'aberta',
  created_at timestamptz not null default now(),
  constraint perguntas_sem_resposta_motivo_check
    check (motivo in ('dont_know', 'reprovada', 'erro')),
  constraint perguntas_sem_resposta_geracao_modo_check
    check (geracao_modo in ('sombra', 'on')),
  constraint perguntas_sem_resposta_status_check
    check (status in ('aberta', 'resolvida', 'ignorada'))
);

create index perguntas_sem_resposta_status_created_at_idx
  on public.perguntas_sem_resposta (status, created_at desc);
create index perguntas_sem_resposta_conversa_id_idx
  on public.perguntas_sem_resposta (conversa_id);
create index perguntas_sem_resposta_lead_id_idx
  on public.perguntas_sem_resposta (lead_id);
create index perguntas_sem_resposta_oficina_id_idx
  on public.perguntas_sem_resposta (oficina_id);

alter table public.perguntas_sem_resposta enable row level security;
-- Nenhuma policy criada de proposito: acesso apenas via service-role
-- (bot e painel admin no server). Nao queremos leitura anonima.

comment on table public.perguntas_sem_resposta is
  'Perguntas que o modo respond nao soube responder (dontKnow). Volante de aprendizado: viram FAQ em faq_vendas sem deploy (ADR-0023).';
comment on column public.perguntas_sem_resposta.resposta_enviada is
  'A resposta enlatada que saiu no lugar da geracao (fallback).';
comment on column public.perguntas_sem_resposta.motivo is
  'v1 grava apenas dont_know; reprovada/erro reservados para extensao.';
comment on column public.perguntas_sem_resposta.status is
  'Fluxo da tela admin futura: aberta -> resolvida (virou FAQ) | ignorada.';
