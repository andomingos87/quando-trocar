# Admin-6 — Billing: Mercado Pago, tela Pagamentos e crons

## Objetivo

Fechar o ciclo financeiro: gerar cobranças mensais via Mercado Pago, processar webhooks, pausar inadimplentes automaticamente, exibir tudo na tela `/admin/pagamentos`.

## Dependências

- Admin-0 (tabelas `pagamentos`, `cobranca_jobs`).
- Admin-1 (sessão admin).
- Conta Mercado Pago configurada (`MERCADO_PAGO_ACCESS_TOKEN`).
- Template Meta categoria "Utility" para cobrança aprovado (`WHATSAPP_TEMPLATE_COBRANCA_NAME`).
- Supabase Cron habilitado.

## Tarefas

### Cliente Mercado Pago

- [ ] `lib/mercado-pago/client.ts` — wrapper mínimo:
  - `createPreference({ valor, descricao, externalReference, oficinaId, vencimento })` → retorna `{ id, init_point }`.
  - `getPayment(mpPaymentId)` → busca status atual.
  - Sem SDK pesado; usar `fetch` direto contra a API REST do MP.

### Geração de cobrança

- [ ] `lib/admin/billing.ts` exporta:
  - `gerarCobrancaProxima(oficinaId)` — gera preferência, persiste `pagamentos` (`status = 'pendente'`, `vencimento = oficinas.proximo_vencimento`, `tentativa` baseado no histórico), envia link via WhatsApp.
  - `precoEfetivo(oficina)` — retorna `preco_negociado` ou `planos.preco_base`.
- [ ] Não gera cobrança se `precoEfetivo` for 0 (plano placeholder ainda não configurado).
- [ ] Idempotência: se já existe pagamento `pendente` para o mesmo ciclo (mesmo `vencimento`, mesma oficina), retorna o existente.

### Cron de cobrança próxima

- [ ] `app/api/internal/admin-billing/gerar-cobrancas/route.ts` — endpoint chamado pelo cron Supabase.
- [ ] Lógica:
  1. Selecionar oficinas onde `status = 'ativa'`, `proximo_vencimento` entre hoje e hoje + 3 dias, sem `pagamentos` pendentes para esse ciclo.
  2. Para cada uma, gerar cobrança via `gerarCobrancaProxima`.
  3. Registrar em `cobranca_jobs` (tipo `cobranca_proxima`).
  4. Erros isolados por oficina não derrubam o job.
- [ ] Schedule Supabase Cron: diário às 09:00 BRT.
- [ ] Autenticação via `INTERNAL_JOB_SECRET` (header).

### Cron de auto-pausa por inadimplência

- [ ] `app/api/internal/admin-billing/auto-pausa-inadimplencia/route.ts`.
- [ ] Lógica:
  1. Selecionar oficinas `status = 'ativa'`, `proximo_vencimento < current_date - INADIMPLENCIA_DIAS_GRACE`, sem `pagamentos` pagos cobrindo o ciclo.
  2. Para cada uma: `status = 'pausada'`, `motivo_pausa = 'inadimplencia'`.
  3. Registrar em `admin_audit_log` com `admin_id = NULL`, ação `oficina.auto_pausa_inadimplencia`.
  4. Enviar template Meta Utility informando suspensão e link de pagamento ativo.
  5. Registrar em `cobranca_jobs` (tipo `auto_pausa_inadimplencia`).
- [ ] Schedule Supabase Cron: diário às 09:30 BRT (após o de cobrança).

### Webhook Mercado Pago

- [ ] `app/api/webhooks/mercado-pago/route.ts`:
  - Validar assinatura (consultar docs MP).
  - Buscar `mp_payment_id` em `pagamentos`. Se não existir, criar (idempotência por `mp_payment_id` UNIQUE).
  - Atualizar `status` baseado no status retornado pelo MP (`approved` → `pago`, `rejected` → `falhou`, `cancelled` → `cancelado`).
  - Se `pago`:
    - `paid_at = now()`.
    - Atualizar `oficinas.proximo_vencimento += 1 mes`.
    - Se oficina estava `pausada` com `motivo_pausa = 'inadimplencia'`, reativar (`status = 'ativa'`, `motivo_pausa = NULL`).
  - Registrar em `admin_audit_log` com `admin_id = NULL`, ação `pagamento.webhook_confirmado` (ou `pagamento.webhook_falhou`).

### Bot reage a oficina pausada por inadimplência

- [ ] Em [lib/whatsapp/conversation-router.ts](../../lib/whatsapp/conversation-router.ts): antes de despachar para agentes, checar `oficinas.status` + `motivo_pausa`. Se `pausada` por inadimplência, responder com mensagem padrão de cobrança e parar.
- [ ] Texto da resposta vive em `lib/whatsapp/messages.ts` (ou similar) — não hardcode no router.
- [ ] Adicionar teste de regressão em `tests/whatsapp-router.test.ts`.

