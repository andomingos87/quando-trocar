-- ============================================================================
-- Camada de geracao conversacional: flag de modo (ADR-0020, fase CV1)
-- Fonte: docs/adr/0020-camada-geracao-conversacional.md,
--        docs/backlog-whatsapp-bot/fase-camada-conversacional.md (Fase CV1),
--        docs/regras-de-negocio.md §13.
-- Adiciona o kill switch da geracao de resposta por LLM em configuracoes_vendedor
-- (singleton). 'off' = comportamento atual (enlatada); 'sombra' = gera+valida+loga
-- mas envia a enlatada; 'on' = envia a gerada aprovada, senao a enlatada.
-- ============================================================================

alter table configuracoes_vendedor
  add column geracao_llm_modo text not null default 'off'
  check (geracao_llm_modo in ('off', 'sombra', 'on'));
