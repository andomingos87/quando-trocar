import { describe, expect, test, vi } from "vitest";

import { resolveWhatsappConversation } from "@/lib/whatsapp/conversation-router";

describe("resolveWhatsappConversation", () => {
  test("routes an active workshop phone to onboarding without creating a lead", async () => {
    const repository = {
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Auto Center Silva",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
      getConversationByWhatsapp: vi.fn(async () => null),
      upsertOficinaConversation: vi.fn(async () => ({
        id: "conversation-id",
        agentMode: "onboarding" as const,
        participantType: "oficina_cliente" as const,
        context: {},
        leadId: null,
        oficinaId: "oficina-id",
      })),
      upsertLead: vi.fn(),
      upsertSalesLeadConversation: vi.fn(),
    };

    const result = await resolveWhatsappConversation({
      repository,
      whatsapp: "+5541999421180",
      contactName: "Auto Center Silva",
      body: "Joao, Civic, troca de oleo hoje, 41999990000",
    });

    expect(result).toMatchObject({
      conversationId: "conversation-id",
      agentMode: "onboarding",
      participantType: "oficina_cliente",
      oficinaId: "oficina-id",
    });
    expect(repository.upsertLead).not.toHaveBeenCalled();
    expect(repository.upsertSalesLeadConversation).not.toHaveBeenCalled();
  });

  test("keeps unknown workshop phones in the sales flow", async () => {
    const repository = {
      getOficinaByWhatsapp: vi.fn(async () => null),
      getConversationByWhatsapp: vi.fn(),
      upsertOficinaConversation: vi.fn(),
      upsertLead: vi.fn(async () => ({ id: "lead-id", status: "em_conversa" as const })),
      upsertSalesLeadConversation: vi.fn(async () => ({
        id: "conversation-id",
        agentMode: "vendas" as const,
        participantType: "lead_oficina" as const,
        context: {},
        leadId: "lead-id",
        oficinaId: null,
      })),
    };

    const result = await resolveWhatsappConversation({
      repository,
      whatsapp: "+5541999421180",
      contactName: "Oficina Teste",
      body: "Oi, quero testar o Quando Trocar",
    });

    expect(result).toMatchObject({
      conversationId: "conversation-id",
      leadId: "lead-id",
      agentMode: "vendas",
      participantType: "lead_oficina",
    });
    expect(repository.upsertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp: "+5541999421180",
        origem: "landing_page",
        status: "em_conversa",
      }),
    );
  });
});
