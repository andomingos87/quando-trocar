-- =============================================================================
-- RESET DE DADOS DE TESTE — "começar a operação limpa"
-- =============================================================================
-- ATENÇÃO: destrutivo e irreversível. NÃO é uma migration — não colocar em
-- supabase/migrations (rodaria em todo deploy/ambiente novo e apagaria dados).
-- Rodar manualmente e de propósito, uma vez, contra o projeto certo.
--
-- Apaga TODAS as tabelas transacionais + representantes + auditoria + OTPs,
-- preservando apenas as tabelas de configuração:
--   MANTER: planos, tipos_servico_default, configuracoes_pagamento,
--           configuracoes_comissao, configuracoes_vendedor, faq_vendas,
--           admin_users
--
-- RESTART IDENTITY: zera contadores de colunas serial/identity (no-op nas PKs
-- UUID, mas inofensivo). CASCADE: rede de segurança para FKs — verificado que
-- nenhuma tabela mantida referencia uma tabela apagada.
--
-- NÃO reseta sistemas externos: clientes no Asaas e estado de conversa no
-- WhatsApp/Meta continuam existindo.
-- =============================================================================

TRUNCATE TABLE
  public.whatsapp_events,
  public.mensagens,
  public.outbound_messages,
  public.agent_tool_calls,
  public.admin_audit_log,
  public.auth_otps,
  public.conversas,
  public.lembretes,
  public.servicos,
  public.clientes_finais,
  public.veiculos,
  public.leads_oficina,
  public.oficinas,
  public.oficina_members,
  public.perguntas_sem_resposta,
  public.representantes,
  public.cobranca_jobs,
  public.comissoes,
  public.pagamentos
RESTART IDENTITY CASCADE;
