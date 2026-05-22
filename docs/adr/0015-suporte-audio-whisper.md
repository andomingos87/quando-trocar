# ADR 0015: Suporte a áudio via transcrição Whisper

- **Status**: accepted
- **Data**: 2026-05-21
- **Decisores**: Anderson Domingos
- **Fonte**: `docs/backlog-whatsapp-bot/fase-5-audio.md`

## Contexto

Até esta ADR, o parser de webhook em `lib/whatsapp/payload.ts` aceita exclusivamente mensagens com `type === "text"`. Áudios (notas de voz), imagens, documentos e demais tipos de mídia entram no webhook e são descartados silenciosamente — o cliente final ou a oficina manda um áudio e o bot fica mudo. Em conversas comerciais isso queima a chance de qualificar o lead; em onboarding e cobrança vira fricção pura.

A frequência de áudios em conversas reais de WhatsApp no Brasil é alta o suficiente para justificar suporte nativo. Esta ADR registra como o bot passa a aceitar áudio, com o mínimo de cirurgia no fluxo existente.

## Decisão

**O bot transcreve áudios via OpenAI Whisper (modelo `whisper-1`, idioma fixo `pt`) de forma síncrona dentro do webhook, com timeout duro de 15s. A transcrição vira o `inbound.body` consumido pelos agentes; quando falha, cada agente responde com um fallback no seu próprio tom pedindo texto.**

### Pontos de decisão

1. **Síncrono dentro do webhook (não fila).** Latência aceitável para áudios típicos (5–30s). Áudios longos (>2min) ou erro de provedor caem no fallback. Evita componente novo de infra (worker, fila) que só faria sentido em volumes muito maiores.
2. **Não armazenar o áudio bruto.** Apenas a transcrição é persistida em `mensagens.transcription`, e o `media_id` original fica na `mensagens.raw_payload` para rastreabilidade. Reduz custo, simplifica LGPD, evita primeira dependência de Supabase Storage neste projeto.
3. **Fallback contextual por agente.** Vendas, onboarding, lembrete, suporte e cobrança têm cada um sua mensagem no tom certo — centralizado em `lib/whatsapp/audio-fallbacks.ts`. Mantém UX coerente com o agente em cena.
4. **Lead e oficina ambos transcritos.** Sem distinção de `participant_type` no parser; qualquer áudio é tratado igual.
5. **Idioma fixo `pt`.** Sem auto-detect — todos os clientes/oficinas falam PT-BR e auto-detect erra em áudios curtos.
6. **Timeout duro de 15s.** Webhook Meta exige `200 OK` em < 20s ou retenta; 15s deixa margem para download + transcrição + envio de resposta.

### Arquitetura

- **Parser (`payload.ts`)**: aceita `type === "audio"`, extrai `audio.id` para `mediaId`, deixa `body` vazio nesse momento.
- **Webhook (`webhook-handler.ts`)**: antes do roteamento, para cada inbound com `mediaType === 'audio'`, faz `getMediaUrl` + `downloadMedia` + `transcribeAudio`. Se sucesso, popula `inbound.body` com transcrição e segue fluxo normal. Se falha, resolve o `agent_mode` mesmo assim, envia o fallback contextual e **não chama o agente**.
- **Cliente WhatsApp (`whatsapp-client.ts`)**: novos helpers `getMediaUrl` (GET `/{media_id}`) e `downloadMedia` (GET URL assinada com Bearer). Mesmo `WHATSAPP_ACCESS_TOKEN` já existente.
- **Helper de transcrição (`lib/whatsapp/transcription.ts`)**: `transcribeAudio(openai, buffer, mime)` com Promise.race contra timeout, retornando discriminated union `{ status: 'success' | 'empty' | 'timeout' | 'failed' }`.
- **Repository**: `saveInboundMessage` aceita `mediaType`, `mediaId`, `transcription`, `transcriptionStatus`, `transcriptionError`, `audioDurationMs`.
- **Schema** (`mensagens`): colunas novas — `media_type` (default 'text'), `media_id`, `transcription`, `transcription_status`, `transcription_error`, `audio_duration_ms`.

### Compatibilidade com ADRs existentes

- **ADR-0001 (LLM como conselheiro)**: respeitada — transcrição é dado de entrada, não muda `lead.status`, `agent_mode`, `participant_type` ou estado de pagamento.
- **ADR-0004 (webhook persiste antes de processar)**: respeitada — a transcrição roda antes do insert em `mensagens`, e o registro nasce completo com `body` (transcrição ou string vazia) + `transcription_status`.
- **ADR-0006 (idempotência via provider_event_id)**: respeitada — áudio reentregue cai no mesmo UNIQUE constraint; nenhuma lógica extra.

## Alternativas descartadas

1. **Fila assíncrona com worker dedicado.** Evita risco de timeout do webhook em áudios longos, mas adiciona um componente novo (semelhante a `reminder-worker.ts`), aumenta latência percebida e complica a observabilidade. Volume atual não justifica.
2. **Guardar áudio bruto no Supabase Storage.** Permitiria re-transcrever se Whisper errar e auditoria humana posterior. Mas: nunca usamos Storage no projeto (primeira dependência), custo cresce com volume, e LGPD fica mais delicada (consentimento de armazenamento). Apenas transcrição cobre 95% dos casos; auditoria humana fica possível via `raw_payload.audio.id` mesmo a URL Meta expirando (a oficina ainda lembra o contexto).
3. **Fallback genérico único.** Uma única mensagem padrão "não consegui entender, mande por texto" para todos os agentes. Simples, mas quebra o tom — em vendas dá amador, em cobrança dá frio. Manter contextual mesmo com mais código vale a coerência de marca.
4. **Suportar imagem/documento/sticker no mesmo escopo.** Mídia visual exigiria modelo multimodal (GPT-4 Vision) e prompts dedicados por agente. Fora do MVP — fica para fase futura.
5. **Auto-detecção de idioma do Whisper.** Falha em áudios curtos com inglês de marca ("óleo Mobil 1") detectado como inglês. Fixar `pt` é robusto e suficiente.

## Consequências

- **Positivas:**
  - Bot deixa de ficar mudo diante de áudio — UX significativamente melhor.
  - Custo previsível: Whisper US$0.006/min × volume estimado < US$3/dia mesmo em pico.
  - Arquitetura mínima: nenhuma fila nova, nenhum bucket novo, nenhum env var novo.

- **Negativas / a monitorar:**
  - Áudios longos (>2min) sempre caem no fallback. Aceitável — esses raramente trazem informação útil pro fluxo.
  - Custo Whisper escala com volume; rever em 90 dias.
  - Whisper pode interpretar errado nomes próprios e termos automotivos regionais (ex.: "perfect" ↔ "perfeito"). Sem revisão humana, agente decide com base na transcrição literal. Aceitável — a oficina ainda pode corrigir manualmente quando a resposta do bot não bater com a intenção do cliente.
  - Nenhum mecanismo de retranscrição automática caso a oficina sinalize erro. Fica como melhoria futura (Fase 6).

## Métricas a acompanhar

- % de mensagens inbound com `media_type = 'audio'`.
- Distribuição de `transcription_status` (success / failed / empty / timeout).
- Latência média de `audio_duration_ms` × tempo de transcrição.
- Custo OpenAI/mês atribuível a Whisper (separado do custo dos agentes texto).
