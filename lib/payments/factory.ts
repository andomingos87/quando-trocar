import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AsaasGateway, type AsaasAmbiente } from "./asaas-gateway";
import { MercadoPagoGateway } from "./mercado-pago-gateway";
import type { GatewaySlug, PaymentGateway } from "./types";

export type PaymentConfig = {
  provedor_ativo: GatewaySlug;
  asaas_ambiente: AsaasAmbiente;
};

export async function loadPaymentConfig(supabase: SupabaseClient): Promise<PaymentConfig> {
  const { data } = await supabase
    .from("configuracoes_pagamento")
    .select("provedor_ativo, asaas_ambiente")
    .limit(1)
    .maybeSingle();
  return {
    provedor_ativo: (data?.provedor_ativo as GatewaySlug) ?? "mercado_pago",
    asaas_ambiente: (data?.asaas_ambiente as AsaasAmbiente) ?? "sandbox",
  };
}

// Le um segredo do Vault via RPC (get_payment_secret). Retorna null se ausente.
async function vaultSecret(supabase: SupabaseClient, name: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_payment_secret", { p_name: name });
    if (error) return null;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}

// Constroi um gateway concreto pelo slug (usado pelos webhooks, que precisam
// processar o provedor que enviou o evento, independente do ativo).
export async function getGateway(
  supabase: SupabaseClient,
  slug: GatewaySlug,
  config?: PaymentConfig,
): Promise<PaymentGateway> {
  const cfg = config ?? (await loadPaymentConfig(supabase));

  if (slug === "asaas") {
    const apiKey =
      (await vaultSecret(supabase, "asaas_api_key")) ?? process.env.ASAAS_API_KEY ?? null;
    if (!apiKey) {
      throw new Error("asaas_api_key ausente — configure em /admin/configuracoes/pagamentos.");
    }
    const webhookToken =
      (await vaultSecret(supabase, "asaas_webhook_token")) ??
      process.env.ASAAS_WEBHOOK_TOKEN ??
      null;
    return new AsaasGateway(apiKey, cfg.asaas_ambiente, webhookToken);
  }

  const token =
    (await vaultSecret(supabase, "mercado_pago_access_token")) ??
    process.env.MERCADO_PAGO_ACCESS_TOKEN ??
    null;
  if (!token) {
    throw new Error("mercado_pago_access_token ausente — billing desabilitado.");
  }
  const webhookSecret =
    (await vaultSecret(supabase, "mercado_pago_webhook_secret")) ??
    process.env.MERCADO_PAGO_WEBHOOK_SECRET ??
    null;
  return new MercadoPagoGateway(token, webhookSecret);
}

// Gateway ativo, escolhido pela configuracao do painel admin. Usado por billing.
export async function getActiveGateway(supabase: SupabaseClient): Promise<PaymentGateway> {
  const cfg = await loadPaymentConfig(supabase);
  return getGateway(supabase, cfg.provedor_ativo, cfg);
}
