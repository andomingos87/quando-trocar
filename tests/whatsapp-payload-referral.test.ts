import { describe, expect, test } from "vitest";

import { extractInboundMessages } from "@/lib/whatsapp/payload";

function textPayloadWithReferral(referral?: Record<string, unknown>) {
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
              contacts: [{ profile: { name: "Lead" }, wa_id: "5541999990000" }],
              messages: [
                {
                  from: "5541999990000",
                  id: "wamid.referral-1",
                  timestamp: "1714070400",
                  type: "text",
                  text: { body: "Oi, vi o anuncio" },
                  ...(referral ? { referral } : {}),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("payload — atribuição de anúncio (referral / ctwa_clid)", () => {
  test("mensagem originada de clique em anúncio -> referral normalizado", () => {
    const messages = extractInboundMessages(
      textPayloadWithReferral({
        source_id: "120210000000000",
        source_type: "ad",
        source_url: "https://fb.me/example",
        headline: "Quando Trocar - teste grátis",
        body: "Anúncio",
        media_type: "image",
        ctwa_clid: "AffQ...clid",
      }),
    );

    expect(messages[0].referral).toEqual({
      ctwaClid: "AffQ...clid",
      sourceId: "120210000000000",
      sourceType: "ad",
      sourceUrl: "https://fb.me/example",
      headline: "Quando Trocar - teste grátis",
    });
  });

  test("mensagem direta (sem clique em anúncio) -> referral null", () => {
    const messages = extractInboundMessages(textPayloadWithReferral());

    expect(messages[0].referral).toBeNull();
  });

  test("referral vazio/malformado (sem ctwa_clid nem source_id) -> null, não quebra", () => {
    const messages = extractInboundMessages(textPayloadWithReferral({ headline: "sem ids" }));

    expect(messages[0].referral).toBeNull();
  });
});
