import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AsaasGateway } from "@/lib/payments/asaas-gateway";
import { getActiveGateway } from "@/lib/payments/factory";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

export type OficinaForBilling = {
  id: string;
  nome: string;
  whatsapp_principal: string;
  status: string;
  motivo_pausa: string | null;
  proximo_vencimento: string | null;
  preco_negociado: number | null;
  preco_base: number | null;
  plano_id: string | null;
};

export function precoEfetivo(input: {
  preco_negociado: number | null;
  preco_base: number | null;
}): number {
  if (input.preco_negociado !== null && input.preco_negociado !== undefined) {
    return Number(input.preco_negociado);
  }
  if (input.preco_base !== null && input.preco_base !== undefined) {
    return Number(input.preco_base);
  }
  return 0;
}

export type GerarCobrancaResult =
  | { ok: true; pagamentoId: string; preferenceId: string; initPoint: string; reused: boolean }
  | {
      ok: false;
      reason: "preco_zero" | "cancelada" | "missing_vencimento" | "missing_plano" | "missing_cpf_cnpj";
    };

// Monta a notification_url (usada pelo Mercado Pago por preferencia). O ASAAS
// ignora — seu webhook e configurado globalmente no painel do provedor.
function buildNotificationUrl(slug: string): string | undefined {
  const base = process.env.MERCADO_PAGO_NOTIFICATION_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return undefined;
  const path = slug === "asaas" ? "asaas" : "mercado-pago";
  return `${base}/api/webhooks/${path}`;
}

export async function gerarCobrancaProxima(
  supabase: SupabaseClient,
  oficinaId: string,
  options: { force?: boolean; notificationUrl?: string } = {},
): Promise<GerarCobrancaResult> {
  const { data: oficina, error } = await supabase
    .from("oficinas")
    .select(
      `id, nome, whatsapp_principal, status, motivo_pausa, proximo_vencimento, preco_negociado,
       plano_id, cpf_cnpj, asaas_customer_id,
       planos:plano_id (preco_base)`,
    )
    .eq("id", oficinaId)
    .single();
  if (error || !oficina) throw new Error(`gerar_cobranca_oficina_failed: ${error?.message}`);
  if (oficina.status === "cancelada") return { ok: false, reason: "cancelada" };
  if (!oficina.plano_id) return { ok: false, reason: "missing_plano" };

  const planoRaw = oficina.planos as
    | { preco_base: number }
    | { preco_base: number }[]
    | null;
  const plano = Array.isArray(planoRaw) ? planoRaw[0] ?? null : planoRaw;

  const preco = precoEfetivo({
    preco_negociado: oficina.preco_negociado as number | null,
    preco_base: plano?.preco_base ?? null,
  });
  if (preco <= 0) return { ok: false, reason: "preco_zero" };

  const vencimento = oficina.proximo_vencimento as string | null;
  if (!vencimento && !options.force) return { ok: false, reason: "missing_vencimento" };

  const gateway = await getActiveGateway(supabase);

  // Idempotencia: ja existe pagamento pendente para esse ciclo?
  const { data: existingPendente } = await supabase
    .from("pagamentos")
    .select("id, gateway_charge_id, payment_url")
    .eq("oficina_id", oficinaId)
    .eq("vencimento", vencimento)
    .eq("status", "pendente")
    .maybeSingle();

  if (existingPendente && !options.force) {
    return {
      ok: true,
      pagamentoId: existingPendente.id,
      preferenceId: existingPendente.gateway_charge_id ?? "",
      initPoint: existingPendente.payment_url ?? "",
      reused: true,
    };
  }

  // Determinar tentativa
  const { count: prevCount } = await supabase
    .from("pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("oficina_id", oficinaId)
    .eq("vencimento", vencimento);
  const tentativa = (prevCount ?? 0) + 1;

  // ASAAS exige um customer (com cpfCnpj) antes de cobrar. Cria uma vez e
  // reaproveita nos ciclos seguintes.
  let asaasCustomerId = oficina.asaas_customer_id as string | null;
  if (gateway instanceof AsaasGateway) {
    const cpfCnpj = (oficina.cpf_cnpj as string | null)?.trim();
    if (!cpfCnpj) return { ok: false, reason: "missing_cpf_cnpj" };
    if (!asaasCustomerId) {
      asaasCustomerId = await gateway.createCustomer({
        name: oficina.nome,
        cpfCnpj,
        externalReference: oficinaId,
      });
      await supabase
        .from("oficinas")
        .update({ asaas_customer_id: asaasCustomerId, updated_at: new Date().toISOString() })
        .eq("id", oficinaId);
    }
  }

  const externalReference = `oficina:${oficinaId}|venc:${vencimento ?? "manual"}|t:${tentativa}`;
  const charge = await gateway.createCharge({
    valor: preco,
    descricao: `Quando Trocar — Mensalidade ${vencimento ?? ""}`.trim(),
    externalReference,
    oficinaId,
    vencimento,
    notificationUrl: options.notificationUrl ?? buildNotificationUrl(gateway.slug),
    gatewayCustomerId: asaasCustomerId,
  });

  // Inserir pagamento pendente
  const { data: pagamento, error: insertError } = await supabase
    .from("pagamentos")
    .insert({
      oficina_id: oficinaId,
      valor: preco,
      status: "pendente",
      gateway: gateway.slug,
      gateway_charge_id: charge.chargeId,
      gateway_payment_id: charge.paymentId,
      payment_url: charge.payUrl,
      external_reference: externalReference,
      vencimento,
      tentativa,
      descricao: `Mensalidade ${vencimento ?? "(manual)"}`,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`insert_pagamento_failed: ${insertError.message}`);

  // Enviar template WhatsApp (best-effort; nao falha se envio falhar)
  const templateName = process.env.WHATSAPP_TEMPLATE_COBRANCA_NAME;
  if (templateName) {
    try {
      const client = new WhatsAppCloudApiClient();
      await client.sendTemplateMessage({
        to: oficina.whatsapp_principal,
        templateName,
        languageCode: "pt_BR",
        bodyParameters: [
          oficina.nome,
          new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(preco),
          charge.payUrl,
        ],
      });
    } catch (err) {
      console.error("billing template send failed", err);
    }
  }

  return {
    ok: true,
    pagamentoId: pagamento.id,
    preferenceId: charge.chargeId,
    initPoint: charge.payUrl,
    reused: false,
  };
}

export type AvancarVencimentoResult = { proximo_vencimento: string };

export function avancarVencimentoMensal(current: string | null, now: Date = new Date()): string {
  const base = current ? new Date(`${current}T00:00:00Z`) : now;
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().slice(0, 10);
}
