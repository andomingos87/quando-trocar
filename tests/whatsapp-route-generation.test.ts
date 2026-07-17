import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { createWhatsappWebhookHandlers } from "@/lib/whatsapp/webhook-handler";
import type {
  ConfiguracoesVendedor,
  GeracaoLlmModo,
  ReplyGenerator,
} from "@/lib/whatsapp/types";

// Integração da camada de geração conversacional (ADR-0020 / Fase CV1) pelo
// caminho real do webhook: prova que `off` é byte-idêntico, que `sombra` audita
// mas envia a enlatada, e que `on` troca pela gerada só quando o validador
// aprova. Complementa os testes de unidade do validador e do orquestrador.

const ENLATADA = "A partir de R$ 59 chefe. Bora testar 14 dias gratis?";

function inboundPayload(body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "business-id",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [
                { profile: { name: "Lead Teste" }, wa_id: "5541999421180" },
              ],
              messages: [
                {
                  from: "5541999421180",
                  id: `wamid.${body.replace(/\W/g, "-")}`,
                  timestamp: "1714070400",
                  text: { body },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signedRequest(payload: unknown, secret: string) {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
  return new Request("https://example.com/api/webhooks/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
    body: rawBody,
  });
}

function salesConfig(modo: GeracaoLlmModo): ConfiguracoesVendedor {
  return {
    taxaRecuperacaoRoi: 0.15,
    whatsappHandoffComercial: "+5511945207618",
    frasesLanding: ["oi quero testar o quando trocar"],
    precoPartida: 59,
    geracaoLlmModo: modo,
  };
}

// Repositório de lead novo → conversa em modo "vendas" (participant_type
// lead_oficina). Espelha o harness dos demais testes de rota.
function salesRepository(modo: GeracaoLlmModo, overrides: Record<string, unknown> = {}) {
  return {
    saveWhatsappEvent: vi.fn(async () => ({ duplicate: false, eventId: "event-id" })),
    getOficinaByWhatsapp: vi.fn(async () => null),
    getConversationByWhatsapp: vi.fn(async () => null),
    upsertLead: vi.fn(async () => ({
      id: "lead-id",
      status: "em_conversa" as const,
      nome: "Lead Teste",
      metadata: {},
    })),
    upsertConversation: vi.fn(),
    upsertSalesLeadConversation: vi.fn(async () => ({
      id: "conversation-id",
      leadId: "lead-id",
      agentMode: "vendas" as const,
      participantType: "lead_oficina" as const,
      context: {},
    })),
    // Necessário só para o type-guard do router reconhecer o repo "phase 2";
    // não é chamado no caminho de lead (getOficinaByWhatsapp => null).
    upsertOficinaConversation: vi.fn(async () => ({
      id: "conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      agentMode: "onboarding" as const,
      participantType: "oficina_cliente" as const,
      context: {},
    })),
    getConfiguracoesVendedor: vi.fn(async () => salesConfig(modo)),
    listRecentMessages: vi.fn(async () => []),
    updateConversationModeAndContext: vi.fn(async () => undefined),
    saveInboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "message-id" })),
    saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "outbound-message-id" })),
    saveAgentToolCall: vi.fn(async () => undefined),
    markWhatsappEventProcessed: vi.fn(async () => undefined),
    markWhatsappEventFailed: vi.fn(async () => undefined),
    updateLeadStatus: vi.fn(async () => undefined),
    createOutboundMessage: vi.fn(async () => ({ id: "outbound-id" })),
    markOutboundSent: vi.fn(async () => undefined),
    markOutboundFailed: vi.fn(async () => undefined),
    ...overrides,
  };
}

function makeGenerator(
  reply: string | null,
  nullReason: "dont_know" | "error" = "error",
) {
  const state = { calls: 0 };
  const generator: ReplyGenerator = {
    async generate() {
      state.calls += 1;
      return reply === null ? { reply: null, reason: nullReason } : { reply };
    },
  };
  return { generator, state };
}

function salesAgent() {
  // Agente de vendas determinístico: devolve a enlatada sem trocar status nem
  // converter (mantém o teste focado na camada de geração).
  return {
    generateReply: vi.fn(async () => ({
      body: ENLATADA,
      status: "em_conversa" as const,
      toolCalls: [],
    })),
  };
}

const env = {
  WHATSAPP_VERIFY_TOKEN: "verify-token",
  WHATSAPP_APP_SECRET: "app-secret",
};

function replyGenerationCall(repository: ReturnType<typeof salesRepository>) {
  // O mock de saveAgentToolCall não declara parâmetro, então o TS infere
  // mock.calls como Array<[]> (tuplas vazias) e reclama de indexar c[0]. Como é
  // só harness de teste, tipamos a leitura dos argumentos aqui (via unknown).
  const calls = repository.saveAgentToolCall.mock.calls as unknown as Array<
    [
      {
        toolName?: string;
        input?: Record<string, unknown>;
        output?: Record<string, unknown>;
      },
    ]
  >;
  return calls.map((c) => c[0]).find((c) => c.toolName === "reply_generation");
}

