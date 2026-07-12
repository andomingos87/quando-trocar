import "server-only";

// Camada de abstracao de provedor de pagamento (ADR-0021).
// Um gateway concreto (Mercado Pago, ASAAS) implementa `PaymentGateway`.
// billing.ts fala com `getActiveGateway`; os webhooks falam com `getGateway`.

export type GatewaySlug = "mercado_pago" | "asaas";

export type PaymentStatus = "pendente" | "pago" | "falhou" | "cancelado";

export type GatewayChargeInput = {
  valor: number;
  descricao: string;
  externalReference: string;
  oficinaId: string;
  vencimento: string | null; // yyyy-mm-dd
  notificationUrl?: string; // usado pelo MP (notification_url por preferencia); ASAAS ignora
  gatewayCustomerId?: string | null; // id do customer no provedor (ASAAS)
};

export type GatewayCharge = {
  chargeId: string; // id conhecido na criacao (MP: preference id; ASAAS: payment id)
  paymentId: string | null; // id do pagamento efetivo se ja conhecido (ASAAS); null no MP ate o webhook
  payUrl: string; // link para o cliente pagar
};

export type GatewayPaymentStatus = {
  status: PaymentStatus;
  paidAt: string | null;
  amount: number | null;
  externalReference: string | null;
};

export type GatewayWebhookRef = {
  paymentId: string;
};

export interface PaymentGateway {
  readonly slug: GatewaySlug;

  /** Cria a cobranca no provedor e retorna o link de pagamento. */
  createCharge(input: GatewayChargeInput): Promise<GatewayCharge>;

  /** Consulta o status autoritativo de um pagamento pelo id do provedor. */
  getPaymentStatus(paymentId: string): Promise<GatewayPaymentStatus>;

  /** Valida a origem do webhook (assinatura/token). */
  verifyWebhook(headers: Headers, rawBody: string): boolean;

  /** Extrai o id do pagamento do corpo do webhook (null = ignorar). */
  extractWebhookRef(body: unknown): GatewayWebhookRef | null;
}