### Tela Pagamentos (`/admin/pagamentos`)

- [ ] `app/admin/pagamentos/page.tsx` — server component, paginação, filtros (PRD §6.7).
- [ ] Aceita query param `oficina_id` para vir do detalhe da oficina.
- [ ] Componente `components/admin/pagamentos-table.tsx`.
- [ ] Ação "Reenviar link" — chama `POST /api/admin/pagamentos/[id]/reenviar`. Reenvia o link via WhatsApp, registra em auditoria.
- [ ] Ação "Marcar como cancelado" — só pendentes. Modal pede justificativa que vai para `admin_audit_log.payload`.

### Disparar cobrança manual (do detalhe da oficina)

- [ ] Endpoint `POST /api/admin/oficinas/[id]/cobrar` — força geração de nova cobrança fora do ciclo.
- [ ] Validações: oficina não pode estar `cancelada`. Plano deve ter preço > 0.
- [ ] Registra ação `oficina.cobranca_manual_disparada` em auditoria.

## Variáveis de ambiente

- `MERCADO_PAGO_ACCESS_TOKEN` — obrigatório.
- `MERCADO_PAGO_WEBHOOK_SECRET` — para validar assinatura.
- `INADIMPLENCIA_DIAS_GRACE` — default 7.
- `WHATSAPP_TEMPLATE_COBRANCA_NAME` — template Utility aprovado.
- `INTERNAL_JOB_SECRET` — para autenticar chamadas dos crons.

## Critérios de aceite

- Cron de cobrança próxima gera preferência MP para oficinas com vencimento em D-3.
- Cron não duplica cobrança se já existe pagamento pendente para o ciclo.
- Cron não cobra oficina com `precoEfetivo = 0`.
- Webhook Mercado Pago com `status = approved` marca pagamento como `pago` e avança `proximo_vencimento`.
- Webhook duplicado (mesmo `mp_payment_id`) é ignorado.
- Oficina inadimplente que paga é automaticamente reativada pelo webhook.
- Cron de auto-pausa pausa oficina com vencimento há 8+ dias sem pagamento.
- Oficina pausada por inadimplência mandando mensagem ao bot recebe a mensagem padrão de cobrança e o bot não opera.
- Tela `/admin/pagamentos` exibe lista paginada com filtros funcionando.
- Disparar cobrança manual gera link e envia WhatsApp.
- Toda operação automática gera entrada em `admin_audit_log` com `admin_id = NULL`.

## Testes

- [ ] Teste unitário de `gerarCobrancaProxima` com idempotência.
- [ ] Teste unitário de `precoEfetivo` (com e sem `preco_negociado`).
- [ ] Teste de rota cron de cobrança: simula oficina com vencimento próximo, valida criação de pagamento.
- [ ] Teste de rota cron de auto-pausa: oficina vencida há 8 dias é pausada.
- [ ] Teste de webhook MP: payload `approved` marca `pago` e avança vencimento.
- [ ] Teste de webhook MP: payload duplicado é idempotente.
- [ ] Teste de webhook MP: payload `rejected` marca `falhou` sem afetar status da oficina.
- [ ] Teste de router WhatsApp: oficina pausada por inadimplência → mensagem padrão.
- [ ] Teste de reativação: oficina pausada paga → status volta a `ativa`.
- [ ] Teste de assinatura inválida do webhook → 401.

## Riscos

- **Webhook MP duplicado** marcando pagamento duas vezes. Mitigação: `mp_payment_id` UNIQUE + checar em `pagamentos` antes de criar.
- **Cron rodando duas vezes no mesmo dia** gerando cobranças duplicadas. Mitigação: idempotência em `gerarCobrancaProxima` baseada em (`oficina_id`, `vencimento`, `status = 'pendente'`).
- **Falha no envio do template** depois de criar pagamento → link gerado mas oficina não recebe. Mitigação: registrar pagamento mesmo com falha de envio; tela admin mostra como "Pagamento pendente sem aviso enviado" e permite reenvio manual.
- **Template Meta Utility não aprovado** bloqueia cobrança. Mitigação: solicitar com antecedência (3-5 dias úteis). Em dev, permitir envio livre dentro da janela.
- **Mudança de preço no meio do ciclo**: oficina paga preço antigo, no próximo ciclo paga novo. Aceito — preço novo só vale para o próximo ciclo.
- **Pix falha por mudança de chave do MP**: monitorar webhook ratio (gerados vs confirmados). Adicionar alerta básico em `cobranca_jobs.erros`.

## Saída esperada

Ao final desta sub-fase, o produto:

- Cobra automaticamente todo mês.
- Pausa quem não paga.
- Reativa quem regulariza.
- Tem trilha de auditoria completa de toda operação financeira.
- Não exige intervenção manual no caminho feliz.
