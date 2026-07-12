-- ============================================================================
-- ADR-0021: Gateway de pagamento pluggavel (Mercado Pago + ASAAS)
-- Fonte: docs/adr/0021-gateway-pagamento-multiplo-asaas.md
--
-- Objetivo:
--   1. Tornar o provedor de pagamento configuravel pelo painel admin.
--   2. Adicionar ASAAS como provedor (avulsa por ciclo, igual ao fluxo MP).
--   3. Guardar os segredos dos provedores no Supabase Vault (nunca em coluna
--      texto puro), gerenciados via painel admin.
--
-- Aditiva e reversivel: nenhuma coluna existente e removida. As colunas mp_*
-- de `pagamentos` sao mantidas (deprecadas) e continuam preenchidas via backfill
-- nas colunas genericas novas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. pagamentos: colunas genericas de gateway
-- ----------------------------------------------------------------------------
alter table pagamentos
  add column if not exists gateway text not null default 'mercado_pago'
    check (gateway in ('mercado_pago', 'asaas')),
  add column if not exists gateway_charge_id text,   -- id da cobranca no provedor (MP: preference id; ASAAS: payment id)
  add column if not exists gateway_payment_id text,  -- id do pagamento efetivo (MP: payment id; ASAAS: payment id)
  add column if not exists payment_url text,          -- link de pagamento (MP init_point; ASAAS invoiceUrl)
  add column if not exists external_reference text;   -- referencia externa enviada ao provedor (oficina:...|venc:...|t:...)

-- Backfill: pagamentos existentes sao todos Mercado Pago.
update pagamentos
   set gateway_charge_id = coalesce(gateway_charge_id, mp_preference_id),
       gateway_payment_id = coalesce(gateway_payment_id, mp_payment_id)
 where gateway = 'mercado_pago';

-- Idempotencia do webhook: um pagamento confirmado por (gateway, payment_id).
create unique index if not exists pagamentos_gateway_payment_uidx
  on pagamentos (gateway, gateway_payment_id)
  where gateway_payment_id is not null;

create index if not exists pagamentos_gateway_external_ref_idx
  on pagamentos (gateway, external_reference)
  where external_reference is not null;

-- ----------------------------------------------------------------------------
-- 2. oficinas: identificacao fiscal + customer ASAAS
-- ----------------------------------------------------------------------------
-- ASAAS exige um "customer" com cpfCnpj antes de gerar cobranca. Guardamos o
-- documento da oficina e o id do customer criado (reaproveitado nos ciclos).
alter table oficinas
  add column if not exists cpf_cnpj text,
  add column if not exists asaas_customer_id text;

-- ----------------------------------------------------------------------------
-- 3. configuracoes_pagamento (singleton): provedor ativo + ambiente
-- ----------------------------------------------------------------------------
-- Os SEGREDOS (API keys / tokens) NAO ficam aqui — ficam no Vault (secao 4).
-- Esta tabela guarda apenas config nao-secreta, gerenciada pelo painel admin.
create table if not exists configuracoes_pagamento (
  id uuid primary key default gen_random_uuid(),
  provedor_ativo text not null default 'mercado_pago'
    check (provedor_ativo in ('mercado_pago', 'asaas')),
  asaas_ambiente text not null default 'sandbox'
    check (asaas_ambiente in ('sandbox', 'producao')),
  updated_at timestamptz not null default now(),
  updated_by uuid references admin_users(id)
);

-- Singleton: no maximo 1 linha.
create unique index if not exists configuracoes_pagamento_singleton_idx
  on configuracoes_pagamento((true));

alter table configuracoes_pagamento enable row level security;
-- Sem policy de proposito: acesso apenas via service-role (painel/bot backend).

-- Seed inicial: Mercado Pago ativo (dormente ate ter credencial), sandbox ASAAS.
insert into configuracoes_pagamento (provedor_ativo, asaas_ambiente)
select 'mercado_pago', 'sandbox'
where not exists (select 1 from configuracoes_pagamento);

-- ----------------------------------------------------------------------------
-- 4. Segredos no Vault via funcoes SECURITY DEFINER (acesso so service_role)
-- ----------------------------------------------------------------------------
-- Nomes fixos usados pelo backend:
--   mercado_pago_access_token, mercado_pago_webhook_secret,
--   asaas_api_key, asaas_webhook_token
-- O painel admin grava via set_payment_secret; o backend le via
-- get_payment_secret; a UI verifica presenca via payment_secret_exists
-- (nunca expoe o valor).

create or replace function public.set_payment_secret(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name, 'Quando Trocar payment gateway secret');
  else
    perform vault.update_secret(v_id, p_value, p_name, 'Quando Trocar payment gateway secret');
  end if;
end;
$$;

create or replace function public.get_payment_secret(p_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

create or replace function public.payment_secret_exists(p_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists(select 1 from vault.secrets where name = p_name);
$$;

-- Trava de acesso: ninguem alem do service_role executa.
revoke all on function public.set_payment_secret(text, text) from public;
revoke all on function public.get_payment_secret(text) from public;
revoke all on function public.payment_secret_exists(text) from public;
grant execute on function public.set_payment_secret(text, text) to service_role;
grant execute on function public.get_payment_secret(text) to service_role;
grant execute on function public.payment_secret_exists(text) to service_role;
