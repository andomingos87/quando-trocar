import { describe, expect, it } from "vitest";

import { validatePlanoInput } from "@/lib/admin/planos";

describe("validatePlanoInput", () => {
  it("accepts a fully valid input", () => {
    expect(
      validatePlanoInput({
        nome: "Quando Trocar Mensal",
        preco_base: 89.9,
        descricao: "ok",
        ativo: true,
      }),
    ).toBeNull();
  });

  it("rejects empty nome", () => {
    expect(
      validatePlanoInput({ nome: "", preco_base: 0 }),
    ).toMatchObject({ field: "nome" });
    expect(
      validatePlanoInput({ nome: "   ", preco_base: 0 }),
    ).toMatchObject({ field: "nome" });
  });

  it("rejects nome longer than 120 chars", () => {
    expect(
      validatePlanoInput({ nome: "a".repeat(121), preco_base: 0 }),
    ).toMatchObject({ field: "nome" });
  });

  it("rejects negative preco_base", () => {
    expect(
      validatePlanoInput({ nome: "x", preco_base: -1 }),
    ).toMatchObject({ field: "preco_base" });
  });

  it("rejects NaN preco_base", () => {
    expect(
      validatePlanoInput({ nome: "x", preco_base: Number.NaN }),
    ).toMatchObject({ field: "preco_base" });
  });

  it("partial: ignores absent fields", () => {
    expect(
      validatePlanoInput({ descricao: "patch" }, { isPartial: true }),
    ).toBeNull();
  });

  it("partial: still validates fields when present", () => {
    expect(
      validatePlanoInput({ preco_base: -5 }, { isPartial: true }),
    ).toMatchObject({ field: "preco_base" });
  });
});
