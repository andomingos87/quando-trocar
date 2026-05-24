import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import {
  createWhatsappWebhookHandlers,
  type AudioTranscriber,
  type ImageDescriber,
  type MediaDownloader,
} from "@/lib/whatsapp/webhook-handler";
import type { ImageVisionResult } from "@/lib/whatsapp/image-vision";

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

function imagePayload(mediaId = "image-id-1", caption: string | null = null) {
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
                  id: `wamid.image-${mediaId}`,
                  timestamp: "1714070400",
                  type: "image",
                  image: {
                    id: mediaId,
                    mime_type: "image/jpeg",
                    caption: caption ?? undefined,
                  },
                },
              ],
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

function makeDownloader(): MediaDownloader & {
  getMediaMetadata: ReturnType<typeof vi.fn>;
  downloadMedia: ReturnType<typeof vi.fn>;
} {
  return {
    getMediaMetadata: vi.fn(async () => ({
      url: "https://lookaside.fbsbx.com/whatsapp/image.jpg",
      mimeType: "image/jpeg",
    })),
    downloadMedia: vi.fn(async () => Buffer.from("fake-image-bytes")),
  };
}

function makeImageDescriber(result: ImageVisionResult): ImageDescriber & {
  describe: ReturnType<typeof vi.fn>;
} {
  return {
    describe: vi.fn(async () => result),
  };
}

const env = {
  WHATSAPP_VERIFY_TOKEN: "verify-token",
  WHATSAPP_APP_SECRET: "app-secret",
};

const stubTranscriber: AudioTranscriber = { transcribe: vi.fn() };

describe("whatsapp webhook — fluxo de imagem (ADR-0016)", () => {
  test("sucesso → agente recebe body '[imagem] ...' (com legenda)", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Anotei o km, conta mais",
        status: "em_conversa" as const,
        toolCalls: [],
      })),
    };
    const imageDescriber = makeImageDescriber({
      status: "success",
      text: "Painel mostra 84.500 km",
      durationMs: 800,
    });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: makeDownloader(),
      audioTranscriber: stubTranscriber,
      imageDescriber,
    });

    const response = await handlers.POST(
      signedRequest(imagePayload("img-1", "olha o km"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(imageDescriber.describe).toHaveBeenCalledWith(
      expect.objectContaining({ caption: "olha o km" }),
    );
    expect(agent.generateReply).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("[imagem]"),
      }),
    );
    // Body contém a descrição e a legenda
    const passedMessage = agent.generateReply.mock.calls[0][0].message as string;
    expect(passedMessage).toContain("84.500 km");
    expect(passedMessage).toContain("olha o km");
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "image",
        mediaId: "img-1",
        transcription: "Painel mostra 84.500 km",
        transcriptionStatus: "success",
      }),
    );
  });

  test("sucesso sem legenda → body '[imagem] descrição' sem fragmento de legenda", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-2" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Beleza",
        status: "em_conversa" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: makeDownloader(),
      audioTranscriber: stubTranscriber,
      imageDescriber: makeImageDescriber({
        status: "success",
        text: "Nota fiscal R$ 320,00",
        durationMs: 700,
      }),
    });

    const response = await handlers.POST(
      signedRequest(imagePayload("img-2"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    const passedMessage = agent.generateReply.mock.calls[0][0].message as string;
    expect(passedMessage).toBe("[imagem] Nota fiscal R$ 320,00");
  });

  test("empty (sem conteúdo extraível) → envia fallback de imagem e não chama agente", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback-1" })),
    };
    const agent = { generateReply: vi.fn() };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: makeDownloader(),
      audioTranscriber: stubTranscriber,
      imageDescriber: makeImageDescriber({ status: "empty", durationMs: 400 }),
    });

    const response = await handlers.POST(
      signedRequest(imagePayload("img-3"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(agent.generateReply).not.toHaveBeenCalled();
    const call = whatsapp.sendTextMessage.mock.calls[0][0] as { body: string };
    expect(call.body.toLowerCase()).toContain("foto");
    expect(call.body.toLowerCase()).toContain("texto");
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "image",
        transcriptionStatus: "empty",
      }),
    );
  });

  test("failed (vision retorna erro) → fallback de imagem", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback-2" })),
    };
    const agent = { generateReply: vi.fn() };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: makeDownloader(),
      audioTranscriber: stubTranscriber,
      imageDescriber: makeImageDescriber({ status: "failed", error: "openai_500" }),
    });

    const response = await handlers.POST(
      signedRequest(imagePayload("img-4"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(agent.generateReply).not.toHaveBeenCalled();
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "image",
        transcriptionStatus: "failed",
        transcriptionError: "openai_500",
      }),
    );
  });

  test("rate limit excedido → fallback sem chamar vision e sem chamar agente", async () => {
    const repository = baseRepository({
      countInboundMediaInLastDay: vi.fn(async () => 50),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.rl-1" })),
    };
    const agent = { generateReply: vi.fn() };
    const imageDescriber = makeImageDescriber({
      status: "success",
      text: "Não deveria ser chamado",
      durationMs: 100,
    });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: makeDownloader(),
      audioTranscriber: stubTranscriber,
      imageDescriber,
    });

    const response = await handlers.POST(
      signedRequest(imagePayload("img-rl"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(imageDescriber.describe).not.toHaveBeenCalled();
    expect(agent.generateReply).not.toHaveBeenCalled();
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "image",
        transcriptionStatus: "failed",
        transcriptionError: "rate_limit",
      }),
    );
  });

  test("timeout no vision → fallback de imagem", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback-3" })),
    };
    const agent = { generateReply: vi.fn() };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: makeDownloader(),
      audioTranscriber: stubTranscriber,
      imageDescriber: makeImageDescriber({ status: "timeout" }),
    });

    const response = await handlers.POST(
      signedRequest(imagePayload("img-5"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(agent.generateReply).not.toHaveBeenCalled();
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ transcriptionStatus: "timeout" }),
    );
  });
});
