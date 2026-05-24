# ADR 0016: Suporte a imagem (vision) e documento PDF, sem Supabase Storage

- **Status**: accepted
- **Data**: 2026-05-21
- **Decisores**: Anderson Domingos
- **Estende**: [ADR-0015](./0015-suporte-audio-whisper.md) (transcrição de áudio Whisper)

## Contexto

A ADR-0015 trouxe suporte a áudio e listou explicitamente como **alternativa descartada**: "Suportar imagem/documento/sticker no mesmo escopo. Mídia visual exigiria modelo multimodal (GPT-4 Vision) e prompts dedicados por agente. Fora do MVP — fica para fase futura."

Desde então, a F0 fechou o silêncio do bot para todos os tipos de mídia (sticker, video, location, contacts e qualquer tipo desconhecido respondem com fallback contextual). Resta processar imagem e PDF — os dois casos com valor real no fluxo de oficina:

- **Imagem**: foto de odômetro, painel, nota fiscal, peça/serviço identificável. Hoje a oficina manda foto e o bot pede para descrever em texto, jogando trabalho de volta na oficina.
- **PDF**: orçamento esporádico, nota de serviço, comprovante. Volume baixo, mas dá pra extrair texto sem custo de modelo.

O cliente final raramente envia imagem/PDF para o fluxo `cliente_final_lembrete` — esses casos são predominantemente da `oficina_cliente` e `lead_oficina`.

## Decisão

**O bot processa imagem com `gpt-4o-mini` em modo vision e PDF com `unpdf` (extração de texto local), de forma síncrona dentro do webhook, sem armazenar a mídia bruta. Em qualquer falha o branch de fallback contextual da F0 (definido em `unsupported-media-fallbacks.ts`) é reaproveitado — com mensagens já cobrindo `image` e `document`.**

### Pontos de decisão

1. **Síncrono dentro do webhook** — segue ADR-0015. Vision com timeout 12s; PDF com timeout 8s. Mantém arquitetura mínima.
2. **Sem Supabase Storage** — confirma ADR-0015 ponto 2. Bytes são lidos via `WhatsAppCloudApiClient.downloadMedia` (já existe) e descartados após o processamento. Transcrição/descrição vira `mensagens.body` igual ao áudio. `media_id` original em `raw_payload` para rastreabilidade.
3. **`gpt-4o-mini` para imagem** — mesma família dos classificadores já em uso por `sales-agent` e `onboarding-agent`. Suporta image_url multimodal nativamente.
4. **`unpdf` para PDF** — biblioteca pure-JS, sem binário, funciona em runtime serverless. Quando `unpdf` retornar menos que 50 chars (PDF escaneado), cai no fallback — não roteamos pra vision pra evitar custos imprevisíveis com PDFs grandes.
5. **Rate limit por oficina** — `WHATSAPP_MEDIA_DAILY_LIMIT` (default 50/dia/oficina) aplicado em image+document combinados. Excedido → fallback contextual. Áudio segue sem rate limit (custo Whisper é menor).
6. **Reuso do fallback da F0** — `unsupported-media-fallbacks.ts` já tem entradas `image` e `document` por `agent_mode`. Quando vision/PDF falham, a mesma copy é enviada. Sem duplicar lógica.
7. **Prompt vision em pt-BR contextualizado** — explicita "oficina mecânica", pede 1 frase com odômetro/placa/valor/peça quando aplicável, e tem uma sentinela ("imagem sem conteúdo extraível") que cai pro fallback. Limitar a 1 frase mantém o `body` que vai para o agente compacto.
8. **Idempotência** — Mesma garantia de ADR-0015. Reentrega do Meta cai no `provider_event_id` UNIQUE; vision/PDF não são chamados duas vezes.

### Arquitetura

- **Parser (`payload.ts`)**: já emite `mediaType` para image/document (F0).
- **Webhook (`webhook-handler.ts`)**: antes do branch de fallback, processa image/document análogo ao áudio:
  - `getMediaMetadata` + `downloadMedia` (Cloud API client).
  - `processImage` (vision) ou `processDocument` (unpdf).
  - Sucesso: popula `inbound.body = "[imagem] " + descrição` ou `"[documento] " + texto`. Segue para o agente.
  - Falha: cai no branch de fallback da F0 com o `mediaType` correspondente.
- **Helpers**:
  - `lib/whatsapp/image-vision.ts` — análogo a `transcription.ts`. `processImage({ openai, buffer, mime, caption, timeoutMs })` retorna discriminated union `{ status: 'success' | 'empty' | 'timeout' | 'failed' }`.
  - `lib/whatsapp/document-text.ts` — `processDocument({ buffer, mime, timeoutMs })` retorna o mesmo tipo de union.
