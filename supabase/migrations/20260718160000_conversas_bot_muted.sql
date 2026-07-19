-- ============================================================================
-- CV7 (QTR-16): silenciar o bot após handoff (bot_muted).
-- Fonte: docs/backlog-whatsapp-bot/fase-camada-conversacional.md (Fase CV7),
--        docs/regras-de-negocio.md §13.
-- Resolve o bot atropelar o humano depois do handoff: setado automaticamente no
-- handoff (expira em 24h) e limpo quando o admin resolve o handoff. O webhook
-- checa antes de qualquer resposta.
-- ============================================================================

alter table public.conversas
  add column if not exists bot_muted_until timestamptz;

comment on column public.conversas.bot_muted_until is
  'Enquanto > now(), o bot não responde nesta conversa (setado no handoff, expira em 24h) — CV7.';
