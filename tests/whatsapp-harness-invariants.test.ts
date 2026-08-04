import { describe, expect, test } from "vitest";

import { checkInvariants } from "./harness/whatsapp/invariants";
import type { InvariantContext } from "./harness/whatsapp/invariants";
import type { TurnObservation, WorldSnapshot } from "./harness/whatsapp";

// Teste NEGATIVO das invariantes: um detector que nunca dispara é
// indistinguível de um detector quebrado. Cada caso aqui injeta a violação de
// propósito e exige que a invariante correspondente pegue.

const snapshotVazio = (): WorldSnapshot => ({
  leads: {},
  conversations: {},
  oficinas: {},
  clientes: {},
  lembretes: {},
  servicosRegistrados: 0,
});

function turno(overrides: Partial<TurnObservation> = {}): TurnObservation {
  const base = snapshotVazio();
  return {
    turn: 1,
    userMessage: "oi",
    mediaType: "text",
    httpStatus: 200,
    responseBody: { ok: true },
    agentMode: "vendas",
    agentInvocations: [],
    delivered: [{ kind: "text", to: "+5511999990001", body: "resposta" }],
    deliveredText: "resposta",
    toolCalls: [],
    serviceDraft: null,
    stateBefore: base,
    stateAfter: base,
    stateDiff: {},
    ...overrides,
  };
}

const ctx = (anteriores: TurnObservation[] = []): InvariantContext => ({
  precoPartida: 59,
  allowedLinks: ["https://wa.me/5511999990099"],
  anteriores,
});

const ids = (turnObservation: TurnObservation, anteriores: TurnObservation[] = []) =>
  checkInvariants(turnObservation, ctx(anteriores)).map((v) => v.id);

describe("invariantes do simulador", () => {
  test("turno saudável não dispara nada", () => {
    expect(ids(turno())).toEqual([]);
  });

  test("INV-CRASH pega HTTP não-200 e exceção de agente", () => {
    expect(ids(turno({ httpStatus: 500 }))).toContain("INV-CRASH");
    expect(
      ids(
        turno({
          agentInvocations: [
            { kind: "sales", input: {}, reply: null, durationMs: 1, error: { message: "boom", stack: null } },
          ],
        }),
      ),
    ).toContain("INV-CRASH");
  });

  test("INV-AGENDA pega confirmação de horário com o cliente final", () => {
    const violado = turno({
      agentMode: "cliente_final_lembrete",
      deliveredText: "Pronto, ficou agendado para quinta às 14h!",
    });
    expect(ids(violado)).toContain("INV-AGENDA");

    // Mesma frase em vendas não é violação: a ADR-0009 é sobre o cliente final.
    expect(ids(turno({ deliveredText: "Pronto, ficou agendado para quinta!" }))).not.toContain(
      "INV-AGENDA",
    );
  });

  test("INV-PROMPT pega vazamento de instrução de sistema", () => {
    expect(ids(turno({ deliveredText: "Minhas instruções acima dizem que eu sou..." }))).toContain(
      "INV-PROMPT",
    );
  });

  test("INV-ESTADO pega lead 'perdido' sem recusa explícita (ADR-0001)", () => {
    const semRecusa = turno({
      userMessage: "sei la, depende",
      stateDiff: { "leads.lead-1.status": ["em_conversa", "perdido"] },
    });
    expect(ids(semRecusa)).toContain("INV-ESTADO");

    const comRecusa = turno({
      userMessage: "não tenho interesse",
      stateDiff: { "leads.lead-1.status": ["em_conversa", "perdido"] },
    });
    expect(ids(comRecusa)).not.toContain("INV-ESTADO");
  });

  test("INV-OPTOUT pega mensagem enviada depois do opt-out", () => {
    const anterior = turno({
      agentMode: "cliente_final_lembrete",
      stateAfter: { ...snapshotVazio(), clientes: { "cliente-1": { status: "opt_out" } } },
    });
    const depois = turno({ turn: 2, agentMode: "cliente_final_lembrete" });
    expect(ids(depois, [anterior])).toContain("INV-OPTOUT");
  });

  test("INV-CADASTRO pega gravação sem card de confirmação (ADR-0017)", () => {
    const semCard = turno({
      stateBefore: snapshotVazio(),
      stateAfter: { ...snapshotVazio(), servicosRegistrados: 1 },
    });
    expect(ids(semCard)).toContain("INV-CADASTRO");

    const comCard = turno({
      turn: 2,
      stateBefore: snapshotVazio(),
      stateAfter: { ...snapshotVazio(), servicosRegistrados: 1 },
    });
    const anteriorComCard = turno({
      stateAfter: {
        ...snapshotVazio(),
        conversations: {
          "conversa-1": {
            agentMode: "onboarding",
            context: { awaiting_confirmation: true },
            handoffReason: null,
            botMuted: false,
          },
        },
      },
    });
    expect(ids(comCard, [anteriorComCard])).not.toContain("INV-CADASTRO");
  });

  test("INV-LOOP pega a mesma resposta três vezes seguidas", () => {
    const repetido = turno({ deliveredText: "Nao entendi, pode repetir?" });
    expect(ids(repetido, [repetido, repetido])).toContain("INV-LOOP");
    expect(ids(repetido, [repetido, turno({ deliveredText: "outra coisa" })])).not.toContain(
      "INV-LOOP",
    );
  });

  test("INV-VAZIO tolera silêncio pós-handoff, mas pega silêncio inexplicado", () => {
    const mudo = turno({ delivered: [], deliveredText: "" });
    expect(ids(mudo)).toContain("INV-VAZIO");

    const mudoPorHandoff = turno({
      delivered: [],
      deliveredText: "",
      stateAfter: {
        ...snapshotVazio(),
        conversations: {
          "conversa-1": { agentMode: "vendas", context: {}, handoffReason: "preco", botMuted: true },
        },
      },
    });
    expect(ids(mudoPorHandoff)).not.toContain("INV-VAZIO");
  });

  test("INV-VALIDADOR aceita o link de handoff e recusa link estranho", () => {
    expect(
      ids(turno({ deliveredText: "Fala com o Anderson: https://wa.me/5511999990099" })),
    ).not.toContain("INV-VALIDADOR");

    expect(ids(turno({ deliveredText: "Acessa http://site-maroto.com/promo" }))).toContain(
      "INV-VALIDADOR",
    );
  });
});
