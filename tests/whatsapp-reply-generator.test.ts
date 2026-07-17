import { afterEach, describe, expect, it, vi } from "vitest";
import type OpenAI from "openai";

import {
  OpenAiReplyGenerator,
  REPLY_GENERATOR_PROMPT_VERSION,
  maybeGenerateConversationalReply,
} from "@/lib/whatsapp/reply-generator";
import { buildOperationKnowledge } from "@/lib/whatsapp/product-knowledge";
import type {
  ConfiguracoesVendedor,
  ReplyGenerationInput,
  ReplyGenerationKnowledge,
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

function makeGenerator(
  reply: string | null,
  nullReason: "dont_know" | "error" = "error",
): {
  generator: ReplyGenerator;
  state: { calls: number };
} {
  const state = { calls: 0 };
  const generator: ReplyGenerator = {
    async generate() {
      state.calls += 1;
      return reply === null ? { reply: null, reason: nullReason } : { reply };
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

  it("retorna erro quando não há modelo configurado", async () => {
    const fakeOpenai = {
      responses: { create: vi.fn() },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: undefined });
    expect(await gen.generate(input)).toEqual({ reply: null, reason: "error" });
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
    expect(await gen.generate(input)).toEqual({ reply: "Fala chefe!" });
  });

  it("dontKnow=true => reply null com motivo dont_know", async () => {
    const fakeOpenai = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: JSON.stringify({ reply: ENLATADA, dontKnow: true }),
        }),
      },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: "test-model" });
    expect(await gen.generate(input)).toEqual({ reply: null, reason: "dont_know" });
  });

  it("erro na chamada => reply null com motivo error", async () => {
    const fakeOpenai = {
      responses: { create: vi.fn().mockRejectedValue(new Error("network")) },
    } as unknown as OpenAI;
    const gen = new OpenAiReplyGenerator({ openai: fakeOpenai, model: "test-model" });
    expect(await gen.generate(input)).toEqual({ reply: null, reason: "error" });
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
    expect(await promise).toEqual({ reply: null, reason: "error" });
  });
});

// --- Modo respond (ADR-0022) -------------------------------------------------

const HANDOFF_ENLATADA =
  "Boa pergunta! Essa parte quem resolve e o comercial: https://wa.me/5511945207618. Quando tiver uma troca, e so mandar os dados.";

const knowledge: ReplyGenerationKnowledge = buildOperationKnowledge({
  faqs: [
    {
      id: "faq-1",
      pergunta: "O lembrete vai automatico?",
      resposta: "Sim, o bot avisa o cliente quando chega a hora de voltar.",
      palavras_chave: [],
      ordem: 1,
    },
    {
      id: "faq-2",
      pergunta: "Quanto custa o plano?",
      resposta: "A partir de R$ 59 por mes.",
      palavras_chave: [],
      ordem: 2,
    },
  ],
  handoffLink: "https://wa.me/5511945207618",
  workshopName: "Oficina do Ze",
});

function respondArgs(overrides: Record<string, unknown> = {}) {
  return baseArgs({
    deterministicReply: HANDOFF_ENLATADA,
    intent: "pergunta",
    agentMode: "operacao",
    generationMode: "respond",
    userMessage: "Voces fazem alinhamento?",
    knowledge,
    ...overrides,
  });
}

