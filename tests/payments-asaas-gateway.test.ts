import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AsaasGateway, mapAsaasStatus } from "@/lib/payments/asaas-gateway";

function mockFetchOnce(json: unknown, ok = true, status = 200) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => json,
    text: async () => JSON.stringify(json),
  });
}

function lastCall() {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const [url, init] = calls[calls.length - 1] as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(init.body as string) : null };
}

describe("mapAsaasStatus", () => {
  it("maps confirmed/received to pago", () => {
    expect(mapAsaasStatus("CONFIRMED")).toBe("pago");
    expect(mapAsaasStatus("RECEIVED")).toBe("pago");
    expect(mapAsaasStatus("RECEIVED_IN_CASH")).toBe("pago");
  });
  it("maps refund/chargeback to cancelado", () => {
    expect(mapAsaasStatus("REFUNDED")).toBe("cancelado");
    expect(mapAsaasStatus("CHARGEBACK_REQUESTED")).toBe("cancelado");
  });
  it("defaults pending/overdue to pendente", () => {
    expect(mapAsaasStatus("PENDING")).toBe("pendente");
    expect(mapAsaasStatus("OVERDUE")).toBe("pendente");
    expect(mapAsaasStatus("UNKNOWN_X")).toBe("pendente");
  });
});

describe("AsaasGateway", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("createCustomer envia access_token e cpfCnpj so com digitos", async () => {
    const gw = new AsaasGateway("key_123", "sandbox", null);
    mockFetchOnce({ id: "cus_1" });
    const id = await gw.createCustomer({
      name: "Oficina X",
      cpfCnpj: "12.345.678/0001-99",
      externalReference: "oficina-uuid",
    });
    expect(id).toBe("cus_1");
    const { url, init, body } = lastCall();
    expect(url).toBe("https://api-sandbox.asaas.com/v3/customers");
    expect((init.headers as Record<string, string>).access_token).toBe("key_123");
    expect(body.cpfCnpj).toBe("12345678000199");
  });

  it("createCharge exige customer e retorna link", async () => {
    const gw = new AsaasGateway("key_123", "sandbox", null);
    mockFetchOnce({ id: "pay_1", status: "PENDING", value: 59, invoiceUrl: "https://asaas/i/pay_1" });
    const charge = await gw.createCharge({
      valor: 59,
      descricao: "Mensalidade",
      externalReference: "oficina:abc|venc:2026-08-01|t:1",
      oficinaId: "abc",
      vencimento: "2999-12-31",
      gatewayCustomerId: "cus_1",
    });
    expect(charge).toEqual({
      chargeId: "pay_1",
      paymentId: "pay_1",
      payUrl: "https://asaas/i/pay_1",
    });
    const { body } = lastCall();
    expect(body.billingType).toBe("UNDEFINED");
    expect(body.customer).toBe("cus_1");
    expect(body.dueDate).toBe("2999-12-31");
  });

  it("createCharge usa hoje quando o vencimento ja passou", async () => {
    const gw = new AsaasGateway("key_123", "producao", null);
    mockFetchOnce({ id: "pay_2", status: "PENDING", value: 59, invoiceUrl: "u" });
    await gw.createCharge({
      valor: 59,
      descricao: "x",
      externalReference: "r",
      oficinaId: "abc",
      vencimento: "2020-01-01",
      gatewayCustomerId: "cus_1",
    });
    const { url, body } = lastCall();
    expect(url).toBe("https://api.asaas.com/v3/payments");
    expect(body.dueDate).not.toBe("2020-01-01");
    expect(body.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("createCharge falha sem customer, sem chamar a API", async () => {
    const gw = new AsaasGateway("key_123", "sandbox", null);
    await expect(
      gw.createCharge({
        valor: 59,
        descricao: "x",
        externalReference: "r",
        oficinaId: "abc",
        vencimento: null,
      }),
    ).rejects.toThrow(/asaas_customer_ausente/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("getPaymentStatus mapeia pago com paidAt e amount", async () => {
    const gw = new AsaasGateway("key_123", "sandbox", null);
    mockFetchOnce({
      id: "pay_1",
      status: "RECEIVED",
      value: 59,
      invoiceUrl: "u",
      externalReference: "oficina:abc|venc:2026-08-01|t:1",
      confirmedDate: "2026-07-10",
    });
    const info = await gw.getPaymentStatus("pay_1");
    expect(info.status).toBe("pago");
    expect(info.paidAt).toBe("2026-07-10");
    expect(info.amount).toBe(59);
    expect(info.externalReference).toBe("oficina:abc|venc:2026-08-01|t:1");
  });

  it("verifyWebhook valida o token asaas-access-token", () => {
    const gw = new AsaasGateway("key_123", "sandbox", "segredo");
    expect(gw.verifyWebhook(new Headers({ "asaas-access-token": "segredo" }))).toBe(true);
    expect(gw.verifyWebhook(new Headers({ "asaas-access-token": "errado" }))).toBe(false);
    expect(gw.verifyWebhook(new Headers({}))).toBe(false);
  });

  it("verifyWebhook aceita quando nao ha token (dev)", () => {
    const gw = new AsaasGateway("key_123", "sandbox", null);
    expect(gw.verifyWebhook(new Headers({}))).toBe(true);
  });

  it("extractWebhookRef pega payment.id", () => {
    const gw = new AsaasGateway("key_123", "sandbox", null);
    expect(gw.extractWebhookRef({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_9" } })).toEqual({
      paymentId: "pay_9",
    });
    expect(gw.extractWebhookRef({ event: "x" })).toBeNull();
  });
});
