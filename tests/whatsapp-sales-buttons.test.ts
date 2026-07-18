import { describe, expect, test } from "vitest";

import {
  SALES_FALLBACK_BUTTONS,
  SALES_FALLBACK_BUTTONS_BODY,
  resolveSalesButtonReplyId,
} from "@/lib/whatsapp/sales-buttons";
import { classifySalesMessage } from "@/lib/whatsapp/sales-agent";

describe("sales-buttons — registro", () => {
  test("no maximo 3 botoes (limite da Cloud API)", () => {
    expect(SALES_FALLBACK_BUTTONS.length).toBeLessThanOrEqual(3);
    expect(SALES_FALLBACK_BUTTONS.length).toBeGreaterThan(0);
  });

  test("titulos cabem no limite de 20 chars e ids sao unicos", () => {
    const ids = new Set<string>();
    for (const button of SALES_FALLBACK_BUTTONS) {
      expect(button.title.length).toBeLessThanOrEqual(20);
      expect(button.id.length).toBeLessThanOrEqual(256);
      ids.add(button.id);
    }
    expect(ids.size).toBe(SALES_FALLBACK_BUTTONS.length);
  });

  test("body de acompanhamento existe", () => {
    expect(SALES_FALLBACK_BUTTONS_BODY.length).toBeGreaterThan(0);
  });
});

describe("resolveSalesButtonReplyId", () => {
  test("id conhecido -> mensagem canonica", () => {
    expect(resolveSalesButtonReplyId("sales_fb_funcionamento")).toBe("como funciona");
    expect(resolveSalesButtonReplyId("sales_fb_preco")).toBe("quanto custa");
    expect(resolveSalesButtonReplyId("sales_fb_testar")).toBe("quero testar");
  });

  test("id desconhecido/nulo -> null", () => {
    expect(resolveSalesButtonReplyId("outra_coisa")).toBeNull();
    expect(resolveSalesButtonReplyId(null)).toBeNull();
    expect(resolveSalesButtonReplyId(undefined)).toBeNull();
    expect(resolveSalesButtonReplyId("")).toBeNull();
  });

  // "id deterministico -> intent direto, sem LLM": a mensagem canonica de cada
  // botao classifica de forma deterministica com confidence >= 0.85, entao nunca
  // cai no classificador OpenAI.
  test("cada botao mapeia para o intent esperado sem depender de LLM", () => {
    const expected: Record<string, string> = {
      sales_fb_funcionamento: "pergunta_funcionamento",
      sales_fb_preco: "pergunta_preco",
      sales_fb_testar: "quer_testar",
    };
    for (const button of SALES_FALLBACK_BUTTONS) {
      const canonical = resolveSalesButtonReplyId(button.id);
      expect(canonical).not.toBeNull();
      const classification = classifySalesMessage(canonical as string);
      expect(classification.intent).toBe(expected[button.id]);
      expect(classification.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });
});
