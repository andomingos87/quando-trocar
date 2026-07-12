import { afterEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";

import {
  OpenAiReplyGenerator,
  REPLY_GENERATOR_PROMPT_VERSION,
  maybeGenerateConversationalReply,
} from "@/lib/whatsapp/reply-generator";
import type {
  ConfiguracoesVendedor,
  ReplyGenerationInput,
  ReplyGenerator,
} from "@/lib/whatsapp/types";

const ENLATADA = "A partir de R$ 59 chefe. Bora testar 14 dias gratis?";

const salesConfig: ConfiguracoesVendedor = {
  taxaRecuperacaoRoi: 0.15,
  whatsappHandoffComercial: "+5511945207618",
  frasesLanding: ["oi quero testar o quando trocar"],
  precoPartida: 59,
  geracaoLlmModo: "on",
};

const allowedLinks = ["https://wa.me/5511945207618", "https://quandotrocar.com.br"];
const allowedNames = ["Oficina do Ze"];

function makeGenerator(reply: string | null): {
  generator: ReplyGenerator;
  state: { calls: number };
} {
  const state = { calls: 0 };
  const generator: ReplyGenerator = {
    async generate() {
      state.calls += 1;
      return reply;
    },
  };
  return { generator, state };
}

function baseArgs(overrides: Record<string, unknown> = {}) {
  return {
    deterministicReply: ENLATADA,
    intent: "pergunta_preco" as string | null,
    agentMode: "vendas",
    history: [],
    salesConfig,
    allowedLinks,
    allowedNames,
    ...overrides,
  };
}

describe("maybeGenerateConversationalReply — modo off", () => {
  it("não chama o gerador e devolve a enlatada, sem auditoria", async () => {
    const { generator, state } = makeGenerator("qualquer coisa");
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "off",
      generator,
    });
    expect(result.finalBody).toBe(ENLATADA);
    expect(result.audit).toBeNull();
    expect(state.calls).toBe(0);
  });

  it("gerador undefined => enlatada mesmo se mode on", async () => {
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "on",
      generator: undefined,
    });
    expect(result.finalBody).toBe(ENLATADA);
    expect(result.audit).toBeNull();
  });
});

describe("maybeGenerateConversationalReply — modo sombra", () => {
  it("chama, valida e audita, mas envia a enlatada", async () => {
    const generatedOk = "Opa chefe! Comeca em R$ 59, bora testar 14 dias gratis?";
    const { generator, state } = makeGenerator(generatedOk);
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "sombra",
      generator,
    });
    expect(state.calls).toBe(1);
    expect(result.finalBody).toBe(ENLATADA);
    expect(result.audit).not.toBeNull();
    expect(result.audit?.output.generated).toBe(generatedOk);
    expect(result.audit?.output.approved).toBe(true);
    expect(result.audit?.output.usedFallback).toBe(true);
    expect(result.audit?.input.promptVersion).toBe(REPLY_GENERATOR_PROMPT_VERSION);
    expect(result.audit?.input.mode).toBe("sombra");
  });

  it("audita reprovação em sombra (preço inventado)", async () => {
    const { generator } = makeGenerator("Custa R$ 999 chefe.");
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "sombra",
      generator,
    });
    expect(result.finalBody).toBe(ENLATADA);
    expect(result.audit?.output.approved).toBe(false);
    expect(result.audit?.output.rejectionReason).toBe("preco_invalido");
    expect(result.audit?.output.usedFallback).toBe(true);
  });
});

describe("maybeGenerateConversationalReply — modo on", () => {
  it("aprovado => troca pela gerada", async () => {
    const generatedOk = "Fala chefe! Da pra testar 14 dias de graca. Topa?";
    const { generator } = makeGenerator(generatedOk);
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(generatedOk);
    expect(result.audit?.output.approved).toBe(true);
    expect(result.audit?.output.usedFallback).toBe(false);
  });

  it("reprovado => mantém a enlatada", async () => {
    const { generator } = makeGenerator("Te encaixo amanha as 14h chefe.");
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(ENLATADA);
    expect(result.audit?.output.approved).toBe(false);
    expect(result.audit?.output.rejectionReason).toBe("promessa_ou_agenda");
    expect(result.audit?.output.usedFallback).toBe(true);
  });

  it("gerador retorna null => mantém a enlatada", async () => {
    const { generator } = makeGenerator(null);
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(ENLATADA);
    expect(result.audit?.output.generated).toBeNull();
    expect(result.audit?.output.usedFallback).toBe(true);
    expect(result.audit?.output.rejectionReason).toBe(
      "generation_failed_or_null",
    );
  });

  it("gerador que lança => tratado como null (enlatada)", async () => {
    const generator: ReplyGenerator = {
      async generate() {
        throw new Error("boom");
      },
    };
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(ENLATADA);
    expect(result.audit?.output.usedFallback).toBe(true);
  });
});

describe("OpenAiReplyGenerator (sem request real)", () => {
  const input: ReplyGenerationInput = {
    deterministicReply: ENLATADA,
    intent: "pergunta_preco",
    agentMode: "vendas",
    history: [],
    salesConfig,
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna null quando não há modelo configurado", async () => {
    const fakeOpenai = {
      responses: { create: vi.fn() },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: undefined });
    expect(await gen.generate(input)).toBeNull();
    expect((fakeOpenai.responses.create as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("parseia structured output e devolve o reply", async () => {
    const fakeOpenai = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({ reply: "Fala chefe!", dontKnow: false }),
        }),
      },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: "test-model" });
    expect(await gen.generate(input)).toBe("Fala chefe!");
  });

  it("dontKnow=true => null", async () => {
    const fakeOpenai = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({ reply: ENLATADA, dontKnow: true }),
        }),
      },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: "test-model" });
    expect(await gen.generate(input)).toBeNull();
  });

  it("erro na chamada => null", async () => {
    const fakeOpenai = {
      responses: { create: vi.fn().mockRejectedValue(new Error("network")) },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: "test-model" });
    expect(await gen.generate(input)).toBeNull();
  });

  it("timeout (abort após 3s) => null", async () => {
    vi.useFakeTimers();
    const fakeOpenai = {
      responses: {
        create: vi.fn(
          (_params: unknown, opts: { signal: AbortSignal }) =>
            new Promise((_resolve, reject) => {
              opts.signal.addEventListener("abort", () =>
                reject(new Error("aborted")),
              );
            }),
        ),
      },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: "test-model" });
    const promise = gen.generate(input);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await promise).toBeNull();
  });
});
