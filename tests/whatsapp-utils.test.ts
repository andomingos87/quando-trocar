import { describe, expect, test } from "vitest";

import {
  calculateRoi,
  classifySalesMessage,
  detectLeadOrigin,
  normalizeWhatsappPhone,
  WhatsappSalesAgent,
} from "@/lib/whatsapp/sales-agent";

describe("whatsapp sales utilities", () => {
  test("normalizes Brazilian WhatsApp numbers to E.164", () => {
    expect(normalizeWhatsappPhone("41999421180")).toBe("+5541999421180");
    expect(normalizeWhatsappPhone("5541999421180")).toBe("+5541999421180");
    expect(normalizeWhatsappPhone("+55 (41) 99942-1180")).toBe("+5541999421180");
  });

  test("calculates recovered revenue with the default 10 percent rate", () => {
    expect(calculateRoi({ monthlyChanges: 80, averageTicket: 250 })).toEqual({
      monthlyChanges: 80,
      averageTicket: 250,
      recoveryRate: 0.1,
      recoveredRevenue: 2000,
    });
  });

  test("detects landing page origin from the CTA message", () => {
    expect(detectLeadOrigin("Oi, quero testar o Quando Trocar")).toBe("landing_page");
    expect(detectLeadOrigin("oi quero testar o quando trocar")).toBe("landing_page");
    expect(detectLeadOrigin("Boa tarde")).toBe("manual_whatsapp");
  });

  test("classifies common sales messages deterministically", () => {
    expect(classifySalesMessage("como funciona?").intent).toBe("pergunta_funcionamento");
    expect(classifySalesMessage("faço 80 trocas por mês ticket 250")).toMatchObject({
      intent: "informa_volume_ticket",
      monthlyChanges: 80,
      averageTicket: 250,
    });
    expect(classifySalesMessage("quero testar")).toMatchObject({ intent: "quer_testar" });
    expect(classifySalesMessage("não tenho interesse")).toMatchObject({
      intent: "sem_interesse",
    });
  });

  test("continues an interested lead conversation when OpenAI classification fails", async () => {
    const agent = new WhatsappSalesAgent({
      classifierModel: "test-model",
      openai: {
        responses: {
          create: async () => {
            throw new Error("invalid api key");
          },
        },
      } as never,
    });

    const reply = await agent.generateReply({
      message: "Guarulhos",
      leadStatus: "interessado",
    });

    expect(reply.status).toBe("interessado");
    expect(reply.body).toContain("Guarulhos");
    expect(reply.body).toContain("registrado");
  });
});
