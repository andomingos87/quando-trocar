# Runbook: configurar o ASAAS como gateway de pagamento

Fonte: [ADR-0021](../adr/0021-gateway-pagamento-multiplo-asaas.md). Referência: [ADR-0008](../adr/0008-pagamento-no-mvp.md) (Mercado Pago, dormente).

O ASAAS é o provedor de cobrança das oficinas. A gestão (provedor ativo, ambiente e credenciais) é feita no painel admin em `/admin/configuracoes/pagamentos`. Os segredos ficam cifrados no Supabase Vault — nunca em env de produção nem em coluna do banco.

## Pré-requisitos

- Migration `20260712120000_gateway_pagamento_asaas.sql` aplicada (cria `configuracoes_pagamento`, colunas em `pagamentos`/`oficinas` e as funções de Vault).
- Extensão `supabase_vault` habilitada (já está no projeto).
- Conta ASAAS (comece pelo **sandbox**).

## Passo a passo (sandbox)

1. **Criar conta sandbox** em https://sandbox.asaas.com e obter a API key em *Configurações → Integrações → API*. A chave de sandbox começa com `$aact_hmlg_`.
2. **Definir o token de webhook** — escolha um segredo forte (ex.: 32+ chars aleatórios). Ele será enviado pelo ASAAS no header `asaas-access-token` e validado pelo backend.
3. **No painel admin** (`/admin/configuracoes/pagamentos`):
   - Ambiente ASAAS: **Sandbox**.
   - Cole a **API key** e o **Webhook token** (os campos são write-only; ficam no Vault).
   - **Provedor ativo: ASAAS** (só é aceito depois que a API key existe).
   - Salvar.
4. **Cadastrar o webhook no ASAAS** — *Configurações → Integrações → Webhooks*:
   - URL: `https://<seu-dominio>/api/webhooks/asaas` (a página do admin mostra a URL exata).
   - Token de autenticação: o mesmo definido no passo 2.
   - Eventos: pagamentos (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, ...).
5. **Preencher `cpf_cnpj` das oficinas** que serão cobradas (o ASAAS exige um customer com CPF/CNPJ). Sem isso, a geração de cobrança retorna `missing_cpf_cnpj`.

## Testar de ponta a ponta (sandbox)

1. Numa oficina de teste com `plano_id`, `preco` > 0, `proximo_vencimento` e `cpf_cnpj` preenchidos, dispare a cobrança manual em `/admin/oficinas/[id]` (botão **Cobrar**).
2. O sistema cria o customer ASAAS (se ainda não existir), gera a cobrança e devolve o `invoiceUrl`. O link também é enviado por WhatsApp se `WHATSAPP_TEMPLATE_COBRANCA_NAME` estiver configurado.
3. Pague/confirme no sandbox do ASAAS. O webhook deve marcar o `pagamento` como `pago`, avançar `proximo_vencimento` e reativar a oficina se estava pausada por inadimplência.
4. Verifique a trilha em `/admin/pagamentos` e em `admin_audit_log` (`pagamento.webhook_confirmado`).

## Ir para produção

1. Trocar a API key pela de produção (`$aact_prod_`) e o Ambiente para **Produção** no painel.
2. Recadastrar o webhook apontando para o domínio de produção, com um novo token.
3. Agendar os crons de billing (fora do escopo desta integração): `gerar-cobrancas` e `auto-pausa-inadimplencia`. Ver `docs/backlog-painel-admin/admin-6-billing-mercado-pago.md`.

## Voltar para o Mercado Pago

Basta, no painel, ter o access token do MP configurado (Vault ou env) e selecionar **Provedor ativo: Mercado Pago**. Cobranças pendentes seguem no provedor em que foram criadas; a troca só vale para novas cobranças.

## Variáveis de ambiente (fallback dev/local)

Em produção use o painel. Localmente/nos testes é possível usar:

- `ASAAS_API_KEY` — chave de sandbox.
- `ASAAS_WEBHOOK_TOKEN` — token do webhook.

Se o Vault tiver o segredo, ele tem precedência sobre a env.
