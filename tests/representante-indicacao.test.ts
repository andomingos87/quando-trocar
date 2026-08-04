import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O modulo importa `next/headers` no topo (cookie). Os testes exercitam apenas
// a assinatura/validacao do valor e os helpers puros.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

import {
  INDICACAO_JANELA_SEGUNDOS,
  formatRepSufixo,
  gerarClickToken,
  normalizeCodigoIndicacao,
  parseIndicacaoValue,
  signIndicacaoValue,
} from "@/lib/representante/indicacao";

const SECRET = "rep-session-secret-min-32-chars-aaaaaa";
const ORIGINAL_SECRET = process.env.REP_SESSION_SECRET;

describe("indicacao do representante — cookie assinado", () => {
  beforeEach(() => {
    process.env.REP_SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.REP_SESSION_SECRET = ORIGINAL_SECRET;
  });

  const agora = Math.floor(Date.parse("2026-08-03T12:00:00Z") / 1000);
  const now = new Date("2026-08-03T12:00:00Z");

  it("faz round-trip de codigo + click token", () => {
    const value = signIndicacaoValue({ codigo: "CARLOS-SP", clickToken: "K7F2QX", ts: agora })!;
    expect(parseIndicacaoValue(value, { now })).toEqual({
      codigo: "CARLOS-SP",
      clickToken: "K7F2QX",
      ts: agora,
    });
  });

  it("rejeita valor com assinatura invalida (visitante nao forja indicacao)", () => {
    const value = signIndicacaoValue({ codigo: "CARLOS", clickToken: "K7F2QX", ts: agora })!;
    const forjado = value.replace("CARLOS", "OUTROREP");
    expect(parseIndicacaoValue(forjado, { now })).toBeNull();
    expect(parseIndicacaoValue("v1:CARLOS:K7F2QX:1:assinatura-falsa", { now })).toBeNull();
    expect(parseIndicacaoValue("lixo", { now })).toBeNull();
    expect(parseIndicacaoValue(null, { now })).toBeNull();
  });

  it("rejeita valor assinado com outro segredo", () => {
    const value = signIndicacaoValue({ codigo: "CARLOS", clickToken: null, ts: agora })!;
    process.env.REP_SESSION_SECRET = "outro-segredo-com-mais-de-32-caracteres";
    expect(parseIndicacaoValue(value, { now })).toBeNull();
  });

  it("expira depois da janela, mesmo que o navegador devolva o cookie", () => {
    const dentro = signIndicacaoValue({
      codigo: "CARLOS",
      clickToken: null,
      ts: agora - INDICACAO_JANELA_SEGUNDOS + 60,
    })!;
    const fora = signIndicacaoValue({
      codigo: "CARLOS",
      clickToken: null,
      ts: agora - INDICACAO_JANELA_SEGUNDOS - 60,
    })!;
    expect(parseIndicacaoValue(dentro, { now })?.codigo).toBe("CARLOS");
    expect(parseIndicacaoValue(fora, { now })).toBeNull();
  });

  it("ignora click token fora do formato sem perder o codigo", () => {
    const value = signIndicacaoValue({ codigo: "CARLOS", clickToken: "ab", ts: agora })!;
    expect(parseIndicacaoValue(value, { now })).toEqual({
      codigo: "CARLOS",
      clickToken: null,
      ts: agora,
    });
  });

  it("sem REP_SESSION_SECRET a indicacao desliga em vez de quebrar a landing", () => {
    const value = signIndicacaoValue({ codigo: "CARLOS", clickToken: null, ts: agora })!;
    delete process.env.REP_SESSION_SECRET;
    expect(signIndicacaoValue({ codigo: "CARLOS", clickToken: null, ts: agora })).toBeNull();
    expect(parseIndicacaoValue(value, { now })).toBeNull();
  });

  it("normaliza e valida o codigo", () => {
    expect(normalizeCodigoIndicacao(" carlos-sp ")).toBe("CARLOS-SP");
    expect(normalizeCodigoIndicacao("X")).toBeNull();
    expect(normalizeCodigoIndicacao("carlos sp")).toBeNull();
    expect(normalizeCodigoIndicacao("-CARLOS")).toBeNull();
    expect(normalizeCodigoIndicacao("CARLOS'; drop table--")).toBeNull();
    expect(normalizeCodigoIndicacao(null)).toBeNull();
  });

  it("monta o sufixo lido pelo bot", () => {
    expect(formatRepSufixo({ codigo: "CARLOS-SP", clickToken: "K7F2QX" })).toBe(
      "#REP-CARLOS-SP.K7F2QX",
    );
    expect(formatRepSufixo({ codigo: "CARLOS", clickToken: null })).toBe("#REP-CARLOS");
  });

  it("gera click token no formato aceito pelo bot", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(gerarClickToken()).toMatch(/^[A-Z0-9]{6}$/);
    }
  });
});