- **Schema** (`mensagens`): nada novo. `media_type` já aceita `image`/`document` (migration `20260525000000_mensagens_media_types_extra.sql`). Reaproveita `transcription` e `transcription_status` para gravar a descrição/texto extraído. (Renomear coluna seria churn desnecessário — o nome continua "transcription" mas comporta também extração de imagem/PDF; documentado em `regras-de-negocio.md §17.7`.)
- **Repository**: `saveInboundMessage` aceita os mesmos campos já existentes — nenhum diff de signature.
- **Rate limit**: novo método em repository — `countMediaMessagesInLastDay({ oficinaId })`. Chamado pelos pipelines antes da chamada externa.

### Compatibilidade com ADRs existentes

- **ADR-0001**: respeitada — descrição vision e texto PDF são dados de entrada; não alteram `lead.status`, `agent_mode`, `participant_type` ou estado de pagamento.
- **ADR-0004**: respeitada — processamento roda antes do insert, registro nasce completo.
- **ADR-0006**: respeitada — idempotência via `provider_event_id`.
- **ADR-0015**: estendida. Ponto 2 (não armazenar mídia bruta) é **reafirmado** e expandido para imagem/PDF. A alternativa #4 (que descartava imagem/documento) é **substituída** por esta decisão.

## Alternativas descartadas

1. **Persistir imagem/PDF no Supabase Storage** — daria replay e auditoria humana. Não compensa: introduz primeira dependência de Storage, RLS, cron de TTL, revisão LGPD. Custo > benefício no volume atual. Auditoria via `raw_payload.image.id` é suficiente quando a oficina manda novamente.
2. **GPT-4o (não mini) para vision** — qualidade marginalmente melhor em OCR de notas, mas 5× mais caro. `gpt-4o-mini` cobre o cenário 90%+. Migrar pra GPT-4o se a métrica de "imagem sem conteúdo extraível" passar de 15%.
3. **Tesseract / OCR local para imagem** — sem dependência de OpenAI, mas qualidade muito inferior em fotos com ângulo / iluminação variável. Não compensa o esforço.
4. **Renderizar PDF e mandar pro vision** — daria suporte a PDF escaneado. Mas: requer pdf-rendering (canvas/sharp), custos dobram (extração + vision), e PDF escaneado é raro no fluxo. Fica como melhoria futura.
5. **Agente dedicado de mídia** — interpretar a imagem com contexto da conversa atual antes de enviar pro agente em cena. Adicionaria complexidade pra ganho marginal — a descrição literal já é informação suficiente no `body`.
6. **Suportar vídeo** — Meta entrega vídeo, mas não há modelo viável de áudio+vídeo ao mesmo tempo neste contexto. Fora de escopo.

## Consequências

- **Positivas:**
  - Bot interpreta foto de odômetro/painel/nota — tira fricção real do fluxo `operacao` e `vendas`.
  - PDF de orçamento entra no agente sem oficina precisar redigitar.
  - Sem Supabase Storage: mantém arquitetura enxuta.
  - Rate limit por oficina protege o custo.

- **Negativas / a monitorar:**
  - Custo OpenAI cresce com volume. `gpt-4o-mini` vision ≈ US$0.001/imagem em qualidade baixa, ≈ US$0.005 em alta. Esperar < US$5/dia em pico.
  - Vision pode alucinar números (odômetro, placa) — agente em cena precisa estar preparado para tratar dado como contexto, não como fato absoluto. Mesmo princípio do Whisper.
  - PDFs grandes ( > 10 páginas) truncados em 2000 chars — pode perder informação. Aceitável no MVP.
  - Sentinela "imagem sem conteúdo extraível" pode ser produzida espuriamente pelo modelo. Mitigar com prompt-engineering iterativo.
  - Rate limit é por oficina via SQL count — se a query for lenta com tabela grande, virar contador em redis/cache. Hoje custo aceitável.

## Métricas a acompanhar

- % de inbound com `media_type = 'image'` e `'document'`.
- Distribuição de status vision/PDF (success/empty/timeout/failed).
- Latência p95 do POST do webhook quando há imagem (objetivo: < 12s).
- Custo OpenAI atribuível a vision (separado do Whisper e dos agentes de texto).
- Quantos fallbacks foram disparados por rate limit (ajustar threshold se >5% das oficinas).
