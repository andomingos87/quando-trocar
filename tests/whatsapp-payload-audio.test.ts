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

describe("extractInboundMessages — texto e áudio (ADR-0015)", () => {
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

  test("audio sem audio.id (malformado) → mediaType=unsupported (fallback ao invés de silêncio)", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.audio-bad",
        type: "audio",
        audio: { mime_type: "audio/ogg" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].mediaType).toBe("unsupported");
  });
});

describe("extractInboundMessages — mídia adicional (F0 fallback / ADR-0016)", () => {
  test("emite mediaType=image com mediaId", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.image-1",
        type: "image",
        image: { id: "image-id", mime_type: "image/jpeg" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      mediaType: "image",
      mediaId: "image-id",
      body: "",
    });
  });

  test("emite mediaType=document com mediaId", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.doc-1",
        type: "document",
        document: { id: "doc-id", mime_type: "application/pdf" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      mediaType: "document",
      mediaId: "doc-id",
      body: "",
    });
  });

  test("emite mediaType=sticker", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.sticker-1",
        type: "sticker",
        sticker: { id: "sticker-id" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      mediaType: "sticker",
      body: "",
    });
  });

  test("emite mediaType=video", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.video-1",
        type: "video",
        video: { id: "video-id", mime_type: "video/mp4" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].mediaType).toBe("video");
  });

  test("emite mediaType=location sem mediaId", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.loc-1",
        type: "location",
        location: { latitude: -25.4, longitude: -49.2 },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      mediaType: "location",
      mediaId: null,
      body: "",
    });
  });

  test("emite mediaType=contacts", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.contacts-1",
        type: "contacts",
        contacts: [{ name: { formatted_name: "Alguém" } }],
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].mediaType).toBe("contacts");
  });

  test("emite mediaType=unsupported para tipo desconhecido", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.unknown-1",
        type: "reaction",
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].mediaType).toBe("unsupported");
  });

  test("sticker sem sticker.id (malformado) → mediaType=unsupported", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.sticker-bad",
        type: "sticker",
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].mediaType).toBe("unsupported");
  });
});

describe("extractInboundMessages — botões de template / interactive (2a)", () => {
  test("type=button (quick-reply de template) → mediaType=text com o texto do botão", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.button-1",
        timestamp: "1714070400",
        type: "button",
        context: { id: "wamid.confirmacao-original" },
        button: { text: "Chamar no WhatsApp", payload: "chamar_whatsapp" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      mediaType: "text",
      body: "Chamar no WhatsApp",
      contextWhatsappMessageId: "wamid.confirmacao-original",
    });
    expect(messages[0].mediaId).toBeUndefined();
  });

  test("type=interactive button_reply → mediaType=text com o título escolhido", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.interactive-1",
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: "btn-1", title: "Confirmar" },
        },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ mediaType: "text", body: "Confirmar" });
  });

  test("type=interactive list_reply → mediaType=text com o título da opção", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.interactive-2",
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: { id: "opt-1", title: "Reagendar", description: "Mudar a data" },
        },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ mediaType: "text", body: "Reagendar" });
  });

  test("button sem texto (malformado) → mediaType=unsupported", () => {
    const messages = extractInboundMessages(
      payloadWithMessage({
        from: "5541999999999",
        id: "wamid.button-bad",
        type: "button",
        button: { payload: "sem_texto" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].mediaType).toBe("unsupported");
  });
});
