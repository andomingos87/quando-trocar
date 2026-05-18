import { describe, expect, it } from "vitest";

import { avancarVencimentoMensal, precoEfetivo } from "@/lib/admin/billing";
import { mapMpStatus } from "@/lib/mercado-pago/client";

describe("precoEfetivo", () => {
  it("uses preco_negociado when present", () => {
    expect(precoEfetivo({ preco_negociado: 50, preco_base: 100 })).toBe(50);
  });
  it("falls back to preco_base", () => {
    expect(precoEfetivo({ preco_negociado: null, preco_base: 100 })).toBe(100);
  });
  it("returns 0 when both null", () => {
    expect(precoEfetivo({ preco_negociado: null, preco_base: null })).toBe(0);
  });
  it("respects 0 negociado over base (intentional override)", () => {
    expect(precoEfetivo({ preco_negociado: 0, preco_base: 100 })).toBe(0);
  });
});

describe("mapMpStatus", () => {
  it("maps approved → pago", () => {
    expect(mapMpStatus("approved")).toBe("pago");
  });
  it("maps rejected → falhou", () => {
    expect(mapMpStatus("rejected")).toBe("falhou");
  });
  it("maps cancelled/refunded → cancelado", () => {
    expect(mapMpStatus("cancelled")).toBe("cancelado");
    expect(mapMpStatus("refunded")).toBe("cancelado");
  });
  it("defaults pending statuses to pendente", () => {
    expect(mapMpStatus("pending")).toBe("pendente");
    expect(mapMpStatus("in_process")).toBe("pendente");
    expect(mapMpStatus("authorized")).toBe("pendente");
  });
});

describe("avancarVencimentoMensal", () => {
  it("avanca 1 mes a partir de uma data ISO", () => {
    expect(avancarVencimentoMensal("2026-01-15")).toBe("2026-02-15");
  });
  it("vira o ano em dezembro", () => {
    expect(avancarVencimentoMensal("2026-12-31")).toBe("2027-01-31");
  });
  it("usa now quando current is null", () => {
    const now = new Date("2026-05-17T00:00:00Z");
    expect(avancarVencimentoMensal(null, now)).toBe("2026-06-17");
  });
});
