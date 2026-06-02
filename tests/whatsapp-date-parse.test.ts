import { describe, expect, test } from "vitest";

import { parseBrazilianDate } from "../lib/whatsapp/date-parse";

// Âncora: 2026-06-02 é uma terça-feira.
const TODAY = "2026-06-02";

function dowOf(iso: string) {
  return new Date(`${iso}T12:00:00.000Z`).getUTCDay();
}

describe("parseBrazilianDate — relativos explícitos", () => {
  const cases: Array<[string, string]> = [
    ["hoje", "2026-06-02"],
    ["foi hoje", "2026-06-02"],
    ["ontem", "2026-06-01"],
    ["anteontem", "2026-05-31"],
    ["amanha", "2026-06-03"],
    ["amanhã", "2026-06-03"],
    ["depois de amanha", "2026-06-04"],
    ["depois de amanhã", "2026-06-04"],
  ];

  for (const [input, expected] of cases) {
    test(`"${input}" -> ${expected}`, () => {
      expect(parseBrazilianDate(input, TODAY).date).toBe(expected);
    });
  }
});

describe("parseBrazilianDate — contagem de dias/semanas", () => {
  const cases: Array<[string, string]> = [
    ["daqui 3 dias", "2026-06-05"],
    ["daqui a 3 dias", "2026-06-05"],
    ["em 2 dias", "2026-06-04"],
    ["dentro de 1 dia", "2026-06-03"],
    ["daqui a uma semana", "2026-06-09"],
    ["daqui 2 semanas", "2026-06-16"],
    ["5 dias atras", "2026-05-28"],
    ["ha 2 dias", "2026-05-31"],
    ["há 2 dias", "2026-05-31"],
    ["uma semana atras", "2026-05-26"],
  ];

  for (const [input, expected] of cases) {
    test(`"${input}" -> ${expected}`, () => {
      expect(parseBrazilianDate(input, TODAY).date).toBe(expected);
    });
  }
});

describe("parseBrazilianDate — numérico e extenso", () => {
  const cases: Array<[string, string]> = [
    ["05/06", "2026-06-05"],
    ["5/6", "2026-06-05"],
    ["05/06/2026", "2026-06-05"],
    ["5/6/26", "2026-06-05"],
    ["15-03", "2026-03-15"],
    ["10-12-2025", "2025-12-10"],
    ["dia 5", "2026-06-05"],
    ["dia 05", "2026-06-05"],
    ["5 de junho", "2026-06-05"],
    ["5 de jun", "2026-06-05"],
    ["10 de dezembro de 2025", "2025-12-10"],
    ["1 de marco", "2026-03-01"],
  ];

  for (const [input, expected] of cases) {
    test(`"${input}" -> ${expected}`, () => {
      expect(parseBrazilianDate(input, TODAY).date).toBe(expected);
    });
  }

  test("ignora motorização do veículo (não vira data)", () => {
    expect(parseBrazilianDate("Gol 1.0", TODAY).date).toBeNull();
    expect(parseBrazilianDate("Onix 2.0 turbo", TODAY).date).toBeNull();
  });

  test("rejeita mês/dia fora do intervalo", () => {
    expect(parseBrazilianDate("40/13", TODAY).date).toBeNull();
  });
});

describe("parseBrazilianDate — dia da semana", () => {
  test("dia da semana sem qualificador é ambíguo", () => {
    const result = parseBrazilianDate("foi na segunda", TODAY);
    expect(result.date).toBeNull();
    expect(result.ambiguous).toBe(true);
  });

  test('"sexta que vem" resolve para a próxima sexta futura', () => {
    const result = parseBrazilianDate("sexta que vem", TODAY);
    expect(result.ambiguous).toBe(false);
    expect(result.date).not.toBeNull();
    expect(result.date! > TODAY).toBe(true);
    expect(dowOf(result.date!)).toBe(5);
  });

  test('"próxima segunda" resolve para a próxima segunda futura', () => {
    const result = parseBrazilianDate("proxima segunda", TODAY);
    expect(result.date! > TODAY).toBe(true);
    expect(dowOf(result.date!)).toBe(1);
  });

  test('"quarta que vem" resolve para a próxima quarta futura', () => {
    const result = parseBrazilianDate("quarta que vem", TODAY);
    expect(result.date! > TODAY).toBe(true);
    expect(dowOf(result.date!)).toBe(3);
  });

  test('"sábado passado" resolve para o sábado anterior', () => {
    const result = parseBrazilianDate("sabado passado", TODAY);
    expect(result.date! < TODAY).toBe(true);
    expect(dowOf(result.date!)).toBe(6);
  });

  test('"terça retrasada" resolve para a terça de duas semanas atrás', () => {
    const result = parseBrazilianDate("terca retrasada", TODAY);
    expect(result.date! < TODAY).toBe(true);
    expect(dowOf(result.date!)).toBe(2);
  });
});

describe("parseBrazilianDate — sem sinal de data", () => {
  test("mensagem sem data devolve null não-ambíguo", () => {
    expect(parseBrazilianDate("troca de oleo do joao", TODAY)).toEqual({
      date: null,
      ambiguous: false,
      matchedText: null,
    });
  });
});
