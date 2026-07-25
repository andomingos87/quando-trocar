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

// --- QTR-35 P1-5: cross-tenant não pode vetar o nome do próprio turno --------
// Reproduz os dois vetos reais da conversa da Oficina Marsili (24/07/2026):
// a resposta boa era reprovada por cross_tenant exatamente no momento da
// conversão, porque `resolved.oficinaNome` (snapshot do início do turno) ainda
// era null. O nome capturado no turno e o que o interlocutor escreveu entram
// na allowlist; nome inventado pelo LLM continua vetado.

describe("webhook — allowlist do cross-tenant no turno (QTR-35 P1-5)", () => {
  test("nome capturado na memoria de vendas do turno e aprovado", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada = "A Oficina Marsili ta registrada chefe. Bora ativar seu teste?";
    const { generator } = makeGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: {
        generateReply: vi.fn(async () => ({
          body: "Show chefe! Vou cadastrar a Oficina Marsili em teste por aqui mesmo.",
          status: "teste_aceito" as const,
          toolCalls: [],
          updatedContext: {
            sales: { workshop_name: "Oficina Marsili", awaiting_workshop_name: false },
          },
        })),
      },
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("pode cadastrar"), env.WHATSAPP_APP_SECRET),
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

  test("nome presente na mensagem que o lead acabou de enviar e aprovado", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada = "Anotei chefe: Oficina Marsili. Quer que eu ja ative seu teste?";
    const { generator } = makeGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("e a Oficina Marsili aqui do centro"),
        env.WHATSAPP_APP_SECRET,
      ),
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

  test("turno da conversao: o nome recem-persistido e aprovado", async () => {
    const repository = salesRepository("on", {
      convertLeadToOficina: vi.fn(async () => ({
        oficinaId: "oficina-nova",
        nome: "Oficina Marsili",
        diasLembretePadrao: 90,
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada =
      "Fechou chefe! A Oficina Marsili ja ta cadastrada. Me manda a primeira troca: nome do cliente, carro, servico e WhatsApp.";
    const { generator } = makeGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: {
        generateReply: vi.fn(async () => ({
          body: "Show chefe! Vou cadastrar a Oficina Marsili em teste por aqui mesmo.",
          status: "teste_aceito" as const,
          toolCalls: [],
          convertToOficina: true,
          nomeOficina: "Oficina Marsili",
          updatedContext: { sales: { workshop_name: "Oficina Marsili" } },
        })),
      },
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("Oficina Marsili"), env.WHATSAPP_APP_SECRET),
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

  test("nome que so existe na saida do LLM continua vetado por cross_tenant", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const { generator } = makeGenerator(
      "A Oficina do Ze ja usa o produto e adora, chefe!",
    );

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
      rejectionReason: "cross_tenant",
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

// --- Respond em vendas (ADR-0024) ---------------------------------------------
// O caso geral do fora_escopo do agente de vendas pede respond: o gerador
// recebe a pergunta + conhecimento de vendas e a enlatada vira fallback.

describe("webhook — respond em vendas (ADR-0024)", () => {
  const FORA_ESCOPO_ENLATADA =
    "Pode reformular chefe? Ou se preferir, eu te explico de novo o produto, te passo o preco, ou ja ativo o teste.";

  function respondSalesAgent() {
    return {
      generateReply: vi.fn(async () => ({
        body: FORA_ESCOPO_ENLATADA,
        status: "em_conversa" as const,
        toolCalls: [],
        conversationalGenerationMode: "respond" as const,
      })),
    };
  }

  test("on aprovado: envia a gerada; gerador recebe knowledge de vendas; audit fora_escopo", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada =
      "Atende sim, chefe: qualquer servico com retorno previsivel entra. Bora ativar o teste?";
    const { generator, inputs } = capturingGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: respondSalesAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Voces atendem moto tambem?"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: gerada,
    });

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      generationMode: "respond",
      userMessage: "Voces atendem moto tambem?",
      agentMode: "vendas",
    });
    const knowledge = inputs[0].knowledge as {
      productFacts: string;
      workshopName: string | null;
      handoffLink: string | null;
    };
    // Conhecimento de vendas: fatos de vendas presentes, sem oficina.
    expect(knowledge.productFacts).toContain("14 dias");
    expect(knowledge.workshopName).toBeNull();
    expect(knowledge.handoffLink).toBe("https://wa.me/5511945207618");

    const audit = replyGenerationCall(repository);
    expect(audit?.input).toMatchObject({
      generationMode: "respond",
      intent: "fora_escopo",
      agentMode: "vendas",
    });
    expect(audit?.output).toMatchObject({ approved: true, usedFallback: false });
  });

  test("dont_know: envia a enlatada de fora_escopo e grava perguntas_sem_resposta", async () => {
    const repository = Object.assign(salesRepository("on"), {
      savePerguntaSemResposta: vi.fn(async () => undefined),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const { generator } = capturingGenerator(null, "dont_know");

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: respondSalesAgent(),
      replyGenerator: generator,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Voces integram com meu sistema de gestao?"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: FORA_ESCOPO_ENLATADA,
    });
    expect(repository.savePerguntaSemResposta).toHaveBeenCalledWith(
      expect.objectContaining({
        agentMode: "vendas",
        geracaoModo: "on",
        motivo: "dont_know",
        pergunta: "Voces integram com meu sistema de gestao?",
        respostaEnviada: FORA_ESCOPO_ENLATADA,
      }),
    );
  });

  test("agente de vendas sem o campo (rewrite): gerador roda em rewrite, sem knowledge", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const gerada = "Fala chefe! Da pra testar 14 dias de graca. Topa?";
    const { generator, inputs } = capturingGenerator(gerada);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: salesAgent(),
      replyGenerator: generator,
    });

    await handlers.POST(
      signedRequest(inboundPayload("quanto custa"), env.WHATSAPP_APP_SECRET),
    );

    expect(inputs[0]).toMatchObject({ generationMode: "rewrite" });
    expect(inputs[0].knowledge).toBeUndefined();
    expect(replyGenerationCall(repository)?.input).toMatchObject({
      generationMode: "rewrite",
      intent: null,
    });
  });
});

// --- Volante de aprendizado (ADR-0023) ----------------------------------------
// respond + dontKnow grava em perguntas_sem_resposta (best-effort); rewrite e
// erro nao gravam; repositorio sem o metodo opcional nao quebra nada.

describe("webhook — perguntas_sem_resposta (ADR-0023)", () => {
  function withSavePergunta(
    repository: ReturnType<typeof salesRepository>,
    impl?: () => Promise<void>,
  ) {
    const savePerguntaSemResposta = vi.fn(impl ?? (async () => undefined));
    return Object.assign(repository, { savePerguntaSemResposta });
  }

  async function postPergunta(deps: {
    repository: ReturnType<typeof salesRepository>;
    generator: ReplyGenerator;
    onboardingAgent?: ReturnType<typeof respondOnboardingAgent>;
  }) {
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const handlers = createWhatsappWebhookHandlers({
      env,
      repository: deps.repository,
      whatsapp,
      agent: salesAgent(),
      onboardingAgent: deps.onboardingAgent ?? respondOnboardingAgent(),
      replyGenerator: deps.generator,
    });
    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Voces atendem moto tambem?"),
        env.WHATSAPP_APP_SECRET,
      ),
    );
    return { response, whatsapp };
  }

  test("respond + dont_know (on): grava pergunta, enlatada ainda e enviada", async () => {
    const repository = withSavePergunta(oficinaRepository("on"));
    const { generator } = capturingGenerator(null, "dont_know");

    const { response, whatsapp } = await postPergunta({ repository, generator });

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: HANDOFF_ENLATADA,
    });
    expect(repository.savePerguntaSemResposta).toHaveBeenCalledWith({
      conversationId: "conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      agentMode: "operacao",
      pergunta: "Voces atendem moto tambem?",
      respostaEnviada: HANDOFF_ENLATADA,
      motivo: "dont_know",
      geracaoModo: "on",
      promptVersion: "cv2-2",
    });
    expect(replyGenerationCall(repository)?.output).toMatchObject({
      rejectionReason: "generation_dont_know",
    });
  });

  test("respond + dont_know em sombra tambem grava (sombra alimenta o volante)", async () => {
    const repository = withSavePergunta(oficinaRepository("sombra"));
    const { generator } = capturingGenerator(null, "dont_know");

    const { response } = await postPergunta({ repository, generator });

    expect(response.status).toBe(200);
    expect(repository.savePerguntaSemResposta).toHaveBeenCalledWith(
      expect.objectContaining({ geracaoModo: "sombra", motivo: "dont_know" }),
    );
  });

  test("erro do gerador NAO grava (so dont_know alimenta o volante)", async () => {
    const repository = withSavePergunta(oficinaRepository("on"));
    const { generator } = capturingGenerator(null, "error");

    const { response } = await postPergunta({ repository, generator });

    expect(response.status).toBe(200);
    expect(repository.savePerguntaSemResposta).not.toHaveBeenCalled();
  });

  test("rewrite + dont_know NAO grava (nao e pergunta sem resposta)", async () => {
    const repository = withSavePergunta(salesRepository("on"));
    const { generator } = makeGenerator(null, "dont_know");

    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
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
    expect(repository.savePerguntaSemResposta).not.toHaveBeenCalled();
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: ENLATADA,
    });
  });

  test("repositorio sem o metodo opcional: fluxo segue normal", async () => {
    const repository = oficinaRepository("on");
    const { generator } = capturingGenerator(null, "dont_know");

    const { response, whatsapp } = await postPergunta({ repository, generator });

    expect(response.status).toBe(200);
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: HANDOFF_ENLATADA,
    });
  });

  test("gravacao rejeitando e best-effort: resposta ainda e enviada", async () => {
    const repository = withSavePergunta(oficinaRepository("on"), async () => {
      throw new Error("insert failed");
    });
    const { generator } = capturingGenerator(null, "dont_know");

    const { response, whatsapp } = await postPergunta({ repository, generator });

    expect(response.status).toBe(200);
    expect(repository.savePerguntaSemResposta).toHaveBeenCalled();
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: HANDOFF_ENLATADA,
    });
  });
});

