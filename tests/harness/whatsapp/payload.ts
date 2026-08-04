// Construção e assinatura do payload inbound da Meta.
//
// O handler não tem bypass de assinatura (webhook-handler.ts:940-955): sem
// `WHATSAPP_APP_SECRET` devolve 500, com header inválido devolve 401. O
// harness assina de verdade com um segredo local — mesmo caminho de produção.

import { createHmac } from "node:crypto";

import type { InboundMediaType } from "@/lib/whatsapp/types";

export const HARNESS_APP_SECRET = "harness-app-secret";
export const HARNESS_VERIFY_TOKEN = "harness-verify-token";

export type InboundPayloadInput = {
  from: string;
  body: string;
  messageId: string;
  contactName?: string | null;
  mediaType?: InboundMediaType;
  mediaId?: string | null;
  contextWhatsappMessageId?: string | null;
  buttonReplyId?: string;
  timestamp?: string;
};

function messageForMediaType(input: InboundPayloadInput): Record<string, unknown> {
  const mediaType = input.mediaType ?? "text";

  if (input.buttonReplyId) {
    return {
      type: "interactive",
      interactive: {
        type: "button_reply",
        button_reply: { id: input.buttonReplyId, title: input.body },
      },
    };
  }

  switch (mediaType) {
    case "audio":
      return { type: "audio", audio: { id: input.mediaId ?? "media-audio-1", mime_type: "audio/ogg" } };
    case "image":
      return {
        type: "image",
        image: { id: input.mediaId ?? "media-image-1", mime_type: "image/jpeg", caption: input.body },
      };
    case "document":
      return {
        type: "document",
        document: {
          id: input.mediaId ?? "media-doc-1",
          mime_type: "application/pdf",
          filename: "documento.pdf",
          caption: input.body,
        },
      };
    case "sticker":
      return { type: "sticker", sticker: { id: "media-sticker-1" } };
    case "video":
      return { type: "video", video: { id: "media-video-1" } };
    case "location":
      return { type: "location", location: { latitude: -23.5, longitude: -46.6 } };
    case "contacts":
      return { type: "contacts", contacts: [{ name: { formatted_name: "Contato" } }] };
    default:
      return { type: "text", text: { body: input.body } };
  }
}

export function buildInboundPayload(input: InboundPayloadInput) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "harness-business-id",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "5511999990000",
                phone_number_id: "harness-phone-id",
              },
              contacts: [
                {
                  profile: { name: input.contactName ?? "Participante Teste" },
                  wa_id: input.from,
                },
              ],
              messages: [
                {
                  from: input.from,
                  id: input.messageId,
                  timestamp: input.timestamp ?? "1714070400",
                  ...(input.contextWhatsappMessageId
                    ? { context: { id: input.contextWhatsappMessageId } }
                    : {}),
                  ...messageForMediaType(input),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function signedRequest(payload: unknown, secret: string = HARNESS_APP_SECRET): Request {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
  return new Request("https://harness.local/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
    body: rawBody,
  });
}