describe("webhook — camada de geração conversacional (CV1)", () => {
  test("off: envia a enlatada byte-idêntica, sem gerar nem auditar", async () => {
    const repository = salesRepository("off");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const { generator, state } = makeGenerator("Fala chefe, TEXTO GERADO diferente!");

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("quanto custa"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(state.calls).toBe(0);
    expect(repository.listRecentMessages).not.toHaveBeenCalled();
    expect(replyGenerationCall(repository)).toBeUndefined();
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: ENLATADA,
    });
  });

  test("sombra: gera + valida + audita, mas envia a enlatada", async () => {
    const repository = salesRepository("sombra");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada = "Opa chefe! Comeca em R$ 59, bora testar 14 dias gratis?";
    const { generator, state } = makeGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("quanto custa"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(state.calls).toBe(1);
    expect(repository.listRecentMessages).toHaveBeenCalledWith({
      conversationId: "conversation-id",
      limit: 10,
    });
    // Sombra nunca muda o que o cliente recebe.
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: ENLATADA,
    });
    const audit = replyGenerationCall(repository);
    expect(audit?.output).toMatchObject({
      generated: gerada,
      approved: true,
      usedFallback: true,
    });
  });

  test("on aprovado: envia a resposta gerada", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada = "Fala chefe! Da pra testar 14 dias de graca. Topa?";
    const { generator } = makeGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("quanto custa"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: gerada,
    });
    expect(replyGenerationCall(repository)?.output).toMatchObject({
      approved: true,
      usedFallback: false,
    });
  });

  test("on reprovado (preço inventado): mantém a enlatada", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const { generator } = makeGenerator("Fecho por R$ 999 pra voce, chefe.");

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("quanto custa"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: ENLATADA,
    });
    expect(replyGenerationCall(repository)?.output).toMatchObject({
      approved: false,
      rejectionReason: "preco_invalido",
      usedFallback: true,
    });
  });
});

// --- Modo respond na operação (ADR-0022) -------------------------------------
// Prova o wiring do webhook: a categoria `pergunta` do agente de operação
// dispara o gerador em modo respond (com userMessage + knowledge) e o fallback
// fim-a-fim é a enlatada de handoff.

const HANDOFF_ENLATADA =
  "Boa pergunta! Essa parte quem resolve rapidinho e o comercial: https://wa.me/5511945207618. E quando tiver uma troca pra registrar, e so me mandar os dados do cliente.";

function oficinaRepository(modo: GeracaoLlmModo) {
  return salesRepository(modo, {
    getOficinaByWhatsapp: vi.fn(async () => ({
      id: "oficina-id",
      nome: "Auto Center Silva",
      whatsappPrincipal: "+5541999421180",
      diasLembretePadrao: 90,
    })),
    upsertOficinaConversation: vi.fn(async () => ({
      id: "conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      agentMode: "operacao" as const,
      participantType: "oficina_cliente" as const,
      context: {},
    })),
  });
}

function respondOnboardingAgent() {
  return {
    generateReply: vi.fn(async () => ({
      body: HANDOFF_ENLATADA,
      context: { neutral_turn: 1, greeted: false },
      registerServiceInput: null,
      nextAgentMode: null,
      toolCalls: [],
      allowConversationalGeneration: true,
      conversationalGenerationMode: "respond" as const,
    })),
  };
}

function capturingGenerator(
  reply: string | null,
  nullReason: "dont_know" | "error" = "error",
) {
  const inputs: Array<Record<string, unknown>> = [];
  const generator: ReplyGenerator = {
    async generate(input) {
      inputs.push(input as unknown as Record<string, unknown>);
      return reply === null ? { reply: null, reason: nullReason } : { reply };
    },
  };
  return { generator, inputs };
}

describe("webhook — modo respond na operação (ADR-0022)", () => {
  test("on aprovado: envia a gerada; gerador recebe userMessage + knowledge; audit respond", async () => {
    const repository = oficinaRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada =
      "Aqui eu registro suas trocas e aviso o cliente na hora de voltar, chefe. Alinhamento tambem entra!";
    const { generator, inputs } = capturingGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      onboardingAgent: respondOnboardingAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("E voces fazem alinhamento?"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: gerada,
    });

    // O gerador recebeu o wiring completo do respond.
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      generationMode: "respond",
      userMessage: "E voces fazem alinhamento?",
      agentMode: "operacao",
    });
    const knowledge = inputs[0].knowledge as {
      productFacts: string;
      workshopName: string | null;
      handoffLink: string | null;
    };
    expect(knowledge.productFacts).toContain("registra os servicos");
    expect(knowledge.workshopName).toBe("Auto Center Silva");
    expect(knowledge.handoffLink).toBe("https://wa.me/5511945207618");

    const audit = replyGenerationCall(repository);
    expect(audit?.input).toMatchObject({
      generationMode: "respond",
      intent: "pergunta",
      userMessage: "E voces fazem alinhamento?",
    });
    expect(audit?.output).toMatchObject({ approved: true, usedFallback: false });
  });

  test("gerador null (dontKnow/timeout) => envia a enlatada de handoff fim-a-fim", async () => {
    const repository = oficinaRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const { generator } = capturingGenerator(null);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      onboardingAgent: respondOnboardingAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("E voces fazem alinhamento?"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: HANDOFF_ENLATADA,
    });
    expect(replyGenerationCall(repository)?.output).toMatchObject({
      approved: false,
      rejectionReason: "generation_failed_or_null",
      usedFallback: true,
    });
  });
});
