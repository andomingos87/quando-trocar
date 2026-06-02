-- ============================================================================
-- Soft delete de oficina (painel admin)
-- Fonte: docs/regras-de-negocio.md §2.6.
-- `deleted_at` é distinto de `status = 'cancelada'`: cancelar é estado de
-- negócio (oficina some dos fluxos operacionais), excluir oculta o registro
-- de TODAS as telas do admin mantendo-o no banco para auditoria.
-- ============================================================================

alter table oficinas
  add column deleted_at timestamptz;

-- Listagens do admin filtram `deleted_at is null` e ordenam por created_at desc.
create index oficinas_not_deleted_idx
  on oficinas (created_at desc)
  where deleted_at is null;
