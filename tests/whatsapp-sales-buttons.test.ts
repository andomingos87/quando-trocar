import { describe, expect, test } from "vitest";

import {
  ONBOARDING_CONFIRM_BUTTONS,
  SALES_EXPLAINER_BUTTONS,
  SALES_FALLBACK_BUTTONS,
  SALES_FALLBACK_BUTTONS_BODY,
  SALES_PRICE_BUTTONS,
  resolveButtonReplyId,
} from "@/lib/whatsapp/sales-buttons";
import { classifySalesMessage } from "@/lib/whatsapp/sales-agent";

const ALL_SETS: Array<[string, ReadonlyArray<{ id: string; title: string }>]> = [
  ["fallback", SALES_FALLBACK_BUTTONS],
  ["explainer", SALES_EXPLAINER_BUTTONS],
  ["price", SALES_PRICE_BUTTONS],
  ["onboarding-confirm", ONBOARDING_CONFIRM_BUTTONS],
];

describe("sales-buttons — registro", () => {
  test("todo conjunto respeita o maximo de 3 botoes (limite da Cloud API)", () => {
    for (const [name, set] of ALL_SETS) {
      expect(set.length, name).toBeLessThanOrEqual(3);
      expect(set.length, name).toBeGreaterThan(0);
    }
  });

  test("titulos cabem no limite de 20 chars e ids sao unicos dentro do conjunto", () => {
    for (const [name, set] of ALL_SETS) {
      const ids = new Set<string>();
      for (const button of set) {
        expect(button.title.length, `${name}:${button.id}`).toBeLessThanOrEqual(20);
        expect(button.id.length, `${name}:${button.id}`).toBeLessThanOrEqual(256);
        ids.add(button.id);
      }
      expect(ids.size, name).toBe(set.length);
    }
  });

  test("todo id de botao resolve para uma mensagem canonica", () => {
    for (const [name, set] of ALL_SETS) {
      for (const button of set) {
        expect(resolveButtonReplyId(button.id), `${name}:${button.id}`).not.toBeNull();
      }
    }
  });

  test("body de acompanhamento existe", () => {
    expect(SALES_FALLBACK_BUTTONS_BODY.length).toBeGreaterThan(0);
  });
});

describe("resolveButtonReplyId", () => {
  test("id conhecido -> mensagem canonica", () => {
    expect(resolveButtonReplyId("sales_fb_funcionamento")).toBe("como funciona");
    expect(resolveButtonReplyId("sales_fb_preco")).toBe("quanto custa");
    expect(resolveButtonReplyId("sales_fb_testar")).toBe("quero testar");
    expect(resolveButtonReplyId("sales_fb_humano")).toBe("quero falar com humano");
    expect(resolveButtonReplyId("onb_confirmar")).toBe("confirmar");
    expect(resolveButtonReplyId("onb_corrigir")).toBe("corrigir");
  });

  test("id desconhecido/nulo -> null", () => {
    expect(resolveButtonReplyId("outra_coisa")).toBeNull();
    expect(resolveButtonReplyId(null)).toBeNull();
    expect(resolveButtonReplyId(undefined)).toBeNull();
    expect(resolveButtonReplyId("")).toBeNull();
  });

  // "id deterministico -> intent direto, sem LLM": a mensagem canonica de cada
  // botao de VENDAS classifica de forma deterministica com confidence >= 0.85,
  // entao nunca cai no classificador OpenAI. (Os ids onb_* sao tratados pelo
  // fluxo de confirmacao do onboarding — coberto em whatsapp-onboarding-agent.)
  test("cada botao de vendas mapeia para o intent esperado sem depender de LLM", () => {
    const expected: Record<string, string> = {
      sales_fb_funcionamento: "pergunta_funcionamento",
      sales_fb_preco: "pergunta_preco",
      sales_fb_testar: "quer_testar",
      sales_fb_humano: "quer_humano",
    };
    const salesButtons = [
      ...SALES_FALLBACK_BUTTONS,
      ...SALES_EXPLAINER_BUTTONS,
      ...SALES_PRICE_BUTTONS,
    ];
    for (const button of salesButtons) {
      const canonical = resolveButtonReplyId(button.id);
      expect(canonical, button.id).not.toBeNull();
      const classification = classifySalesMessage(canonical as string);
      expect(classification.intent, button.id).toBe(expected[button.id]);
      expect(classification.confidence, button.id).toBeGreaterThanOrEqual(0.85);
    }
  });
});
