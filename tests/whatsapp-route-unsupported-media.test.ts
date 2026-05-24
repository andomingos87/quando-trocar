import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import {
  createWhatsappWebhookHandlers,
  type AudioTranscriber,
  type MediaDownloader,
} from "@/lib/whatsapp/webhook-handler";

// Suite de F0: image / document / sticker / video / location / contacts /
// tipo desconhecido. Hoje todos disparam fallback contextual (ADR-0016 trará
// image+document para pipeline próprio no futuro; quando o pipeline falhar,
// cairá neste mesmo branch).

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

function payloadFor(message: Record<string, unknown>) {
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
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

function baseRepository(overrides: Record<string, unknown> = {}) {
  return {
    saveWhatsappEvent: vi.fn(async () => ({ duplicate: false, eventId: "event-id" })),
    saveInboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
    saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "outbound-id" })),
    saveAgentToolCall: vi.fn(async () => undefined),
    markWhatsappEventProcessed: vi.fn(async () => undefined),
    markWhatsappEventFailed: vi.fn(async () => undefined),
    updateMessageStatusByWhatsappMessageId: vi.fn(async () => undefined),
    updateOutboundStatusByWhatsappMessageId: vi.fn(async () => undefined),
    updateReminderDeliveryStatusByWhatsappMessageId: vi.fn(async () => undefined),
    getOficinaByWhatsapp: vi.fn(async () => null),
    getConversationByWhatsapp: vi.fn(async () => null),
    findReminderConversationByWhatsapp: vi.fn(async () => null),
    upsertOficinaConversation: vi.fn(),
    upsertSalesLeadConversation: vi.fn(async () => ({
      id: "lead-conversation-id",
      leadId: "lead-id",
      agentMode: "vendas" as const,
      participantType: "lead_oficina" as const,
      context: {},
    })),
    upsertClienteFinalConversation: vi.fn(),
    upsertLead: vi.fn(async () => ({ id: "lead-id", status: "em_conversa" as const })),
    upsertConversation: vi.fn(),
    updateConversationModeAndContext: vi.fn(async () => undefined),
    markConversationHandoff: vi.fn(async () => undefined),
    updateClienteFinalStatus: vi.fn(async () => undefined),
    cancelFutureRemindersForCliente: vi.fn(async () => 0),
    updateReminderStatus: vi.fn(async () => undefined),
    updateLeadStatus: vi.fn(async () => undefined),
    createOutboundMessage: vi.fn(async () => ({ id: "outbox-id" })),
    markOutboundSent: vi.fn(async () => undefined),
    markOutboundFailed: vi.fn(async () => undefined),
    ...overrides,
  };
}

const env = {
  WHATSAPP_VERIFY_TOKEN: "verify-token",
  WHATSAPP_APP_SECRET: "app-secret",
};

// Para áudio: providers mockados nunca são chamados nesta suite, mas o handler
// pode exigi-los como deps. Passamos stubs vazios.
const stubDownloader: MediaDownloader = {
  getMediaMetadata: vi.fn(),
  downloadMedia: vi.fn(),
};
const stubTranscriber: AudioTranscriber = { transcribe: vi.fn() };

describe("whatsapp webhook — F0 fallback para mídia não suportada", () => {
  test.each([
    {
      kind: "image",
      message: {
        from: "5541999421180",
        id: "wamid.image-1",
        timestamp: "1714070400",
        type: "image",
        image: { id: "image-id", mime_type: "image/jpeg" },
      },
    },
    {
      kind: "document",
      message: {
        from: "5541999421180",
        id: "wamid.doc-1",
        timestamp: "1714070400",
        type: "document",
        document: { id: "doc-id", mime_type: "application/pdf" },
      },
    },
    {
      kind: "sticker",
      message: {
        from: "5541999421180",
        id: "wamid.sticker-1",
        timestamp: "1714070400",
        type: "sticker",
        sticker: { id: "sticker-id" },
      },
    },
    {
      kind: "video",
      message: {
        from: "5541999421180",
        id: "wamid.video-1",
        timestamp: "1714070400",
        type: "video",
        video: { id: "video-id", mime_type: "video/mp4" },
      },
    },
    {
      kind: "location",
      message: {
        from: "5541999421180",
        id: "wamid.loc-1",
        timestamp: "1714070400",
        type: "location",
        location: { latitude: -25.4, longitude: -49.2 },
      },
    },
    {
      kind: "contacts",
      message: {
        from: "5541999421180",
        id: "wamid.contacts-1",
        timestamp: "1714070400",
        type: "contacts",
        contacts: [{ name: { formatted_name: "Alguém" } }],
      },
    },
    {
      kind: "unsupported",
      message: {
        from: "5541999421180",
        id: "wamid.unknown-1",
        timestamp: "1714070400",
        type: "reaction",
      },
    },
  ])(
    "$kind → envia fallback contextual e não chama agente",
    async ({ kind, message }) => {
      const repository = baseRepository();
      const whatsapp = {
        sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback" })),
      };
      const agent = { generateReply: vi.fn() };

      const handlers = createWhatsappWebhookHandlers({
        env,
        repository,
        whatsapp,
        agent,
        mediaDownloader: stubDownloader,
        audioTranscriber: stubTranscriber,
      });

      const response = await handlers.POST(
        signedRequest(payloadFor(message), env.WHATSAPP_APP_SECRET),
      );

      expect(response.status).toBe(200);
      expect(agent.generateReply).not.toHaveBeenCalled();
      // Fallback sempre instrui a mandar por texto
      expect(whatsapp.sendTextMessage).toHaveBeenCalledTimes(1);
      const call = whatsapp.sendTextMessage.mock.calls[0][0] as { body: string };
      expect(call.body.toLowerCase()).toContain("texto");
      // saveInboundMessage gravou o tipo correto
      expect(repository.saveInboundMessage).toHaveBeenCalledWith(
        expect.objectContaining({ mediaType: kind }),
      );
      // Outbound persistido
      expect(repository.createOutboundMessage).toHaveBeenCalled();
      expect(repository.markOutboundSent).toHaveBeenCalled();
    },
  );

  test("texto continua roteando para o agente normalmente (regressão)", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Oi! Como posso ajudar?",
        status: "em_conversa" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: stubDownloader,
      audioTranscriber: stubTranscriber,
    });

    const response = await handlers.POST(
      signedRequest(
        payloadFor({
          from: "5541999421180",
          id: "wamid.text-1",
          timestamp: "1714070400",
          type: "text",
          text: { body: "olá" },
        }),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(agent.generateReply).toHaveBeenCalledWith(
      expect.objectContaining({ message: "olá" }),
    );
  });
});
