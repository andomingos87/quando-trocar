import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import {
  createWhatsappWebhookHandlers,
  type AudioTranscriber,
  type DocumentExtractor,
  type ImageDescriber,
  type MediaDownloader,
} from "@/lib/whatsapp/webhook-handler";
import type { DocumentExtractionResult } from "@/lib/whatsapp/document-text";

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

function documentPayload(mediaId = "doc-1", caption: string | null = null) {
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
                  id: `wamid.doc-${mediaId}`,
                  timestamp: "1714070400",
                  type: "document",
                  document: {
                    id: mediaId,
                    mime_type: "application/pdf",
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
      url: "https://lookaside.fbsbx.com/whatsapp/document.pdf",
      mimeType: "application/pdf",
    })),
    downloadMedia: vi.fn(async () => Buffer.from("fake-pdf-bytes")),
  };
}

function makeDocumentExtractor(result: DocumentExtractionResult): DocumentExtractor & {
  extract: ReturnType<typeof vi.fn>;
} {
  return {
    extract: vi.fn(async () => result),
  };
}

const env = {
  WHATSAPP_VERIFY_TOKEN: "verify-token",
  WHATSAPP_APP_SECRET: "app-secret",
};

const stubTranscriber: AudioTranscriber = { transcribe: vi.fn() };
const stubImageDescriber: ImageDescriber = { describe: vi.fn() };

describe("whatsapp webhook — fluxo de documento PDF (ADR-0016)", () => {
  test("sucesso → agente recebe body '[documento] ...'", async () => {
    const repository = baseRepository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Recebi o orçamento, vou olhar",
        status: "em_conversa" as const,
        toolCalls: [],
      })),
    };
    const documentExtractor = makeDocumentExtractor({
      status: "success",
      text: "Orcamento troca de oleo Civic 2018 R$ 320,00 - oficina Quando Trocar",
      durationMs: 200,
      pageCount: 1,
    });

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
      mediaDownloader: makeDownloader(),
      audioTranscriber: stubTranscriber,
      imageDescriber: stubImageDescriber,
      documentExtractor,
    });

    const response = await handlers.POST(
      signedRequest(documentPayload("doc-1", "olha o orçamento"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(documentExtractor.extract).toHaveBeenCalled();
    expect(agent.generateReply).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("[documento]"),
      }),
    );
    const passedMessage = (agent.generateReply.mock.calls[0] as unknown as [{ message: string }])[0]
      .message;
    expect(passedMessage).toContain("R$ 320,00");
    expect(passedMessage).toContain("olha o orçamento");
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "document",
        mediaId: "doc-1",
        transcriptionStatus: "success",
      }),
    );
  });

  test("empty (PDF escaneado / sem texto útil) → fallback de documento e não chama agente", async () => {
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
      imageDescriber: stubImageDescriber,
      documentExtractor: makeDocumentExtractor({
        status: "empty",
        durationMs: 100,
        pageCount: 1,
      }),
    });

    const response = await handlers.POST(
      signedRequest(documentPayload("doc-2"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(agent.generateReply).not.toHaveBeenCalled();
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "document",
        transcriptionStatus: "empty",
      }),
    );
    const call = (whatsapp.sendTextMessage.mock.calls[0] as unknown as [{ body: string }])[0];
    expect(call.body.toLowerCase()).toContain("texto");
  });

  test("failed (não-PDF / parse erro) → fallback de documento", async () => {
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
      imageDescriber: stubImageDescriber,
      documentExtractor: makeDocumentExtractor({
        status: "failed",
        error: "unsupported_mime",
      }),
    });

    const response = await handlers.POST(
      signedRequest(documentPayload("doc-3"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(agent.generateReply).not.toHaveBeenCalled();
    expect(repository.saveInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "document",
        transcriptionStatus: "failed",
        transcriptionError: "unsupported_mime",
      }),
    );
  });
});
