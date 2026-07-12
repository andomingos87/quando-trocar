import "server-only";

import { createHmac } from "node:crypto";

import { MercadoPagoClient, mapMpStatus } from "@/lib/mercado-pago/client";

import type {
  GatewayCharge,
  GatewayChargeInput,
  GatewayPaymentStatus,
  GatewayWebhookRef,
  PaymentGateway,
} from "./types";

// Adapta o cliente Mercado Pago existente a interface PaymentGateway.
// Comportamento preservado do webhook/route original (ADR-0008); MP fica
// configurado porem inativo por padrao apos ADR-0021.
export class MercadoPagoGateway implements PaymentGateway {
  readonly slug = "mercado_pago" as const;

  constructor(
    accessToken: string,
    private webhookSecret: string | null,
    private client = new MercadoPagoClient(accessToken),
  ) {}

  async createCharge(input: GatewayChargeInput): Promise<GatewayCharge> {
    const pref = await this.client.createPreference({
      valor: input.valor,
      descricao: input.descricao,
      externalReference: input.externalReference,
      oficinaId: input.oficinaId,
      vencimento: input.vencimento,
      notificationUrl: input.notificationUrl,
    });
    return { chargeId: pref.id, paymentId: null, payUrl: pref.init_point };
  }

  async getPaymentStatus(paymentId: string): Promise<GatewayPaymentStatus> {
    const p = await this.client.getPayment(paymentId);
    const status = mapMpStatus(p.status);
    return {
      status,
      paidAt: status === "pago" ? p.date_approved ?? null : null,
      amount: p.transaction_amount ?? null,
      externalReference: p.external_reference ?? null,
    };
  }

  verifyWebhook(headers: Headers, rawBody: string): boolean {
    if (!this.webhookSecret) {
      // Em dev / sem secret configurado, aceita sem validar.
      return true;
    }
    const signature = headers.get("x-signature");
    if (!signature) return false;
    // Mercado Pago usa formato "ts=...,v1=hex".
    const parts = Object.fromEntries(
      signature.split(",").map((p) => {
        const [k, v] = p.split("=");
        return [k?.trim(), v?.trim()];
      }),
    ) as Record<string, string>;
    if (!parts.v1 || !parts.ts) return false;
    const payload = `${parts.ts}.${rawBody}`;
    const expected = createHmac("sha256", this.webhookSecret).update(payload).digest("hex");
    return expected === parts.v1;
  }

  extractWebhookRef(body: unknown): GatewayWebhookRef | null {
    const id = (body as { data?: { id?: string } })?.data?.id;
    return id ? { paymentId: String(id) } : null;
  }
}
