import { describe, expect, it } from "vitest";

import {
  normalizeClienteNome,
  normalizeServico,
  normalizeVeiculo,
} from "@/lib/admin/normalize";

describe("normalizeClienteNome", () => {
  it("strips LLM framing prefixes", () => {
    expect(normalizeClienteNome("Quero cadastrar o cliente Luca Marcilli")).toBe(
      "Luca Marcilli",
    );
  });

  it("removes trailing punctuation and title-cases", () => {
    expect(normalizeClienteNome("Lara Marsili.")).toBe("Lara Marsili");
    expect(normalizeClienteNome("Flaviane marsili")).toBe("Flaviane Marsili");
  });

  it("returns null for empty input", () => {
    expect(normalizeClienteNome("")).toBeNull();
    expect(normalizeClienteNome(null)).toBeNull();
  });
});

describe("normalizeVeiculo", () => {
  it("extracts and keeps the year", () => {
    expect(normalizeVeiculo("logan 2016")).toBe("Logan 2016");
    expect(normalizeVeiculo("coballt 2020")).toBe("Coballt 2020");
  });

  it("strips framing words and title-cases", () => {
    expect(normalizeVeiculo("tem um Peugeot 208")).toBe("Peugeot 208");
    expect(normalizeVeiculo("Hunday creta")).toBe("Hunday Creta");
  });

  it("returns null for empty input", () => {
    expect(normalizeVeiculo("")).toBeNull();
    expect(normalizeVeiculo(null)).toBeNull();
  });
});

describe("normalizeServico", () => {
  it("classifies into canonical labels by keyword", () => {
    expect(
      normalizeServico("troca de oleo da marca mobil, data 20 de maio de 2026 e"),
    ).toBe("Troca de óleo");
    expect(normalizeServico("foi troca de óleo e o telefone dele é .")).toBe(
      "Troca de óleo",
    );
    expect(normalizeServico("amortecedor Perfect")).toBe("Amortecedor");
    expect(normalizeServico("troca de amortecedor")).toBe("Amortecedor");
    expect(normalizeServico("revisão completa")).toBe("Revisão");
  });

  it("falls back to title-case when no keyword matches", () => {
    expect(normalizeServico("alinhamento e balanceamento")).toBe(
      "Alinhamento e Balanceamento",
    );
  });

  it("returns null for empty input", () => {
    expect(normalizeServico("")).toBeNull();
    expect(normalizeServico(null)).toBeNull();
  });
});
