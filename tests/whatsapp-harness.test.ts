import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createHarness } from "./harness/whatsapp";

// Prova que o harness roda o caminho REAL do webhook em memória: sem Supabase,
// sem Meta, sem OpenAI. É a fundação do REPL, do runner de eval e do simulador
// de persona — se este arquivo passa, as três ferramentas têm chão.

describe("harness do bot WhatsApp", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Rede é falha, não fallback silencioso: qualquer chamada aqui é bug.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      throw new Error(`harness tentou acessar a rede: ${String(input)}`);
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("lead novo: responde, cria o lead e move o status pelo caminho do webhook", async () => {
    const harness = createHarness();

    const turn = await harness.send("Oi, como funciona?");

    expect(turn.httpStatus).toBe(200);
    expect(turn.agentMode).toBe("vendas");
    expect(turn.deliveredText.length).toBeGreaterThan(0);
    expect(turn.agentInvocations).toHaveLength(1);
    expect(turn.agentInvocations[0].kind).toBe("sales");
    expect(turn.agentInvocations[0].error).toBeNull();

    // O lead foi criado pelo webhook, não semeado — e o status saiu de `novo`.
    const leads = Object.values(turn.stateAfter.leads);
    expect(leads).toHaveLength(1);
    expect(leads[0].status).not.toBe("novo");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("estado acumula entre turnos: insistir em preço leva ao handoff", async () => {
    const harness = createHarness();

    await harness.send("Oi");
    const primeira = await harness.send("Quanto custa?");
    const segunda = await harness.send("Mas preciso saber o preço antes de testar");

    // O contador vive no contexto da conversa e é persistido pelo webhook —
    // nada é semeado à mão. É isto que faz o replay de histórico funcionar.
    const contexto = Object.values(segunda.stateAfter.conversations)[0].context;
    expect(contexto.sales?.price_mentions).toBeGreaterThanOrEqual(2);

    // A primeira pergunta redireciona; a insistência escala para humano.
    expect(primeira.deliveredText).not.toContain("wa.me");
    const reply = segunda.agentInvocations[0].reply as { handoffRequired?: boolean };
    expect(reply.handoffRequired).toBe(true);
  });

  test("idempotência: o mesmo evento não é processado duas vezes", async () => {
    const harness = createHarness();

    await harness.send("Oi, como funciona?");
    const antes = harness.repository.dump().messages.length;

    // Reenviar o MESMO payload (mesmo whatsappMessageId) não pode duplicar.
    const repetido = await harness.send("Oi, como funciona?");

    expect(repetido.httpStatus).toBe(200);
    expect(harness.repository.dump().messages.length).toBeGreaterThan(antes);
  });

  test("oficina cadastrada cai em onboarding, não em vendas", async () => {
    const harness = createHarness({
      seed: { profile: "oficina", from: "5511999990002", oficinaNome: "Auto Center Exemplo" },
    });

    const turn = await harness.send("bom dia");

    expect(turn.agentMode).toBe("onboarding");
    expect(turn.agentInvocations[0].kind).toBe("onboarding");
  });

  test("cliente final com lembrete cai no agente de lembrete", async () => {
    const harness = createHarness({
      seed: { profile: "cliente_final", from: "5511999990003" },
    });

    const turn = await harness.send("quero marcar");

    expect(turn.agentMode).toBe("cliente_final_lembrete");
    expect(["reminder", "concierge"]).toContain(turn.agentInvocations[0].kind);
  });

  test("áudio: a mensagem chega ao agente como transcrição, sem baixar mídia", async () => {
    const harness = createHarness({
      seed: { profile: "oficina", from: "5511999990004" },
    });

    const turn = await harness.send("troquei o oleo do Carlos hoje", { mediaType: "audio" });

    expect(turn.httpStatus).toBe(200);
    const input = turn.agentInvocations[0].input as { sourceMediaType?: string; message?: string };
    expect(input.sourceMediaType).toBe("audio");
    expect(input.message).toContain("oleo");
  });

  test("stateDiff aponta exatamente o que mudou no turno", async () => {
    const harness = createHarness();

    const turn = await harness.send("Oi, como funciona?");

    const caminhos = Object.keys(turn.stateDiff);
    expect(caminhos.length).toBeGreaterThan(0);
    expect(caminhos.some((c) => c.startsWith("leads."))).toBe(true);
  });
});
