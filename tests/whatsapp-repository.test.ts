import { describe, expect, test } from "vitest";

import { mergeLeadForInbound } from "@/lib/whatsapp/repository";

describe("whatsapp repository helpers", () => {
  test("preserves origin and status for an existing lead on follow-up inbound messages", () => {
    expect(
      mergeLeadForInbound(
        {
          nome: "Anderson",
          origem: "landing_page",
          status: "interessado",
        },
        {
          nome: "Anderson",
          origem: "manual_whatsapp",
          status: "em_conversa",
        },
      ),
    ).toEqual({
      nome: "Anderson",
      origem: "landing_page",
      status: "interessado",
    });
  });
});
