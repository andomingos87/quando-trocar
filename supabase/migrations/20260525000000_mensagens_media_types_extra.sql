-- Fase 5.1: amplia o CHECK de `mensagens.media_type` para incluir os demais
-- tipos suportados pela Cloud API do WhatsApp. A ADR-0015 cobriu só áudio;
-- a ADR-0016 estende para image e document (com pipeline próprio) e adiciona
-- fallback contextual para sticker, video, location, contacts e unsupported.
--
-- O default permanece 'text' e nenhuma linha existente precisa ser migrada
-- (todas têm media_type='text' ou 'audio').

alter table public.mensagens
  drop constraint if exists mensagens_media_type_check;

alter table public.mensagens
  add constraint mensagens_media_type_check
  check (media_type in (
    'text',
    'audio',
    'image',
    'document',
    'sticker',
    'video',
    'location',
    'contacts',
    'unsupported'
  ));

comment on column public.mensagens.media_type is
  'Tipo da mídia recebida. text/audio: pipeline texto/Whisper. image/document: pipeline vision/PDF (ADR-0016). sticker/video/location/contacts/unsupported: apenas fallback contextual, sem processamento.';
