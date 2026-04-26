import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { createWhatsappWebhookHandlers } from "@/lib/whatsapp/webhook-handler";

const inboundPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "business-id",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "5541999990000",
              phone_number_id: "phone-number-id",
            },
            contacts: [
              {
                profile: { name: "Oficina Teste" },
                wa_id: "5541999421180",
              },
            ],
            messages: [
              {
                from: "5541999421180",
                id: "wamid.test-1",
                timestamp: "1714070400",
                text: { body: "Oi, quero testar o Quando Trocar" },
                type: "text",
              },
            ],
          },
        },
      ],
    },
  ],
};

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

describe("whatsapp webhook handlers", () => {
  const env = {
    WHATSAPP_VERIFY_TOKEN: "verify-token",
    WHATSAPP_APP_SECRET: "app-secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("GET returns Meta challenge when verify token matches", async () => {
    const handlers = createWhatsappWebhookHandlers({
      env,
      repository: {} as never,
      whatsapp: {} as never,
      agent: {} as never,
    });

    const response = await handlers.GET(
      new Request(
        "https://example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=abc123",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });

  test("GET rejects invalid verify token", async () => {
    const handlers = createWhatsappWebhookHandlers({
      env,
      repository: {} as never,
      whatsapp: {} as never,
      agent: {} as never,
    });

    const response = await handlers.GET(
      new Request(
        "https://example.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123",
      ),
    );

    expect(response.status).toBe(403);
  });

  test("POST rejects invalid signature", async () => {
    const handlers = createWhatsappWebhookHandlers({
      env,
      repository: {} as never,
      whatsapp: {} as never,
      agent: {} as never,
    });

    const response = await handlers.POST(
      new Request("https://example.com/api/webhooks/whatsapp", {
        method: "POST",
        headers: { "x-hub-signature-256": "sha256=bad" },
        body: JSON.stringify(inboundPayload),
      }),
    );

    expect(response.status).toBe(401);
  });

  test("POST persists event before processing inbound message and sends response", async () => {
    const calls: string[] = [];
    const repository = {
      saveWhatsappEvent: vi.fn(async () => {
        calls.push("event");
        return { duplicate: false, eventId: "event-id" };
      }),
      upsertLead: vi.fn(async () => {
        calls.push("lead");
        return { id: "lead-id", status: "em_conversa" as const };
      }),
      upsertConversation: vi.fn(async () => {
        calls.push("conversation");
        return { id: "conversation-id" };
      }),
      saveInboundMessage: vi.fn(async () => {
        calls.push("inbound");
        return { duplicate: false, messageId: "message-id" };
      }),
      saveAgentToolCall: vi.fn(async () => {
        calls.push("tool");
      }),
      markWhatsappEventProcessed: vi.fn(async () => {
        calls.push("event-processed");
      }),
      markWhatsappEventFailed: vi.fn(async () => {
        calls.push("event-failed");
      }),
      updateLeadStatus: vi.fn(async () => {
        calls.push("lead-status");
      }),
      createOutboundMessage: vi.fn(async () => {
        calls.push("outbox");
        return { id: "outbound-id" };
      }),
      saveOutboundMessage: vi.fn(async () => {
        calls.push("outbound-message");
        return { id: "outbound-message-id" };
      }),
      markOutboundSent: vi.fn(async () => {
        calls.push("sent");
      }),
      markOutboundFailed: vi.fn(),
    };
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "A oficina cadastra a troca, o sistema chama o cliente depois e ajuda ele a voltar na próxima troca. Quer me dizer quantas trocas faz por mês?",
        status: "em_conversa" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({ env, repository, whatsapp, agent });
    const response = await handlers.POST(signedRequest(inboundPayload, env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(calls.slice(0, 4)).toEqual(["event", "lead", "conversation", "inbound"]);
    expect(repository.upsertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp: "+5541999421180",
        nome: "Oficina Teste",
        origem: "landing_page",
        status: "em_conversa",
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: expect.stringContaining("oficina cadastra a troca"),
    });
  });

  test("POST does not process duplicate events", async () => {
    const repository = {
      saveWhatsappEvent: vi.fn(async () => ({ duplicate: true, eventId: "event-id" })),
      upsertLead: vi.fn(),
      upsertConversation: vi.fn(),
      saveInboundMessage: vi.fn(),
      saveAgentToolCall: vi.fn(),
      markWhatsappEventProcessed: vi.fn(),
      markWhatsappEventFailed: vi.fn(),
      updateLeadStatus: vi.fn(),
      createOutboundMessage: vi.fn(),
      saveOutboundMessage: vi.fn(),
      markOutboundSent: vi.fn(),
      markOutboundFailed: vi.fn(),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp: { sendTextMessage: vi.fn() },
      agent: { generateReply: vi.fn() },
    });

    const response = await handlers.POST(signedRequest(inboundPayload, env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(repository.upsertLead).not.toHaveBeenCalled();
  });

  test("POST persists lead status decided by the sales agent", async () => {
    const repository = {
      saveWhatsappEvent: vi.fn(async () => ({ duplicate: false, eventId: "event-id" })),
      upsertLead: vi.fn(async () => ({ id: "lead-id", status: "em_conversa" as const })),
      upsertConversation: vi.fn(async () => ({ id: "conversation-id" })),
      saveInboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
      saveAgentToolCall: vi.fn(),
      markWhatsappEventProcessed: vi.fn(),
      markWhatsappEventFailed: vi.fn(),
      updateLeadStatus: vi.fn(),
      createOutboundMessage: vi.fn(async () => ({ id: "outbound-id" })),
      saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "outbound-message-id" })),
      markOutboundSent: vi.fn(),
      markOutboundFailed: vi.fn(),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Perfeito. Registro seu interesse e um humano segue com os próximos passos.",
        status: "interessado" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp: {
        sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
      },
      agent,
    });

    const response = await handlers.POST(signedRequest(inboundPayload, env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(repository.updateLeadStatus).toHaveBeenCalledWith({
      leadId: "lead-id",
      status: "interessado",
    });
    expect(repository.saveAgentToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "update_lead",
        input: { status: "em_conversa" },
        output: { status: "interessado" },
      }),
    );
  });

  test("POST persists processing errors when the agent fails", async () => {
    const repository = {
      saveWhatsappEvent: vi.fn(async () => ({ duplicate: false, eventId: "event-id" })),
      upsertLead: vi.fn(async () => ({ id: "lead-id", status: "interessado" as const })),
      upsertConversation: vi.fn(async () => ({ id: "conversation-id" })),
      saveInboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
      saveAgentToolCall: vi.fn(),
      markWhatsappEventProcessed: vi.fn(),
      markWhatsappEventFailed: vi.fn(),
      updateLeadStatus: vi.fn(),
      createOutboundMessage: vi.fn(),
      saveOutboundMessage: vi.fn(),
      markOutboundSent: vi.fn(),
      markOutboundFailed: vi.fn(),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp: { sendTextMessage: vi.fn() },
      agent: {
        generateReply: vi.fn(async () => {
          throw new Error("OpenAI authentication failed");
        }),
      },
    });

    const response = await handlers.POST(signedRequest(inboundPayload, env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      errors: [
        {
          whatsappMessageId: "wamid.test-1",
          errorType: "agent_processing_failed",
          message: "OpenAI authentication failed",
        },
      ],
    });
    expect(repository.markWhatsappEventFailed).toHaveBeenCalledWith({
      eventId: "event-id",
      errorType: "agent_processing_failed",
      errorMessage: "OpenAI authentication failed",
      errorContext: expect.objectContaining({
        whatsappMessageId: "wamid.test-1",
        conversationId: "conversation-id",
        leadId: "lead-id",
      }),
    });
    expect(repository.saveAgentToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "agent_error",
        output: expect.objectContaining({
          errorType: "agent_processing_failed",
          errorMessage: "OpenAI authentication failed",
        }),
      }),
    );
    expect(repository.createOutboundMessage).not.toHaveBeenCalled();
  });
});
