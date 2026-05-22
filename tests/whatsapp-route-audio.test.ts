import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import {
  createWhatsappWebhookHandlers,
  type AudioTranscriber,
  type MediaDownloader,
} from "@/lib/whatsapp/webhook-handler";
import type { TranscriptionResult } from "@/lib/whatsapp/transcription";

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

function audioPayload(mediaId = "media-id-1") {
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
                  id: "wamid.audio-1",
                  timestamp: "1714070400",
                  type: "audio",
                  audio: { id: mediaId, mime_type: "audio/ogg; codecs=opus", voice: true },
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
      url: "https://lookaside.fbsbx.com/whatsapp/audio.ogg",
      mimeType: "audio/ogg",
    })),
    downloadMedia: vi.fn(async () => Buffer.from("ogg-bytes")),
  };
}

function makeTranscriber(result: TranscriptionResult): AudioTranscriber & {
  transcribe: ReturnType<typeof vi.fn>;
} {
  return {
    transcribe: vi.fn(async () => result),
  };
}

const env = {
  WHATSAPP_VERIFY_TOKEN: "verify-token",
  WHATSAPP_APP_SECRET: "app-secret",
};

describe("whatsapp webhook — fluxo de áudio", () => {
  test("transcrição com sucesso → agente vendas recebe transcrição como body", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Beleza, te explico tudo. Quantas trocas você faz por mês?",
        status: "em_conversa" as const,
        toolCalls: [],
      })),
    };
    const mediaDownloader = makeDownloader();
    const audioTranscriber = makeTranscriber({
      status: "success",
      text: "Oi, quero saber como funciona",
      durationMs: 1234,
    });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader,
      audioTranscriber,
    });

    const response = await handlers.POST(signedRequest(audioPayload(), env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(mediaDownloader.getMediaMetadata).toHaveBeenCalledWith("media-id-1");
    expect(mediaDownloader.downloadMedia).toHaveBeenCalled();
    expect(audioTranscriber.transcribe).toHaveBeenCalled();
    expect(agent.generateReply).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Oi, quero saber como funciona" }),
    );
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "audio",
        mediaId: "media-id-1",
        transcription: "Oi, quero saber como funciona",
        transcriptionStatus: "success",
        audioDurationMs: 1234,
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Quantas trocas"),
      }),
    );
  });

  test("transcrição falhada → envia fallback contextual de vendas e não chama agente", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback-1" })),
    };
    const agent = { generateReply: vi.fn() };
    const mediaDownloader = makeDownloader();
    const audioTranscriber = makeTranscriber({ status: "failed", error: "openai_500" });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader,
      audioTranscriber,
    });

    const response = await handlers.POST(signedRequest(audioPayload(), env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(agent.generateReply).not.toHaveBeenCalled();
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "audio",
        transcriptionStatus: "failed",
        transcriptionError: "openai_500",
        body: "",
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/áudio|texto/i),
      }),
    );
  });

  test("transcrição timeout → envia fallback de timeout, sem chamar agente", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback-2" })),
    };
    const audioTranscriber = makeTranscriber({ status: "timeout" });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      mediaDownloader: makeDownloader(),
      audioTranscriber,
    });

    const response = await handlers.POST(signedRequest(audioPayload(), env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ transcriptionStatus: "timeout" }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringMatching(/longo|texto/i) }),
    );
  });

  test("transcrição vazia → envia fallback de empty", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback-3" })),
    };
    const audioTranscriber = makeTranscriber({ status: "empty", durationMs: 800 });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      mediaDownloader: makeDownloader(),
      audioTranscriber,
    });

    const response = await handlers.POST(signedRequest(audioPayload(), env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        transcriptionStatus: "empty",
        audioDurationMs: 800,
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringMatching(/silêncio|texto/i) }),
    );
  });

  test("falha no download da mídia → transcriptionStatus failed com erro", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.fallback-4" })),
    };
    const mediaDownloader: MediaDownloader = {
      getMediaMetadata: vi.fn(async () => {
        throw new Error("meta_token_expired");
      }),
      downloadMedia: vi.fn(),
    };
    const audioTranscriber = makeTranscriber({ status: "success", text: "x", durationMs: 1 });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      mediaDownloader,
      audioTranscriber,
    });

    const response = await handlers.POST(signedRequest(audioPayload(), env.WHATSAPP_APP_SECRET));

    expect(response.status).toBe(200);
    expect(audioTranscriber.transcribe).not.toHaveBeenCalled();
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        transcriptionStatus: "failed",
        transcriptionError: "meta_token_expired",
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalled();
  });
});
