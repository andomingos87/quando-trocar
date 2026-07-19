import { describe, expect, test } from "vitest";

import { extractPhoneQualityEvents } from "@/lib/whatsapp/payload";

describe("extractPhoneQualityEvents (CV7)", () => {
  test("extrai quality_rating do webhook phone_number_quality_update", () => {
    const payload = {
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "phone_number_quality_update",
              value: {
                display_phone_number: "+5511999998888",
                event: "FLAGGED",
                current_limit: "TIER_1K",
                quality_rating: "RED",
              },
            },
          ],
        },
      ],
    };
    expect(extractPhoneQualityEvents(payload)).toEqual([
      {
        displayPhoneNumber: "+5511999998888",
        event: "FLAGGED",
        currentLimit: "TIER_1K",
        qualityRating: "RED",
        raw: expect.any(Object),
      },
    ]);
  });

  test("ignora mudanças que não são de qualidade (ex.: mensagens)", () => {
    const payload = {
      entry: [
        {
          changes: [
            { field: "messages", value: { messages: [{ id: "wamid.1" }] } },
          ],
        },
      ],
    };
    expect(extractPhoneQualityEvents(payload)).toEqual([]);
  });

  test("payload sem sinal de qualidade não gera evento", () => {
    const payload = {
      entry: [
        {
          changes: [
            { field: "phone_number_quality_update", value: { display_phone_number: "+55119" } },
          ],
        },
      ],
    };
    expect(extractPhoneQualityEvents(payload)).toEqual([]);
  });
});