// --- CV3 (QTR-12): botões interativos + resumo de handoff ---------------------

describe("webhook — CV3 botões interativos no fallback nível 2 (vendas)", () => {
  const MENU_TEXT =
    "Pra eu te ajudar melhor chefe, escolhe uma:\n- Como funciona\n- Quanto custa\n- Ja quero testar";
  const BODY_TEXT = "Pra eu te ajudar melhor chefe, e so tocar numa opcao:";

  function buttonsSalesAgent() {
    return {
      generateReply: vi.fn(async () => ({
        body: MENU_TEXT,
        status: "em_conversa" as const,
        toolCalls: [],
        interactiveButtons: {
          bodyText: BODY_TEXT,
          buttons: [
            { id: "sales_fb_funcionamento", title: "Como funciona" },
            { id: "sales_fb_preco", title: "Quanto custa" },
            { id: "sales_fb_testar", title: "Quero testar" },
          ],
        },
      })),
    };
  }

  test("transporte com botões: envia interativo, não o texto; pula a geração", async () => {
    const repository = salesRepository("on");
    const sendInteractiveButtons = vi.fn(async () => ({ whatsappMessageId: "wamid.btn" }));
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.txt" })),
      sendInteractiveButtons,
    };
    const { generator, state } = makeGenerator("qualquer coisa gerada");

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: buttonsSalesAgent(),
      replyGenerator: generator,
    });
    const response = await handlers.POST(
      signedRequest(inboundPayload("asdf aleatorio"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(sendInteractiveButtons).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+5541999421180",
        body: BODY_TEXT,
        buttons: expect.arrayContaining([
          expect.objectContaining({ id: "sales_fb_preco" }),
        ]),
      }),
    );
    expect(whatsapp.sendTextMessage).not.toHaveBeenCalled();
    // Botão é determinístico: gerador não roda (allowGeneration = false).
    expect(state.calls).toBe(0);
    expect(replyGenerationCall(repository)).toBeUndefined();
    expect(repository.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Opções oferecidas:"),
      }),
    );
    expect(repository.createOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("[sales_fb_preco] Quanto custa"),
      }),
    );
  });

  test("transporte sem botões: degrada para o texto do menu", async () => {
    const repository = salesRepository("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.txt" })),
    };
    const { generator } = makeGenerator("qualquer coisa gerada");

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: buttonsSalesAgent(),
      replyGenerator: generator,
    });
    await handlers.POST(
      signedRequest(inboundPayload("asdf aleatorio"), env.WHATSAPP_APP_SECRET),
    );

    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: MENU_TEXT,
    });
  });
});

