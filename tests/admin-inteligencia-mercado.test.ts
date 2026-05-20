import { describe, expect, it } from "vitest";

import {
  aggregateCidades,
  aggregateCohortPerfect,
  aggregateMarketShare,
  aggregateServicosPorTipo,
  defaultRange,
  parseRangeFromSearchParams,
} from "@/lib/admin/inteligencia-mercado";

describe("aggregateServicosPorTipo", () => {
  it("retorna 4 linhas mesmo com base vazia", () => {
    const rows = aggregateServicosPorTipo([]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.total === 0)).toBe(true);
    expect(rows.every((r) => r.percentual === 0)).toBe(true);
  });

  it("agrega corretamente e calcula percentual", () => {
    const rows = aggregateServicosPorTipo([
      "troca_oleo",
      "troca_oleo",
      "amortecedor",
      "revisao",
    ]);
    const oleo = rows.find((r) => r.tipo_servico === "troca_oleo")!;
    expect(oleo.total).toBe(2);
    expect(oleo.percentual).toBeCloseTo(50, 1);
    const am = rows.find((r) => r.tipo_servico === "amortecedor")!;
    expect(am.total).toBe(1);
    expect(am.percentual).toBeCloseTo(25, 1);
  });

  it("trata tipos desconhecidos como 'outro' (defesa de schema)", () => {
    const rows = aggregateServicosPorTipo(["freio", "alinhamento", "amortecedor"]);
    const outro = rows.find((r) => r.tipo_servico === "outro")!;
    expect(outro.total).toBe(2);
  });
});

describe("aggregateMarketShare", () => {
  it("retorna 5 linhas em ordem alfabetica (cofap, monroe, nakata, outra, perfect) — anti-vies", () => {
    const rows = aggregateMarketShare(["perfect", "perfect", "cofap"]);
    expect(rows.map((r) => r.marca)).toEqual([
      "cofap",
      "monroe",
      "nakata",
      "outra",
      "perfect",
    ]);
    const perfect = rows.find((r) => r.marca === "perfect")!;
    expect(perfect.total).toBe(2);
    expect(perfect.percentual).toBeCloseTo(66.666, 1);
  });

  it("vazio retorna percentual 0 sem dividir por zero", () => {
    const rows = aggregateMarketShare([]);
    expect(rows.every((r) => r.percentual === 0)).toBe(true);
  });

  it("ignora marcas invalidas", () => {
    const rows = aggregateMarketShare(["perfect", "fake_marca", "monroe"]);
    expect(rows.find((r) => r.marca === "perfect")!.total).toBe(1);
    expect(rows.find((r) => r.marca === "monroe")!.total).toBe(1);
  });
});

describe("aggregateCidades", () => {
  it("agrupa, ordena desc por total e limita a 10", () => {
    const cidades = [
      ...Array(5).fill("Curitiba"),
      ...Array(3).fill("Sao Paulo"),
      "Rio",
      "Belo Horizonte",
      "Porto Alegre",
      "Salvador",
      "Recife",
      "Fortaleza",
      "Manaus",
      "Brasilia",
      "Goiania",
      "Vitoria",
    ];
    const rows = aggregateCidades(cidades);
    expect(rows.length).toBe(10);
    expect(rows[0]).toEqual({ cidade: "Curitiba", total: 5 });
    expect(rows[1]).toEqual({ cidade: "Sao Paulo", total: 3 });
  });
});

describe("aggregateCohortPerfect", () => {
  it("calcula share, oficinas distintas e ticket medio", () => {
    const rows = [
      { oficina_id: "of-1", marca_peca: "perfect", valor: 200 },
      { oficina_id: "of-1", marca_peca: "perfect", valor: 300 },
      { oficina_id: "of-2", marca_peca: "perfect", valor: null },
      { oficina_id: "of-3", marca_peca: "monroe", valor: 250 },
      { oficina_id: "of-4", marca_peca: null, valor: 180 },
    ];
    const cohort = aggregateCohortPerfect(rows);
    expect(cohort.total_amortecedores).toBe(5);
    expect(cohort.total_amortecedores_perfect).toBe(3);
    expect(cohort.oficinas_com_perfect).toBe(2);
    expect(cohort.share_perfect).toBeCloseTo(60, 1);
    expect(cohort.ticket_medio_perfect).toBeCloseTo(250, 1); // (200+300)/2, null nao conta
  });

  it("retorna nulls e zeros sem dividir por zero quando vazio", () => {
    const cohort = aggregateCohortPerfect([]);
    expect(cohort.total_amortecedores).toBe(0);
    expect(cohort.share_perfect).toBe(0);
    expect(cohort.ticket_medio_perfect).toBeNull();
  });
});

describe("parseRangeFromSearchParams", () => {
  it("usa defaults quando from/to ausentes ou invalidos", () => {
    const def = defaultRange();
    expect(parseRangeFromSearchParams({})).toEqual(def);
    expect(parseRangeFromSearchParams({ from: "abc", to: "xyz" })).toEqual(def);
  });

  it("aceita ISO yyyy-mm-dd", () => {
    const r = parseRangeFromSearchParams({ from: "2026-01-01", to: "2026-03-31" });
    expect(r).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });
});
