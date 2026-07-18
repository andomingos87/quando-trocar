import { describe, expect, test } from "vitest";

import { extractInboundMessages } from "@/lib/whatsapp/payload";

function interactivePayload(interactive: Record<string, unknown>) {
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
                  id: "wamid.interactive-1",
                  timestamp: "1714070400",
                  type: "interactive",
                  interactive,
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("payload — resposta interativa (button_reply)", () => {
  test("id de botao conhecido -> mensagem canonica deterministica (nao o titulo)", () => {
    const messages = extractInboundMessages(
      interactivePayload({
        type: "button_reply",
        // titulo diferente da mensagem canonica de proposito: provamos que o id
        // manda, nao o texto do titulo.
        button_reply: { id: "sales_fb_preco", title: "Quanto custa" },
      }),
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ body: "quanto custa", mediaType: "text" });
  });

  test("id de botao desconhecido -> cai no titulo", () => {
    const messages = extractInboundMessages(
      interactivePayload({
        type: "button_reply",
        button_reply: { id: "algum_id_externo", title: "Outra opcao" },
      }),
    );

    expect(messages[0]).toMatchObject({ body: "Outra opcao", mediaType: "text" });
  });

  test("list_reply continua usando o titulo", () => {
    const messages = extractInboundMessages(
      interactivePayload({
        type: "list_reply",
        list_reply: { id: "row_1", title: "Revisao", description: "..." },
      }),
    );

    expect(messages[0]).toMatchObject({ body: "Revisao", mediaType: "text" });
  });

  test("interativo sem titulo nem id conhecido -> unsupported (nao fica mudo)", () => {
    const messages = extractInboundMessages(
      interactivePayload({ type: "button_reply", button_reply: {} }),
    );

    expect(messages[0]).toMatchObject({ mediaType: "unsupported" });
  });
});
