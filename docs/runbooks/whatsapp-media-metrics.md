# Runbook · Métricas de ingestão de mídia WhatsApp

Queries SQL para acompanhar o pipeline de mídia descrito na [ADR-0015](../adr/0015-suporte-audio-whisper.md) (áudio) e na [ADR-0016](../adr/0016-suporte-imagem-pdf-sem-storage.md) (imagem e PDF).

> Rodar em `supabase studio → SQL editor` ou via `psql` direto na conexão de produção. Nenhuma das queries faz escrita.

## Volume diário por tipo de mídia

Onde estamos gastando atenção do bot.

```sql
select
  date_trunc('day', created_at)::date as dia,
  media_type,
  count(*) as total
from public.mensagens
where direction = 'inbound'
  and created_at > now() - interval '30 days'
group by 1, 2
order by 1 desc, 2;
```

## Distribuição de status (sucesso / vazio / timeout / falha)

Identifica problemas no pipeline (alto `failed` → revisar OpenAI; alto `timeout` → revisar tamanho de arquivos; alto `empty` em imagem → ajustar prompt).

```sql
select
  media_type,
  transcription_status,
  count(*) as total,
  round(100.0 * count(*) / sum(count(*)) over (partition by media_type), 1) as pct_do_tipo
from public.mensagens
where direction = 'inbound'
  and media_type in ('audio', 'image', 'document')
  and created_at > now() - interval '30 days'
group by 1, 2
order by 1, 2;
```

## Custo aproximado por dia (estimativa)

A coluna `transcription_status = 'success'` é proxy razoável de chamadas pagas. Custos baseados em `gpt-4o-mini` (vision) e `whisper-1`.

```sql
with por_dia as (
  select
    date_trunc('day', created_at)::date as dia,
    media_type,
    count(*) filter (where transcription_status = 'success') as ok,
    count(*) filter (where transcription_status in ('failed','timeout','empty')) as fail
  from public.mensagens
  where direction = 'inbound'
    and media_type in ('audio','image','document')
    and created_at > now() - interval '30 days'
  group by 1, 2
)
select
  dia,
  media_type,
  ok,
  fail,
  case media_type
    when 'audio'    then ok * 0.003       -- ~$0.003 por chamada Whisper média (30s)
    when 'image'    then ok * 0.001       -- ~$0.001 por chamada gpt-4o-mini vision low detail
    when 'document' then 0                -- unpdf é local, sem custo OpenAI
  end as custo_usd_aprox
from por_dia
order by dia desc, media_type;
```

## Quais oficinas consomem mais mídia

Útil pra detectar abuso e calibrar `WHATSAPP_MEDIA_DAILY_LIMIT`.

```sql
select
  m.oficina_id,
  o.nome as oficina,
  count(*) filter (where media_type = 'image')    as imagens,
  count(*) filter (where media_type = 'document') as documentos,
  count(*) filter (where media_type = 'audio')    as audios
from public.mensagens m
left join public.oficinas o on o.id = m.oficina_id
where m.direction = 'inbound'
  and m.media_type <> 'text'
  and m.created_at > now() - interval '7 days'
group by 1, 2
order by (
  count(*) filter (where media_type = 'image')
  + count(*) filter (where media_type = 'document')
  + count(*) filter (where media_type = 'audio')
) desc
limit 20;
```

## Quantos rate limits foram disparados

```sql
select
  date_trunc('day', created_at)::date as dia,
  count(*) as rate_limits
from public.mensagens
where direction = 'inbound'
  and transcription_error = 'rate_limit'
  and created_at > now() - interval '30 days'
group by 1
order by 1 desc;
```

Se este número crescer rápido sobre uma minoria de oficinas, considerar:
1. Ampliar `WHATSAPP_MEDIA_DAILY_LIMIT` (env, default 50).
2. Investigar se a oficina está mandando mídia inadvertidamente (foto repetida do mesmo cliente, etc.).

## Latência de processamento

Comparar tempo de transcrição vs tamanho do áudio (para áudio existe `audio_duration_ms`; para imagem/PDF a `duration` está em logs do servidor, não no DB ainda).

```sql
select
  date_trunc('day', created_at)::date as dia,
  percentile_cont(0.5)  within group (order by audio_duration_ms) as p50_ms,
  percentile_cont(0.95) within group (order by audio_duration_ms) as p95_ms,
  max(audio_duration_ms) as max_ms
from public.mensagens
where direction = 'inbound'
  and media_type = 'audio'
  and audio_duration_ms is not null
  and created_at > now() - interval '7 days'
group by 1
order by 1 desc;
```

## Tipos de mídia que ainda caem em fallback (`sticker`, `video`, etc.)

Indicador de quanto valor está sendo perdido por não suportar esses tipos.

```sql
select
  media_type,
  count(*) as ocorrencias
from public.mensagens
where direction = 'inbound'
  and media_type in ('sticker','video','location','contacts','unsupported')
  and created_at > now() - interval '30 days'
group by 1
order by 2 desc;
```

Se algum tipo superar 5% do volume total de mídia, vale priorizar pipeline próprio.
