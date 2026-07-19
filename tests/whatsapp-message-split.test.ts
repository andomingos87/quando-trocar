import { describe, expect, test } from "vitest";

import { splitLongMessage } from "@/lib/whatsapp/message-split";

describe("splitLongMessage (CV7)", () => {
  test("mensagem curta não é quebrada", () => {
    expect(splitLongMessage("oi chefe", 350)).toEqual(["oi chefe"]);
  });

  test("quebra em até 2 partes numa fronteira natural", () => {
    const a = "A".repeat(200);
    const b = "B".repeat(200);
    const parts = splitLongMessage(`${a}\n\n${b}`, 350);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(a);
    expect(parts[1]).toBe(b);
  });

  test("prefere fim de frase quando não há parágrafo", () => {
    const first = "Primeira frase completa aqui. ".repeat(10).trim();
    const second = "Segunda parte do texto continua depois disso tudo.";
    const parts = splitLongMessage(`${first} ${second}`, 200);
    expect(parts).toHaveLength(2);
    // Corte não parte palavra no meio.
    expect(parts[0].endsWith(".")).toBe(true);
  });

  test("texto sem espaços cai em corte duro no limite", () => {
    const solid = "x".repeat(500);
    const parts = splitLongMessage(solid, 350);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(350);
    expect(parts[1]).toHaveLength(150);
  });

  test("primeira parte respeita o limite quando há espaços", () => {
    const words = "palavra ".repeat(100).trim();
    const parts = splitLongMessage(words, 350);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    expect(parts[0].length).toBeLessThanOrEqual(350);
  });
});
