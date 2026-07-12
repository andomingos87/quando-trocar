import "server-only";

import { timingSafeEqual } from "node:crypto";

import type {
  GatewayCharge,
  GatewayChargeInput,
  GatewayPaymentStatus,
  GatewayWebhookRef,
  PaymentGateway,
  PaymentStatus,
} from "./types";

export type AsaasAmbiente = "sandbox" | "producao";

const BASE_URL: Record<AsaasAmbiente, string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  producao: "https://api.asaas.com/v3",
};

// Mapeia o status do pagamento ASAAS para o vocabulario interno.
// ASAAS nao "rejeita" pagamento como o MP — tentativa falha fica pendente.
export function mapAsaasStatus(status: string): PaymentStatus {
  switch (status) {
    case "CONFIRMED":
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
    case "DUNNING_RECEIVED":
      return "pago";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "cancelado";
    case "PENDING":
    case "OVERDUE":
    case "AWAITING_RISK_ANALYSIS":
    default:
      return "pendente";
  }
}

type AsaasPayment = {
  id: string;
  status: string;
  value: number | null;
  invoiceUrl: string;
  externalReference: string | null;
  confirmedDate: string | null;
  paymentDate: string | null;
  clientPaymentDate: string | null;
};

export class AsaasGateway implements PaymentGateway {
  readonly slug = "asaas" as const;
  private baseUrl: string;

  constructor(
    private apiKey: string,
    ambiente: AsaasAmbiente,
    private webhookToken: string | null,
  ) {
    this.baseUrl = BASE_URL[ambiente];
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        access_token: this.apiKey,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`asaas_request_failed: ${init?.method ?? "GET"} ${path} ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  }

  /** Cria (ou obtem) um customer no ASAAS. Obrigatorio antes da cobranca. */
  async createCustomer(input: {
    name: string;
    cpfCnpj: string;
    externalReference: string;
  }): Promise<string> {
    const json = await this.request<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
        externalReference: input.externalReference,
      }),
    });
    return json.id;
  }

  async createCharge(input: GatewayChargeInput): Promise<GatewayCharge> {
    if (!input.gatewayCustomerId) {
      throw new Error("asaas_customer_ausente: crie o customer antes da cobranca.");
    }
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = input.vencimento && input.vencimento >= today ? input.vencimento : today;
    const json = await this.request<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: input.gatewayCustomerId,
        billingType: "UNDEFINED", // cliente escolhe PIX / boleto / cartao
        value: Number(input.valor.toFixed(2)),
        dueDate,
        description: input.descricao,
        externalReference: input.externalReference,
      }),
    });
    return { chargeId: json.id, paymentId: json.id, payUrl: json.invoiceUrl };
  }

  async getPaymentStatus(paymentId: string): Promise<GatewayPaymentStatus> {
    const p = await this.request<AsaasPayment>(`/payments/${paymentId}`);
    const status = mapAsaasStatus(p.status);
    const paidAt =
      status === "pago"
        ? p.confirmedDate ?? p.paymentDate ?? p.clientPaymentDate ?? null
        : null;
    return {
      status,
      paidAt,
      amount: p.value ?? null,
      externalReference: p.externalReference ?? null,
    };
  }

  verifyWebhook(headers: Headers, _rawBody: string): boolean {
    if (!this.webhookToken) {
      // Sem token configurado (dev): aceita sem validar.
      return true;
    }
    const provided = headers.get("asaas-access-token");
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(this.webhookToken);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  extractWebhookRef(body: unknown): GatewayWebhookRef | null {
    const id = (body as { payment?: { id?: string } })?.payment?.id;
    return id ? { paymentId: String(id) } : null;
  }
}
