alter table public.whatsapp_events
  add column if not exists processing_status text not null default 'received',
  add column if not exists processing_error_type text,
  add column if not exists processing_error_message text,
  add column if not exists processing_error_context jsonb;

alter table public.whatsapp_events
  add constraint whatsapp_events_processing_status_check
  check (processing_status in ('received', 'processed', 'failed'));

create index if not exists whatsapp_events_processing_status_created_at_idx
  on public.whatsapp_events (processing_status, created_at);