describe("webhook — CV3 resumo de handoff (vendas)", () => {
  function handoffSalesAgent() {
    return {
      generateReply: vi.fn(async () => ({
        body: "Chefe, vou te conectar com o Anderson: https://wa.me/5511945207618",
        status: "em_conversa" as const,
        toolCalls: [],
        handoffRequired: true,
        handoffReason: "preco_insistente",
      })),
    };
  }

  function repoWithHandoff(modo: GeracaoLlmModo) {
    return Object.assign(
      salesRepository(modo, {
        listRecentMessages: vi.fn(async () => [
          { direction: "inbound", body: "quanto custa mesmo?", sentAt: null },
        ]),
      }),
      { markConversationHandoff: vi.fn(async () => undefined) },
    );
  }

  test("mode on: gera e envia o resumo ao comercial (não ao lead)", async () => {
    const repository = repoWithHandoff("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.x" })),
    };
    const summarizer = {
      summarizeHandoff: vi.fn(async () => "Lead quer preco; insistiu 2x."),
    };
    const { generator } = makeGenerator(null);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: handoffSalesAgent(),
      replyGenerator: generator,
      handoffSummarizer: summarizer,
    });
    const response = await handlers.POST(
      signedRequest(inboundPayload("mas quanto custa??"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(summarizer.summarizeHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ handoffReason: "preco_insistente" }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+5511945207618",
        body: expect.stringContaining("Lead quer preco"),
      }),
    );
    // O lead recebeu a resposta de handoff normalmente.
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5541999421180" }),
    );
  });

  test("mode off: não gera resumo (comportamento anterior)", async () => {
    const repository = repoWithHandoff("off");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.x" })),
    };
    const summarizer = { summarizeHandoff: vi.fn(async () => "resumo") };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: handoffSalesAgent(),
      handoffSummarizer: summarizer,
    });
    await handlers.POST(
      signedRequest(inboundPayload("mas quanto custa??"), env.WHATSAPP_APP_SECRET),
    );

    expect(summarizer.summarizeHandoff).not.toHaveBeenCalled();
    expect(whatsapp.sendTextMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5511945207618" }),
    );
  });

  test("resumo lança -> handoff e resposta ao lead seguem (best-effort)", async () => {
    const repository = repoWithHandoff("on");
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.x" })),
    };
    const summarizer = {
      summarizeHandoff: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const { generator } = makeGenerator(null);

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: handoffSalesAgent(),
      replyGenerator: generator,
      handoffSummarizer: summarizer,
    });
    const response = await handlers.POST(
      signedRequest(inboundPayload("mas quanto custa??"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(repository.markConversationHandoff).toHaveBeenCalled();
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+5541999421180" }),
    );
  });
});
