import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

import { avancarVencimentoMensal } from "@/lib/admin/billing";
import { MercadoPagoClient, mapMpStatus } from "@/lib/mercado-pago/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(request: Request, body: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) {
    // Em dev / quando webhook secret nao esta configurado, aceita sem validar.
    return true;
  }
  const signature = request.headers.get("x-signature");
  if (!signature) return false;
  // Mercado Pago usa formato "ts=...,v1=hex". Implementacao basica:
  const parts = Object.fromEntries(
    signature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  ) as Record<string, string>;
  if (!parts.v1 || !parts.ts) return false;
  const payload = `${parts.ts}.${body}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return expected === parts.v1;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(request, rawBody)) {
    return NextResponse.json({ ok: false, message: "invalid signature" }, { status: 401 });
  }

  let body: { type?: string; action?: string; data?: { id?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: "invalid json" }, { status: 400 });
  }

  const mpPaymentId = body.data?.id;
  if (!mpPaymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = createSupabaseAdminClient();

  // Idempotencia: ja temos esse payment_id?
  const { data: existing } = await supabase
    .from("pagamentos")
    .select("id, status, oficina_id, vencimento")
    .eq("mp_payment_id", mpPaymentId)
    .maybeSingle();

  let payment;
  try {
    const mp = new MercadoPagoClient();
    payment = await mp.getPayment(mpPaymentId);
  } catch (err) {
    console.error("mp webhook get_payment failed", err);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const mapped = mapMpStatus(payment.status);
  const paidAt = mapped === "pago" ? payment.date_approved ?? new Date().toISOString() : null;

  if (!existing) {
    // Resolver oficina via external_reference
    const ref = payment.external_reference ?? "";
    const oficinaMatch = ref.match(/oficina:([0-9a-f-]+)/i);
    const oficinaId = oficinaMatch?.[1];
    if (!oficinaId) {
      return NextResponse.json({ ok: true, ignored: "no_oficina_ref" });
    }
    await supabase.from("pagamentos").insert({
      oficina_id: oficinaId,
      valor: payment.transaction_amount ?? 0,
      status: mapped,
      mp_payment_id: mpPaymentId,
      descricao: `Recebido via webhook MP`,
      paid_at: paidAt,
    });
    await applySideEffects(supabase, oficinaId, mapped, paidAt);
    await audit(supabase, oficinaId, mapped, mpPaymentId);
    return NextResponse.json({ ok: true, created: true });
  }

  if (existing.status === mapped) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  await supabase
    .from("pagamentos")
    .update({ status: mapped, paid_at: paidAt, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  await applySideEffects(supabase, existing.oficina_id, mapped, paidAt);
  await audit(supabase, existing.oficina_id, mapped, mpPaymentId);
  return NextResponse.json({ ok: true, updated: true });
}

async function applySideEffects(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  oficinaId: string,
  status: ReturnType<typeof mapMpStatus>,
  paidAt: string | null,
): Promise<void> {
  if (status !== "pago") return;
  // Avancar proximo_vencimento e reativar se pausada por inadimplencia
  const { data: oficina } = await supabase
    .from("oficinas")
    .select("proximo_vencimento, status, motivo_pausa")
    .eq("id", oficinaId)
    .single();
  if (!oficina) return;
  const patch: Record<string, unknown> = {
    proximo_vencimento: avancarVencimentoMensal(oficina.proximo_vencimento, paidAt ? new Date(paidAt) : undefined),
    updated_at: new Date().toISOString(),
  };
  if (oficina.status === "pausada" && oficina.motivo_pausa === "inadimplencia") {
    patch.status = "ativa";
    patch.motivo_pausa = null;
  }
  await supabase.from("oficinas").update(patch).eq("id", oficinaId);
}

async function audit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  oficinaId: string,
  status: ReturnType<typeof mapMpStatus>,
  mpPaymentId: string,
): Promise<void> {
  await supabase.from("admin_audit_log").insert({
    admin_id: null,
    acao: status === "pago" ? "pagamento.webhook_confirmado" : "pagamento.webhook_falhou",
    entidade: "pagamentos",
    entidade_id: null,
    payload: { mp_payment_id: mpPaymentId, status, oficina_id: oficinaId },
  });
}