describe("maybeGenerateConversationalReply — modo respond (ADR-0022)", () => {
  it("on aprovado: envia a gerada e audita generationMode=respond + userMessage", async () => {
    const generatedOk =
      "O foco aqui e registrar as trocas e lembrar seu cliente de voltar, chefe. Alinhamento voce registra tambem!";
    const { generator } = makeGenerator(generatedOk);
    const result = await maybeGenerateConversationalReply({
      ...respondArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(generatedOk);
    expect(result.audit?.input.generationMode).toBe("respond");
    expect(result.audit?.input.userMessage).toBe("Voces fazem alinhamento?");
    expect(result.audit?.output.approved).toBe(true);
  });

  it("sombra: audita a gerada respond mas envia a enlatada de handoff", async () => {
    const { generator } = makeGenerator("Registra alinhamento tambem, chefe!");
    const result = await maybeGenerateConversationalReply({
      ...respondArgs(),
      mode: "sombra",
      generator,
    });
    expect(result.finalBody).toBe(HANDOFF_ENLATADA);
    expect(result.audit?.input.generationMode).toBe("respond");
    expect(result.audit?.output.usedFallback).toBe(true);
  });

  it("gerador com erro/timeout => enlatada de handoff, audit respond, sem unansweredQuestion", async () => {
    const { generator } = makeGenerator(null);
    const result = await maybeGenerateConversationalReply({
      ...respondArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(HANDOFF_ENLATADA);
    expect(result.audit?.input.generationMode).toBe("respond");
    expect(result.audit?.output.rejectionReason).toBe("generation_failed_or_null");
    expect(result.unansweredQuestion).toBe(false);
  });

  it("respond + dont_know => enlatada, rejectionReason proprio e unansweredQuestion (ADR-0023)", async () => {
    const { generator } = makeGenerator(null, "dont_know");
    const result = await maybeGenerateConversationalReply({
      ...respondArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(HANDOFF_ENLATADA);
    expect(result.audit?.output.rejectionReason).toBe("generation_dont_know");
    expect(result.unansweredQuestion).toBe(true);
  });

  it("respond + dont_know em sombra tambem marca unansweredQuestion (sombra alimenta o volante)", async () => {
    const { generator } = makeGenerator(null, "dont_know");
    const result = await maybeGenerateConversationalReply({
      ...respondArgs(),
      mode: "sombra",
      generator,
    });
    expect(result.finalBody).toBe(HANDOFF_ENLATADA);
    expect(result.unansweredQuestion).toBe(true);
  });

  it("rewrite + dont_know NAO marca unansweredQuestion (nao e pergunta sem resposta)", async () => {
    const { generator } = makeGenerator(null, "dont_know");
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "on",
      generator,
    });
    expect(result.audit?.input.generationMode).toBe("rewrite");
    expect(result.audit?.output.rejectionReason).toBe("generation_dont_know");
    expect(result.unansweredQuestion).toBe(false);
  });

  it("reprovado pelo validador (link fora da allowlist) => enlatada", async () => {
    const { generator } = makeGenerator("Chefe, olha esse site: https://golpe.com");
    const result = await maybeGenerateConversationalReply({
      ...respondArgs(),
      mode: "on",
      generator,
    });
    expect(result.finalBody).toBe(HANDOFF_ENLATADA);
    expect(result.audit?.output.approved).toBe(false);
    expect(result.audit?.output.rejectionReason).toBe("link_nao_permitido");
    expect(result.unansweredQuestion).toBe(false);
  });

  it("retrocompat: chamada sem generationMode audita rewrite", async () => {
    const { generator } = makeGenerator("Fala chefe!");
    const result = await maybeGenerateConversationalReply({
      ...baseArgs(),
      mode: "on",
      generator,
    });
    expect(result.audit?.input.generationMode).toBe("rewrite");
    expect(result.audit?.input.userMessage).toBeNull();
  });

  it("respond sem userMessage degrada para rewrite no audit", async () => {
    const { generator } = makeGenerator("Fala chefe!");
    const result = await maybeGenerateConversationalReply({
      ...respondArgs({ userMessage: undefined }),
      mode: "on",
      generator,
    });
    expect(result.audit?.input.generationMode).toBe("rewrite");
  });
});

describe("OpenAiReplyGenerator — prompts do modo respond", () => {
  function capturingOpenai() {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({ reply: "Fala chefe!", dontKnow: false }),
    });
    return { openai: { responses: { create } } as unknown as OpenAI, create };
  }

  function promptsFromCall(create: ReturnType<typeof vi.fn>) {
    const params = create.mock.calls[0][0] as {
      input: Array<{ role: string; content: string }>;
    };
    const system = params.input.find((m) => m.role === "system")?.content ?? "";
    const user = params.input.find((m) => m.role === "user")?.content ?? "";
    return { system, user };
  }

  it("respond: system proíbe preço e user traz conhecimento + pergunta (FAQ de preço filtrada)", async () => {
    const { openai, create } = capturingOpenai();
    const gen = new OpenAiReplyGenerator({ openai, model: "test-model" });
    await gen.generate({
      deterministicReply: HANDOFF_ENLATADA,
      intent: "pergunta",
      agentMode: "operacao",
      history: [{ direction: "inbound", body: "oi", sentAt: null }],
      salesConfig,
      generationMode: "respond",
      userMessage: "Voces fazem alinhamento?",
      knowledge,
    });

    const { system, user } = promptsFromCall(create);
    expect(system).toContain("NUNCA cite preco");
    expect(system).toContain("dontKnow=true");
    expect(user).toContain("CONHECIMENTO");
    expect(user).toContain("Oficina do Ze");
    expect(user).toContain("Voces fazem alinhamento?");
    expect(user).toContain("O lembrete vai automatico?");
    // FAQ com preço foi filtrada do conhecimento (buildOperationKnowledge).
    expect(user).not.toContain("R$ 59 por mes");
  });

  it("respond sem userMessage => usa o prompt de rewrite", async () => {
    const { openai, create } = capturingOpenai();
    const gen = new OpenAiReplyGenerator({ openai, model: "test-model" });
    await gen.generate({
      deterministicReply: ENLATADA,
      intent: null,
      agentMode: "operacao",
      history: [],
      salesConfig,
      generationMode: "respond",
      knowledge,
    });
    const { user } = promptsFromCall(create);
    expect(user).toContain("reescreva o tom, preserve o conteudo");
    expect(user).not.toContain("CONHECIMENTO");
  });

  it("respond em vendas degrada para rewrite (vendas fora de escopo)", async () => {
    const { openai, create } = capturingOpenai();
    const gen = new OpenAiReplyGenerator({ openai, model: "test-model" });
    await gen.generate({
      deterministicReply: ENLATADA,
      intent: "pergunta_preco",
      agentMode: "vendas",
      history: [],
      salesConfig,
      generationMode: "respond",
      userMessage: "quanto custa?",
      knowledge,
    });
    const { user } = promptsFromCall(create);
    expect(user).toContain("reescreva o tom, preserve o conteudo");
  });
});
