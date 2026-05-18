import "server-only";

export type MpPreferenceInput = {
  valor: number;
  descricao: string;
  externalReference: string;
  oficinaId: string;
  vencimento: string | null;
  notificationUrl?: string;
};

export type MpPreference = {
  id: string;
  init_point: string;
};

export type MpPayment = {
  id: string;
  status: string;
  status_detail: string | null;
  external_reference: string | null;
  transaction_amount: number | null;
  date_approved: string | null;
};

export class MercadoPagoClient {
  constructor(private accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN) {}

  private assertToken(): string {
    if (!this.accessToken) {
      throw new Error("MERCADO_PAGO_ACCESS_TOKEN ausente — billing desabilitado.");
    }
    return this.accessToken;
  }

  async createPreference(input: MpPreferenceInput): Promise<MpPreference> {
    const token = this.assertToken();
    const body = {
      items: [
        {
          title: input.descricao,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(input.valor.toFixed(2)),
        },
      ],
      external_reference: input.externalReference,
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
      metadata: { oficina_id: input.oficinaId, vencimento: input.vencimento },
      notification_url: input.notificationUrl,
    };
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`mp_preference_failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { id: string; init_point: string };
    return { id: json.id, init_point: json.init_point };
  }

  async getPayment(mpPaymentId: string): Promise<MpPayment> {
    const token = this.assertToken();
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`mp_get_payment_failed: ${res.status}`);
    }
    const json = (await res.json()) as MpPayment;
    return json;
  }
}

export function mapMpStatus(status: string): "pago" | "falhou" | "cancelado" | "pendente" {
  switch (status) {
    case "approved":
      return "pago";
    case "rejected":
      return "falhou";
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "cancelado";
    case "in_process":
    case "pending":
    case "authorized":
    default:
      return "pendente";
  }
}
