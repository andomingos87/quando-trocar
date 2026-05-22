import { describe, expect, test } from "vitest";

import { extractInboundMessages } from "@/lib/whatsapp/payload";

function payloadWithMessage(message: Record<string, unknown>) {
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
                  profile: { name: "Cliente Teste" },
                  wa_id: "5541999999999",
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

describe("extractInboundMessages — áudio", () => {
  test("aceita type=audio e extrai mediaId", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.audio-1",
        timestamp: "1714070400",
        type: "audio",
        audio: { id: "media-id-123", mime_type: "audio/ogg; codecs=opus", voice: true },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      whatsappMessageId: "wamid.audio-1",
      mediaType: "audio",
      mediaId: "media-id-123",
      body: "",
      contactName: "Cliente Teste",
    });
  });

  test("mantém type=text funcionando com mediaType=text", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.text-1",
        timestamp: "1714070400",
        type: "text",
        text: { body: "olá" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      mediaType: "text",
      body: "olá",
    });
    expect(messages[0].mediaId).toBeUndefined();
  });

  test("descarta type=image", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.image-1",
        timestamp: "1714070400",
        type: "image",
        image: { id: "image-id" },
      }),
    );

    expect(messages).toHaveLength(0);
  });

  test("descarta type=document", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.doc-1",
        type: "document",
        document: { id: "doc-id" },
      }),
    );

    expect(messages).toHaveLength(0);
  });

  test("descarta type=sticker", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.sticker-1",
        type: "sticker",
        sticker: { id: "sticker-id" },
      }),
    );

    expect(messages).toHaveLength(0);
  });

  test("descarta audio sem audio.id (malformado)", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.audio-bad",
        type: "audio",
        audio: { mime_type: "audio/ogg" },
      }),
    );

    expect(messages).toHaveLength(0);
  });
});
