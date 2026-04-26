import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { createWhatsappWebhookHandlers } from "@/lib/whatsapp/webhook-handler";

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

function inboundCustomerPayload(body: string, contextMessageId = "wamid.outbound-1") {
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
                  profile: { name: "Joao" },
                  wa_id: "5541999990000",
                },
              ],
              messages: [
                {
                  from: "5541999990000",
                  id: `wamid.${body.replace(/\W/g, "-")}`,
                  timestamp: "1771452000",
                  text: { body },
                  type: "text",
                  context: { id: contextMessageId },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function statusPayload(status: "sent" | "delivered" | "read" | "failed") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "business-id",
        changes: [
          {
            field: "messages",
            value: {
              statuses: [
                {
                  id: "wamid.outbound-1",
                  status,
                  timestamp: "1771452060",
                  recipient_id: "5541999990000",
                  errors:
                    status === "failed"
                      ? [{ code: 131000, title: "temporary failure", message: "try later" }]
                      : undefined,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function phase3Repository(overrides: Record<string, unknown> = {}) {
  return {
    saveWhatsappEvent: vi.fn(async () => ({ duplicate: false, eventId: "event-id" })),
    saveInboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
    saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "outbound-id" })),
    saveAgentToolCall: vi.fn(async () => undefined),
    markWhatsappEventProcessed: vi.fn(async () => undefined),
    markWhatsappEventFailed: vi.fn(async () => undefined),
    saveWhatsappStatusEvent: vi.fn(async () => ({ duplicate: false, eventId: "status-event-id" })),
    updateMessageStatusByWhatsappMessageId: vi.fn(async () => undefined),
    updateOutboundStatusByWhatsappMessageId: vi.fn(async () => undefined),
    updateReminderDeliveryStatusByWhatsappMessageId: vi.fn(async () => undefined),
    getOficinaByWhatsapp: vi.fn(async () => null),
    getConversationByWhatsapp: vi.fn(async () => null),
    upsertOficinaConversation: vi.fn(async () => ({
      id: "oficina-conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      agentMode: "onboarding" as const,
      participantType: "oficina_cliente" as const,
      context: {},
    })),
    upsertLead: vi.fn(async () => ({ id: "lead-id", status: "em_conversa" as const })),
    upsertConversation: vi.fn(),
    upsertSalesLeadConversation: vi.fn(async () => ({
      id: "lead-conversation-id",
      leadId: "lead-id",
      agentMode: "vendas" as const,
      participantType: "lead_oficina" as const,
      context: {},
    })),
    findReminderConversationByWhatsapp: vi.fn(async () => ({
      id: "customer-conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      clienteId: "cliente-id",
      participantType: "cliente_final" as const,
      agentMode: "cliente_final_lembrete" as const,
      context: { lastReminderId: "lembrete-id" },
    })),
    upsertClienteFinalConversation: vi.fn(async () => ({
      id: "customer-conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      clienteId: "cliente-id",
      participantType: "cliente_final" as const,
      agentMode: "cliente_final_lembrete" as const,
      context: { lastReminderId: "lembrete-id" },
    })),
    updateConversationModeAndContext: vi.fn(async () => undefined),
    markConversationHandoff: vi.fn(async () => undefined),
    updateClienteFinalStatus: vi.fn(async () => undefined),
    cancelFutureRemindersForCliente: vi.fn(async () => 2),
    updateReminderStatus: vi.fn(async () => undefined),
    createOutboundMessage: vi.fn(async () => ({ id: "freeform-outbound-id" })),
    markOutboundSent: vi.fn(async () => undefined),
    markOutboundFailed: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("whatsapp webhook phase 3", () => {
  const env = {
    WHATSAPP_VERIFY_TOKEN: "verify-token",
    WHATSAPP_APP_SECRET: "app-secret",
  };

  test("processes Meta status updates without calling agents", async () => {
    const repository = phase3Repository();
    const agent = { generateReply: vi.fn() };
    const reminderAgent = { generateReply: vi.fn() };
    const whatsapp = { sendTextMessage: vi.fn(), sendTemplateMessage: vi.fn() };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      reminderAgent,
    });

    const response = await handlers.POST(
      signedRequest(statusPayload("delivered"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(repository.saveWhatsappEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventId: "wamid.outbound-1:delivered:1771452060",
      }),
    );
    expect(repository.updateMessageStatusByWhatsappMessageId).toHaveBeenCalledWith({
      whatsappMessageId: "wamid.outbound-1",
      providerStatus: "delivered",
      providerErrorCode: null,
      providerErrorMessage: null,
      rawStatus: expect.any(Object),
    });
    expect(repository.updateOutboundStatusByWhatsappMessageId).toHaveBeenCalled();
    expect(agent.generateReply).not.toHaveBeenCalled();
    expect(reminderAgent.generateReply).not.toHaveBeenCalled();
    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
  });

  test("routes client final opt-out replies away from sales and cancels future reminders", async () => {
    const repository = phase3Repository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-optout-1" })),
      sendTemplateMessage: vi.fn(),
    };
    const reminderAgent = {
      generateReply: vi.fn(async () => ({
        intent: "opt_out" as const,
        confidence: 0.98,
        handoffRequired: false,
        handoffReason: null,
        lembreteStatus: "cancelado" as const,
        clienteStatus: "opt_out" as const,
        shouldCancelFutureReminders: true,
        replyBody: "Tudo certo. Vou parar por aqui e nao envio mais lembretes.",
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      reminderAgent,
    });

    const response = await handlers.POST(
      signedRequest(inboundCustomerPayload("parar"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(repository.upsertLead).not.toHaveBeenCalled();
    expect(reminderAgent.generateReply).toHaveBeenCalledWith({
      message: "parar",
      conversationContext: { lastReminderId: "lembrete-id" },
    });
    expect(repository.updateClienteFinalStatus).toHaveBeenCalledWith({
      clienteId: "cliente-id",
      status: "opt_out",
      optOutAt: expect.any(String),
    });
    expect(repository.cancelFutureRemindersForCliente).toHaveBeenCalledWith({
      clienteId: "cliente-id",
    });
    expect(repository.updateReminderStatus).toHaveBeenCalledWith({
      reminderId: "lembrete-id",
      status: "cancelado",
      whatsappMessageId: null,
      providerStatus: null,
      providerErrorCode: null,
      lastError: null,
    });
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999990000",
      body: "Tudo certo. Vou parar por aqui e nao envio mais lembretes.",
    });
  });
});
