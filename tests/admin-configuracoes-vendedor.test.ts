import { describe, expect, it } from "vitest";

import { validateConfiguracoesInput } from "@/lib/admin/configuracoes-vendedor";

describe("validateConfiguracoesInput", () => {
  it("accepts a fully valid input", () => {
    expect(
      validateConfiguracoesInput({
        taxa_recuperacao_roi: 0.15,
        whatsapp_handoff_comercial: "+5511945207618",
        frases_landing: ["oi quero testar o quando trocar"],
      }),
    ).toBeNull();
  });

  it("rejects taxa outside (0, 1)", () => {
    expect(
      validateConfiguracoesInput({ taxa_recuperacao_roi: 0 }),
    ).toMatchObject({ field: "taxa_recuperacao_roi" });
    expect(
      validateConfiguracoesInput({ taxa_recuperacao_roi: 1 }),
    ).toMatchObject({ field: "taxa_recuperacao_roi" });
    expect(
      validateConfiguracoesInput({ taxa_recuperacao_roi: -0.1 }),
    ).toMatchObject({ field: "taxa_recuperacao_roi" });
  });

  it("rejects malformed whatsapp", () => {
    expect(
      validateConfiguracoesInput({ whatsapp_handoff_comercial: "11945207618" }),
    ).toMatchObject({ field: "whatsapp_handoff_comercial" });
    expect(
      validateConfiguracoesInput({ whatsapp_handoff_comercial: "+0123" }),
    ).toMatchObject({ field: "whatsapp_handoff_comercial" });
  });

  it("accepts a valid E.164 whatsapp", () => {
    expect(
      validateConfiguracoesInput({ whatsapp_handoff_comercial: "+5511945207618" }),
    ).toBeNull();
  });

  it("rejects empty frases list", () => {
    expect(
      validateConfiguracoesInput({ frases_landing: [] }),
    ).toMatchObject({ field: "frases_landing" });
  });

  it("rejects blank frases entries", () => {
    expect(
      validateConfiguracoesInput({ frases_landing: ["ok", "  "] }),
    ).toMatchObject({ field: "frases_landing" });
  });

  it("accepts empty patch (no fields touched)", () => {
    expect(validateConfiguracoesInput({})).toBeNull();
  });
});
