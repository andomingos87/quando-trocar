import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { createWhatsappWebhookHandlers } from "@/lib/whatsapp/webhook-handler";

function inboundPayload(body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "business-id",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [
                {
                  profile: { name: "Oficina Teste" },
                  wa_id: "5541999421180",
                },
              ],
              messages: [
                {
                  from: "5541999421180",
                  id: `wamid.${body.replace(/\W/g, "-")}`,
                  timestamp: "1714070400",
                  text: { body },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signedRequest(payload: unknown, secret: string) {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

  return new Request("https://example.com/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
    body: rawBody,
  });
}

function phase2Repository(overrides: Record<string, unknown> = {}) {
  return {
    saveWhatsappEvent: vi.fn(async () => ({ duplicate: false, eventId: "event-id" })),
    getOficinaByWhatsapp: vi.fn(async () => null),
    getConversationByWhatsapp: vi.fn(async () => null),
    upsertLead: vi.fn(async () => ({
      id: "lead-id",
      status: "em_conversa" as const,
      nome: "Oficina Teste",
      metadata: {},
    })),
    upsertConversation: vi.fn(),
    upsertSalesLeadConversation: vi.fn(async () => ({
      id: "conversation-id",
      leadId: "lead-id",
      agentMode: "vendas" as const,
      participantType: "lead_oficina" as const,
      context: {},
    })),
    upsertOficinaConversation: vi.fn(async () => ({
      id: "conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      agentMode: "onboarding" as const,
      participantType: "oficina_cliente" as const,
      context: {},
    })),
    convertLeadToOficina: vi.fn(async () => ({
      oficinaId: "oficina-id",
      nome: "Oficina sem nome",
      diasLembretePadrao: 90,
    })),
    registerServiceWithReminder: vi.fn(async () => ({
      clienteId: "cliente-id",
      veiculoId: "veiculo-id",
      servicoId: "servico-id",
      lembreteId: "lembrete-id",
    })),
    updateConversationModeAndContext: vi.fn(async () => undefined),
    saveInboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
    saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "outbound-message-id" })),
    saveAgentToolCall: vi.fn(async () => undefined),
    markWhatsappEventProcessed: vi.fn(async () => undefined),
    markWhatsappEventFailed: vi.fn(async () => undefined),
    updateLeadStatus: vi.fn(async () => undefined),
    createOutboundMessage: vi.fn(async () => ({ id: "outbound-id" })),
    markOutboundSent: vi.fn(async () => undefined),
    markOutboundFailed: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("whatsapp webhook phase 2", () => {
  const env = {
    WHATSAPP_VERIFY_TOKEN: "verify-token",
    WHATSAPP_APP_SECRET: "app-secret",
  };

  test("converts a lead to an onboarding workshop when the sales agent accepts a test", async () => {
    const repository = phase2Repository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Perfeito.",
        status: "teste_aceito" as const,
        convertToOficina: true,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("quero testar"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(repository.convertLeadToOficina).toHaveBeenCalledWith({
      leadId: "lead-id",
      conversationId: "conversation-id",
      whatsapp: "+5541999421180",
      responsavel: "Oficina Teste",
      nomeOficina: null,
    });
    expect(repository.saveAgentToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "convert_lead_to_oficina",
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: expect.stringContaining("Pronto, sua oficina esta cadastrada."),
    });
  });

  test("registers the first service for an active workshop and moves onboarding to operation", async () => {
    const repository = phase2Repository({
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Auto Center Silva",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const onboardingAgent = {
      generateReply: vi.fn(async () => ({
        body: "",
        context: {},
        registerServiceInput: {
          nomeCliente: "Joao",
          whatsappCliente: "+5541999990000",
          veiculo: "Civic 2018",
          servico: "troca de oleo",
          dataServico: "2026-04-25",
          valor: null,
          consentimentoWhatsapp: true,
        },
        nextAgentMode: "operacao" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      onboardingAgent,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(repository.registerServiceWithReminder).toHaveBeenCalledWith({
      oficinaId: "oficina-id",
      nomeCliente: "Joao",
      whatsappCliente: "+5541999990000",
      veiculo: "Civic 2018",
      servico: "troca de oleo",
      dataServico: "2026-04-25",
      valor: null,
      consentimentoWhatsapp: true,
    });
    expect(repository.updateConversationModeAndContext).toHaveBeenCalledWith({
      conversationId: "conversation-id",
      agentMode: "operacao",
      context: {},
    });
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: "Cliente cadastrado. Vou lembrar o Joao em 90 dias para voltar trocar óleo com você.",
    });
  });
});
