import { describe, expect, it } from "vitest";

import { validateFaqInput } from "@/lib/admin/faq";

describe("validateFaqInput", () => {
  it("accepts a fully valid input", () => {
    expect(
      validateFaqInput({
        pergunta: "Quanto custa?",
        resposta: "Parte de R$ 59 chefe.",
        palavras_chave: ["preco", "custa"],
        ativo: true,
        ordem: 10,
      }),
    ).toBeNull();
  });

  it("rejects empty pergunta", () => {
    expect(
      validateFaqInput({
        pergunta: "",
        resposta: "x",
        palavras_chave: ["a"],
      }),
    ).toMatchObject({ field: "pergunta" });
  });

  it("rejects pergunta longer than 200 chars", () => {
    expect(
      validateFaqInput({
        pergunta: "a".repeat(201),
        resposta: "x",
        palavras_chave: ["a"],
      }),
    ).toMatchObject({ field: "pergunta" });
  });

  it("rejects empty resposta", () => {
    expect(
      validateFaqInput({
        pergunta: "x",
        resposta: "",
        palavras_chave: ["a"],
      }),
    ).toMatchObject({ field: "resposta" });
  });

  it("rejects resposta longer than 1000 chars", () => {
    expect(
      validateFaqInput({
        pergunta: "x",
        resposta: "a".repeat(1001),
        palavras_chave: ["a"],
      }),
    ).toMatchObject({ field: "resposta" });
  });

  it("rejects empty palavras_chave list", () => {
    expect(
      validateFaqInput({
        pergunta: "x",
        resposta: "y",
        palavras_chave: [],
      }),
    ).toMatchObject({ field: "palavras_chave" });
  });

  it("rejects palavras_chave with blank entries", () => {
    expect(
      validateFaqInput({
        pergunta: "x",
        resposta: "y",
        palavras_chave: ["ok", "  "],
      }),
    ).toMatchObject({ field: "palavras_chave" });
  });

  it("rejects negative ordem", () => {
    expect(
      validateFaqInput({
        pergunta: "x",
        resposta: "y",
        palavras_chave: ["a"],
        ordem: -1,
      }),
    ).toMatchObject({ field: "ordem" });
  });

  it("partial: ignores absent fields", () => {
    expect(validateFaqInput({ ativo: false }, { isPartial: true })).toBeNull();
  });

  it("partial: still validates fields when present", () => {
    expect(
      validateFaqInput({ palavras_chave: [] }, { isPartial: true }),
    ).toMatchObject({ field: "palavras_chave" });
  });
});
