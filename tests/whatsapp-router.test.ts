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
      upsertConversation: vi.fn(),
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
      upsertConversation: vi.fn(),
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

  test("cliente final respondendo à confirmação (sem lembrete) vira concierge, não vendas", async () => {
    const upsertClienteFinalConversation = vi.fn(async () => ({
      id: "conv-cliente",
      agentMode: "cliente_final_lembrete" as const,
      participantType: "cliente_final" as const,
      context: {},
      leadId: null,
      oficinaId: "oficina-id",
      clienteId: "cliente-id",
    }));
    const repository = {
      getOficinaByWhatsapp: vi.fn(async () => null),
      getConversationByWhatsapp: vi.fn(async () => null),
      upsertConversation: vi.fn(),
      upsertOficinaConversation: vi.fn(),
      upsertSalesLeadConversation: vi.fn(),
      upsertLead: vi.fn(),
      findReminderConversationByWhatsapp: vi.fn(async () => null),
      findClienteFinalConversationByWhatsapp: vi.fn(async () => ({
        id: "conv-cliente",
        agentMode: "cliente_final_lembrete" as const,
        participantType: "cliente_final" as const,
        context: {},
        leadId: null,
        oficinaId: "oficina-id",
        clienteId: "cliente-id",
      })),
      upsertClienteFinalConversation,
    };

    const result = await resolveWhatsappConversation({
      repository,
      whatsapp: "+5541988887777",
      contactName: "Rafael",
      body: "obrigado!",
    });

    expect(result).toMatchObject({
      conversationId: "conv-cliente",
      agentMode: "cliente_final_lembrete",
      participantType: "cliente_final",
      oficinaId: "oficina-id",
      clienteId: "cliente-id",
    });
    // Concierge: NUNCA carrega lastReminderId (senão o webhook despacharia o
    // agente de lembrete em vez do concierge).
    expect(result.context.lastReminderId).toBeUndefined();
    expect(repository.upsertLead).not.toHaveBeenCalled();
    expect(repository.upsertSalesLeadConversation).not.toHaveBeenCalled();
  });

  test("sem conversa de cliente final, número desconhecido cai em vendas", async () => {
    const repository = {
      getOficinaByWhatsapp: vi.fn(async () => null),
      getConversationByWhatsapp: vi.fn(async () => null),
      upsertConversation: vi.fn(),
      upsertOficinaConversation: vi.fn(),
      upsertSalesLeadConversation: vi.fn(async () => ({
        id: "conv-vendas",
        agentMode: "vendas" as const,
        participantType: "lead_oficina" as const,
        context: {},
        leadId: "lead-id",
        oficinaId: null,
      })),
      upsertLead: vi.fn(async () => ({ id: "lead-id", status: "em_conversa" as const })),
      findReminderConversationByWhatsapp: vi.fn(async () => null),
      findClienteFinalConversationByWhatsapp: vi.fn(async () => null),
      upsertClienteFinalConversation: vi.fn(),
    };

    const result = await resolveWhatsappConversation({
      repository,
      whatsapp: "+5541988887777",
      contactName: "Desconhecido",
      body: "oi",
    });

    expect(result).toMatchObject({ agentMode: "vendas", participantType: "lead_oficina" });
    expect(repository.upsertClienteFinalConversation).not.toHaveBeenCalled();
  });
});
