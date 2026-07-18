-- ============================================================================
-- Portal do representante (Fase R4, ADR-0025, estende ADR-0019)
-- Fonte: docs/backlog-whatsapp-bot/fase-representante-portal.md,
--        docs/regras-de-negocio.md §18.7.
-- Login OTP-no-WhatsApp do representante contra a tabela `representantes`
-- existente (sem rep_users). Migration minima e aditiva:
--   1. auth_otps.target passa a aceitar 'representante'
--   2. representantes.ultimo_acesso_em registra o ultimo login do rep
-- ============================================================================

-- 1. Estender o CHECK de auth_otps.target (hoje 'oficina' | 'admin').
alter table auth_otps
  drop constraint auth_otps_target_check;
alter table auth_otps
  add constraint auth_otps_target_check
  check (target in ('oficina', 'admin', 'representante'));

-- 2. Ultimo acesso do representante (analogo a admin_users.ultimo_acesso_em).
alter table representantes
  add column ultimo_acesso_em timestamptz;

-- Sem mudanca de RLS: representantes/auth_otps seguem sem policy, acesso apenas
-- via service-role (padrao ADR-0003). O escopo do portal e imposto no codigo
-- (lib/representante/*), nunca no request. Ver ADR-0025.
