import { describe, expect, it } from "vitest";

import { calcMrrFromRows } from "@/lib/admin/metrics";

describe("calcMrrFromRows", () => {
  it("uses preco_negociado when present", () => {
    const v = calcMrrFromRows([
      { status: "ativa", preco_negociado: 50, preco_base: 100 },
    ]);
    expect(v).toBe(50);
  });

  it("falls back to preco_base when preco_negociado is null", () => {
    const v = calcMrrFromRows([
      { status: "ativa", preco_negociado: null, preco_base: 100 },
    ]);
    expect(v).toBe(100);
  });

  it("skips non-ativa", () => {
    const v = calcMrrFromRows([
      { status: "pausada", preco_negociado: 50, preco_base: 100 },
      { status: "cancelada", preco_negociado: 50, preco_base: 100 },
      { status: "ativa", preco_negociado: 25, preco_base: 100 },
    ]);
    expect(v).toBe(25);
  });

  it("sums correctly with mixed rows", () => {
    const v = calcMrrFromRows([
      { status: "ativa", preco_negociado: 90, preco_base: 100 },
      { status: "ativa", preco_negociado: null, preco_base: 120 },
      { status: "ativa", preco_negociado: 0, preco_base: 100 },
    ]);
    expect(v).toBe(90 + 120 + 0);
  });

  it("handles empty array", () => {
    expect(calcMrrFromRows([])).toBe(0);
  });
});
