import "server-only";

import { NextResponse } from "next/server";

import { avancarVencimentoMensal } from "@/lib/admin/billing";
import { gerarComissaoParaPagamento } from "@/lib/admin/comissoes";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

import type { PaymentGateway, PaymentStatus } from "./types";

type AdminSupabase = ReturnType<typeof createSupabaseAdminClient>;

// Handler de webhook agnostico de provedor (ADR-0021). Recebe o gateway ja
// resolvido (MP ou ASAAS) e:
//   1. valida a origem;
//   2. busca o status autoritativo no provedor;
//   3. localiza o pagamento (por payment_id, senao por external_reference,
//      senao cria a partir da referencia da oficina);
//   4. aplica efeitos (avanca vencimento, reativa inadimplente), gera comissao
//      e registra auditoria — sempre de forma idempotente.
export async function processPaymentWebhook(
  supabase: AdminSupabase,
  gateway: PaymentGateway,
  request: Request,
  rawBody: string,
): Promise<NextResponse> {
  if (!gateway.verifyWebhook(request.headers, rawBody)) {
    return NextResponse.json({ ok: false, message: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: "invalid json" }, { status: 400 });
  }

  const ref = gateway.extractWebhookRef(body);
  if (!ref) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  let info;
  try {
    info = await gateway.getPaymentStatus(ref.paymentId);
  } catch (err) {
    console.error("webhook get_payment_status failed", { gateway: gateway.slug, err });
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const mapped = info.status;
  const paidAt = mapped === "pago" ? info.paidAt ?? new Date().toISOString() : null;

  // 1) Localiza por (gateway, payment_id).
  const byPaymentId = await supabase
    .from("pagamentos")
    .select("id, status, oficina_id")
    .eq("gateway", gateway.slug)
    .eq("gateway_payment_id", ref.paymentId)
    .maybeSingle();

  let existing = byPaymentId.data as
    | { id: string; status: string; oficina_id: string }
    | null;

  // 2) Localiza por external_reference (MP: 1o webhook ainda nao tem payment_id).
  if (!existing && info.externalReference) {
    const byRef = await supabase
      .from("pagamentos")
      .select("id, status, oficina_id")
      .eq("gateway", gateway.slug)
      .eq("external_reference", info.externalReference)
      .maybeSingle();
    existing = byRef.data as typeof existing;
  }

  if (existing) {
    if (existing.status === mapped) {
      return NextResponse.json({ ok: true, idempotent: true });
    }
    await supabase
      .from("pagamentos")
      .update({
        status: mapped,
        paid_at: paidAt,
        gateway_payment_id: ref.paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    await applySideEffects(supabase, existing.oficina_id, mapped, paidAt);
    await gerarComissaoSafe(supabase, existing.id, mapped);
    await audit(supabase, gateway.slug, existing.oficina_id, mapped, ref.paymentId);
    return NextResponse.json({ ok: true, updated: true });
  }

  // 3) Nao existe: resolve oficina via external_reference e cria o pagamento.
  const refStr = info.externalReference ?? "";
  const oficinaId = refStr.match(/oficina:([0-9a-f-]+)/i)?.[1];
  if (!oficinaId) {
    return NextResponse.json({ ok: true, ignored: "no_oficina_ref" });
  }
  const { data: created } = await supabase
    .from("pagamentos")
    .insert({
      oficina_id: oficinaId,
      valor: info.amount ?? 0,
      status: mapped,
      gateway: gateway.slug,
      gateway_payment_id: ref.paymentId,
      external_reference: refStr,
      descricao: "Recebido via webhook",
      paid_at: paidAt,
    })
    .select("id")
    .single();

  await applySideEffects(supabase, oficinaId, mapped, paidAt);
  await gerarComissaoSafe(supabase, created?.id ?? null, mapped);
  await audit(supabase, gateway.slug, oficinaId, mapped, ref.paymentId);
  return NextResponse.json({ ok: true, created: true });
}

// ADR-0019: comissao do representante e gerada quando o pagamento confirma.
// Nao bloqueante: falha aqui nunca derruba o processamento do pagamento.
async function gerarComissaoSafe(
  supabase: AdminSupabase,
  pagamentoId: string | null,
  status: PaymentStatus,
): Promise<void> {
  if (status !== "pago" || !pagamentoId) return;
  try {
    await gerarComissaoParaPagamento(supabase, pagamentoId);
  } catch (err) {
    console.error("gerar comissao failed", { pagamentoId, err });
  }
}

async function applySideEffects(
  supabase: AdminSupabase,
  oficinaId: string,
  status: PaymentStatus,
  paidAt: string | null,
): Promise<void> {
  if (status !== "pago") return;
  const { data: oficina } = await supabase
    .from("oficinas")
    .select("proximo_vencimento, status, motivo_pausa")
    .eq("id", oficinaId)
    .single();
  if (!oficina) return;
  const patch: Record<string, unknown> = {
    proximo_vencimento: avancarVencimentoMensal(
      oficina.proximo_vencimento,
      paidAt ? new Date(paidAt) : undefined,
    ),
    updated_at: new Date().toISOString(),
  };
  if (oficina.status === "pausada" && oficina.motivo_pausa === "inadimplencia") {
    patch.status = "ativa";
    patch.motivo_pausa = null;
  }
  await supabase.from("oficinas").update(patch).eq("id", oficinaId);
}

async function audit(
  supabase: AdminSupabase,
  gateway: string,
  oficinaId: string,
  status: PaymentStatus,
  paymentId: string,
): Promise<void> {
  await supabase.from("admin_audit_log").insert({
    admin_id: null,
    acao: status === "pago" ? "pagamento.webhook_confirmado" : "pagamento.webhook_falhou",
    entidade: "pagamentos",
    entidade_id: null,
    payload: { gateway, payment_id: paymentId, status, oficina_id: oficinaId },
  });
}
