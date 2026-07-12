-- ============================================================================
-- Hardening: revogar EXECUTE de anon/authenticated em public.rls_auto_enable()
--
-- `rls_auto_enable()` e uma EVENT TRIGGER function (dispara em CREATE TABLE para
-- habilitar RLS automaticamente). Ela nunca deve ser chamavel pela API. O
-- Supabase concede EXECUTE a anon/authenticated por default no schema public,
-- o que a expunha em POST /rest/v1/rpc/rls_auto_enable (advisor
-- 0028/0029: anon/authenticated_security_definer_function_executable).
--
-- Event triggers rodam pelo dono no contexto do evento, independentemente do
-- grant de EXECUTE — logo revogar NAO afeta o auto-enable de RLS.
--
-- IMPORTANTE: revogar de `public` nao remove os grants explicitos a
-- anon/authenticated — por isso revogamos deles nominalmente.
-- ============================================================================

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
