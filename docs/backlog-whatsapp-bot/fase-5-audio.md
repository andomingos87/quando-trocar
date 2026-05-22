# Fase 5 — Suporte a áudio (notas de voz)

> **Status**: em implementação
> **Data**: 2026-05-21
> **ADR de referência**: [0015 — Suporte a áudio via Whisper](../adr/0015-suporte-audio-whisper.md)

## Objetivo

Permitir que leads e oficinas mandem áudios pelo WhatsApp e sejam atendidos pelos mesmos 5 agentes (vendas, onboarding, lembrete, suporte, cobrança), com transcrição automática via OpenAI Whisper e fallback contextual quando a transcrição falhar.

## Por que agora

Conversas reais de WhatsApp no Brasil têm volume alto de áudios. Hoje o bot fica mudo nesses casos — `lib/whatsapp/payload.ts:73` descarta tudo que não é `type === "text"`. Conversão de venda cai, e oficinas precisam intervir manualmente em casos que o bot resolveria sozinho.

## Escopo

Inclui:

- Aceitar mensagens Meta com `type === "audio"` no parser.
- Baixar o áudio via Graph API (`GET /{media_id}` → URL assinada → GET com Bearer).
- Transcrever via OpenAI Whisper, modelo `whisper-1`, `language: "pt"`, timeout 15s.
- Tratar a transcrição como `inbound.body` normal e seguir o fluxo dos agentes.
- Persistir transcrição + status em `mensagens` (colunas novas).
- Quando falhar (timeout, erro, áudio vazio): responder com fallback no tom do agente correspondente.
- Lead e oficina são tratados igualmente.

Exclui:

- Suporte a imagem, documento, vídeo, sticker, localização.
- Bot **enviar** áudio (text-to-speech).
- Retranscrição manual via painel admin.
- Detecção automática de idioma.
- Cache de transcrições (idempotência já está garantida via `provider_event_id`).
- Armazenamento do áudio bruto (apenas transcrição é persistida).

## Decisões (referenciadas em ADR-0015)

| Decisão | Escolha |
|---|---|
| Fallback | Contextual por agente (`lib/whatsapp/audio-fallbacks.ts`) |
| Retenção | Não guarda áudio bruto; só transcrição |
| Sync vs async | Síncrono no webhook, timeout 15s |
| Quem manda áudio | Lead **e** oficina |
| Idioma | Fixo `pt` |

## Critérios de aceite

- [ ] Lead/oficina envia áudio curto (~5s) → bot responde normalmente, agente recebe `inbound.body = transcrição`.
- [ ] Lead/oficina envia áudio >2min ou Whisper trava → bot envia fallback contextual do agente em cena.
- [ ] Lead/oficina envia áudio silencioso → transcrição vazia, fallback contextual de `empty`.
- [ ] `mensagens` registra `media_type = 'audio'`, `transcription`, `transcription_status`, `audio_duration_ms`.
- [ ] `raw_payload` preserva `audio.id` Meta para auditoria.
- [ ] Imagens, documentos, stickers etc. continuam sendo descartados silenciosamente (mesmo comportamento atual para esses tipos).
- [ ] Idempotência mantida — áudio reentregue não gera segunda transcrição.
- [ ] Logs estruturados em todas as etapas (`audio_received`, `audio_downloaded`, `transcription_completed`, `transcription_failed`).
- [ ] Sem regressão nos testes existentes.

## Plano de implementação

1. ADR-0015 + esta fase (Passo 1).
2. Migração SQL `phase_5_audio_transcription.sql` (Passo 2).
3. Estender tipos `InboundWhatsappMessage` e `MetaMessage` (Passo 3).
4. Adicionar `getMediaUrl` e `downloadMedia` em `whatsapp-client.ts` (Passo 4).
5. Criar `lib/whatsapp/transcription.ts` (Passo 5).
6. Atualizar parser `payload.ts` (Passo 6).
7. Criar `lib/whatsapp/audio-fallbacks.ts` (Passo 7).
8. Integrar fluxo no `webhook-handler.ts` (Passo 8).
9. Atualizar `repository.saveInboundMessage` (Passo 9).
10. Escrever testes (Passo 10): parser, helper Whisper, integração.
11. Validar lint, build, suite completa (Passo 11).
12. Atualizar `docs/regras-de-negocio.md` e `docs/CONTEXT_CHANGELOG.md` (Passo 12).

## Riscos

- **Latência do webhook**: Whisper típico responde em 2–4s. Áudios longos podem aproximar o limite Meta (~20s). Timeout duro de 15s + fallback garante que nunca passamos do limite.
- **Custo OpenAI**: previsível. Logar `audio_duration_ms` permite projeção mensal precisa.
- **Idempotência**: áudio reentregue Meta cai no `provider_event_id` UNIQUE — não cobra Whisper duas vezes.
- **PII em logs**: transcrição **não** vai para logs estruturados; só status + duração.

## Verificação manual em produção

Após deploy, do número autorizado:

1. Áudio curto "quero trocar o óleo do meu Civic" → resposta normal do agente vendas.
2. Áudio longo (>2min) → fallback de timeout.
3. Áudio em silêncio → fallback de empty.
4. Verificar `select media_type, transcription_status, audio_duration_ms from mensagens where media_type='audio' order by created_at desc limit 10;`.
