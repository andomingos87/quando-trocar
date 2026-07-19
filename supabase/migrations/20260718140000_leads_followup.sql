-- ============================================================================
-- CV4 (QTR-13): follow-up proativo de leads.
-- Fonte: docs/backlog-whatsapp-bot/fase-camada-conversacional.md (Fase CV4),
--        docs/regras-de-negocio.md §1.
-- Reengajamento de leads que esfriaram: até 2 follow-ups por lead via template
-- Meta aprovado (fora da janela de 24h — ADR-0005). O controle de idempotência
-- e do cap de 2 vive nestas duas colunas; o job só as avança após envio com
-- sucesso, então rodar o cron 2× no mesmo dia nunca duplica um envio.
-- ============================================================================

alter table public.leads_oficina
  add column if not exists followup_count int not null default 0,
  add column if not exists last_followup_at timestamptz;

-- Índice para a seleção do job: leads reengajáveis (poucos follow-ups) ordenados
-- pela última interação. Parcial para não indexar leads já esgotados (>= 2).
create index if not exists leads_oficina_followup_idx
  on public.leads_oficina (status, last_message_at)
  where followup_count < 2 and deleted_at is null;

comment on column public.leads_oficina.followup_count is
  'Quantos follow-ups proativos já saíram para este lead (cap 2 — CV4).';
comment on column public.leads_oficina.last_followup_at is
  'Quando saiu o último follow-up proativo. Idempotência do cron de reengajamento (CV4).';
