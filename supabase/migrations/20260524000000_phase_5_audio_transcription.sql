-- Fase 5: suporte a áudio via transcrição Whisper.
-- ADR-0015 (docs/adr/0015-suporte-audio-whisper.md).
--
-- Adiciona colunas em `mensagens` para distinguir áudio de texto,
-- armazenar o `media_id` Meta, a transcrição, o status e a duração do áudio.
-- O áudio bruto NÃO é armazenado — só a transcrição.

alter table public.mensagens
  add column media_type text not null default 'text'
    check (media_type in ('text', 'audio')),
  add column media_id text,
  add column transcription text,
  add column transcription_status text
    check (transcription_status in ('success', 'failed', 'empty', 'timeout')),
  add column transcription_error text,
  add column audio_duration_ms integer
    check (audio_duration_ms is null or audio_duration_ms >= 0);

-- Índice parcial: só interessa filtrar mensagens não-texto.
create index if not exists mensagens_media_type_idx
  on public.mensagens (media_type)
  where media_type <> 'text';

comment on column public.mensagens.media_type is
  'Tipo da mídia recebida: text (padrão) ou audio. Apenas inbound usa audio; outbound sempre text.';
comment on column public.mensagens.media_id is
  'ID Meta do arquivo de áudio original (mensagens.audio.id no payload). NULL para mensagens de texto.';
comment on column public.mensagens.transcription is
  'Transcrição Whisper do áudio. Mesmo valor de `body` quando transcription_status = success. NULL para mensagens de texto.';
comment on column public.mensagens.transcription_status is
  'Status da chamada Whisper: success, failed, empty (transcrição vazia) ou timeout. NULL para mensagens de texto.';
comment on column public.mensagens.transcription_error is
  'Mensagem de erro Whisper quando transcription_status = failed. NULL caso contrário.';
comment on column public.mensagens.audio_duration_ms is
  'Duração do áudio em milissegundos (medida no servidor antes/durante transcrição). NULL para mensagens de texto.';
