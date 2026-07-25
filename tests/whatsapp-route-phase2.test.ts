import { createHmac } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { createWhatsappWebhookHandlers } from "@/lib/whatsapp/webhook-handler";

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
                {
                  profile: { name: "Oficina Teste" },
                  wa_id: "5541999421180",
                },
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

function phase2Repository(overrides: Record<string, unknown> = {}) {
  return {
    saveWhatsappEvent: vi.fn(async () => ({ duplicate: false, eventId: "event-id" })),
    getOficinaByWhatsapp: vi.fn(async () => null),
    getConversationByWhatsapp: vi.fn(async () => null),
    upsertLead: vi.fn(async () => ({
      id: "lead-id",
      status: "em_conversa" as const,
      nome: "Oficina Teste",
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
    upsertOficinaConversation: vi.fn(async () => ({
      id: "conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      agentMode: "onboarding" as const,
      participantType: "oficina_cliente" as const,
      context: {},
    })),
    convertLeadToOficina: vi.fn(async () => ({
      oficinaId: "oficina-id",
      nome: "Oficina sem nome",
      diasLembretePadrao: 90,
    })),
    updateOficinaNome: vi.fn(async () => undefined),
    registerServiceWithReminder: vi.fn(async () => ({
      clienteId: "cliente-id",
      veiculoId: "veiculo-id",
      servicoId: "servico-id",
      lembreteId: "lembrete-id",
      // `troca_oleo`: 90 dias sobre a data do serviço (2026-04-25 nos casos).
      scheduledAt: "2026-07-24T00:00:00.000Z",
      diasLembrete: 90,
    })),
    upsertClienteFinalConversation: vi.fn(async () => ({
      id: "cliente-conversation-id",
      leadId: null,
      oficinaId: "oficina-id",
      clienteId: "cliente-id",
      participantType: "cliente_final" as const,
      agentMode: "cliente_final_lembrete" as const,
      context: {},
    })),
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

describe("whatsapp webhook phase 2", () => {
  const env = {
    WHATSAPP_VERIFY_TOKEN: "verify-token",
    WHATSAPP_APP_SECRET: "app-secret",
  };

  test("converts a lead to an onboarding workshop when the sales agent accepts a test", async () => {
    const repository = phase2Repository();
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Perfeito.",
        status: "teste_aceito" as const,
        convertToOficina: true,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("quero testar"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(repository.convertLeadToOficina).toHaveBeenCalledWith({
      leadId: "lead-id",
      conversationId: "conversation-id",
      whatsapp: "+5541999421180",
      responsavel: "Oficina Teste",
      nomeOficina: null,
    });
    expect(repository.saveAgentToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "convert_lead_to_oficina",
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: expect.stringContaining("Pronto, sua oficina esta cadastrada."),
    });
  });

  test("personalizes the conversion confirmation with the workshop name", async () => {
    const repository = phase2Repository({
      convertLeadToOficina: vi.fn(async () => ({
        oficinaId: "oficina-id",
        nome: "Auto Center Silva",
        diasLembretePadrao: 90,
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const agent = {
      generateReply: vi.fn(async () => ({
        body: "Perfeito.",
        status: "teste_aceito" as const,
        convertToOficina: true,
        nomeOficina: "Auto Center Silva",
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("Auto Center Silva"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(repository.convertLeadToOficina).toHaveBeenCalledWith(
      expect.objectContaining({ nomeOficina: "Auto Center Silva" }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: expect.stringContaining("a Auto Center Silva esta cadastrada"),
    });
  });

  test("asks for the workshop name when the oficina has the placeholder name", async () => {
    const repository = phase2Repository({
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Oficina sem nome",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
      upsertOficinaConversation: vi.fn(async () => ({
        id: "conversation-id",
        leadId: null,
        oficinaId: "oficina-id",
        agentMode: "onboarding" as const,
        participantType: "oficina_cliente" as const,
        context: {},
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const onboardingAgent = { generateReply: vi.fn() };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      onboardingAgent,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    // Não processa o cadastro enquanto não souber o nome da oficina.
    expect(onboardingAgent.generateReply).not.toHaveBeenCalled();
    expect(repository.updateConversationModeAndContext).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ awaiting_workshop_name: true }),
      }),
    );
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: expect.stringContaining("nome da sua oficina"),
    });
  });

  test("saves the workshop name answer during backfill", async () => {
    const repository = phase2Repository({
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Oficina sem nome",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
      upsertOficinaConversation: vi.fn(async () => ({
        id: "conversation-id",
        leadId: null,
        oficinaId: "oficina-id",
        agentMode: "onboarding" as const,
        participantType: "oficina_cliente" as const,
        context: { awaiting_workshop_name: true },
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const onboardingAgent = { generateReply: vi.fn() };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      onboardingAgent,
    });

    const response = await handlers.POST(
      signedRequest(inboundPayload("Auto Center Silva"), env.WHATSAPP_APP_SECRET),
    );

    expect(response.status).toBe(200);
    expect(repository.updateOficinaNome).toHaveBeenCalledWith({
      oficinaId: "oficina-id",
      nome: "Auto Center Silva",
    });
    expect(repository.updateConversationModeAndContext).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ awaiting_workshop_name: false }),
      }),
    );
    expect(onboardingAgent.generateReply).not.toHaveBeenCalled();
  });

  test("registers the first service for an active workshop and moves onboarding to operation", async () => {
    const repository = phase2Repository({
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Auto Center Silva",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
    };
    const onboardingAgent = {
      generateReply: vi.fn(async () => ({
        body: "",
        context: {},
        registerServiceInput: {
          nomeCliente: "Joao",
          whatsappCliente: "+5541999990000",
          veiculo: "Civic 2018",
          servico: "troca de oleo",
          dataServico: "2026-04-25",
          valor: null,
          consentimentoWhatsapp: true,
          tipoServico: "troca_oleo" as const,
          marcaPeca: null,
        },
        nextAgentMode: "operacao" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      onboardingAgent,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(repository.registerServiceWithReminder).toHaveBeenCalledWith({
      oficinaId: "oficina-id",
      nomeCliente: "Joao",
      whatsappCliente: "+5541999990000",
      veiculo: "Civic 2018",
      servico: "troca de oleo",
      dataServico: "2026-04-25",
      valor: null,
      consentimentoWhatsapp: true,
      tipoServico: "troca_oleo",
      marcaPeca: null,
    });
    expect(repository.updateConversationModeAndContext).toHaveBeenCalledWith({
      conversationId: "conversation-id",
      agentMode: "operacao",
      context: {},
    });
    // QTR-35 P0-3: a copy informa a DATA que o RPC agendou, não os dias de
    // `oficinas.dias_lembrete_padrao` (que divergiam da cadência do tipo).
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body: "Cliente cadastrado. Vou lembrar o Joao em 24/07/2026 pra voltar com você.",
    });
  });

  test("sends a confirmation template to the customer when consent is given", async () => {
    const repository = phase2Repository({
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Auto Center Silva",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
      sendTemplateMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.tmpl-1" })),
    };
    const onboardingAgent = {
      generateReply: vi.fn(async () => ({
        body: "",
        context: {},
        registerServiceInput: {
          nomeCliente: "Joao",
          whatsappCliente: "+5541999990000",
          veiculo: "Civic 2018",
          servico: "troca de oleo",
          dataServico: "2026-04-25",
          valor: null,
          consentimentoWhatsapp: true,
          tipoServico: "troca_oleo" as const,
          marcaPeca: null,
        },
        nextAgentMode: "operacao" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      onboardingAgent,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(repository.upsertClienteFinalConversation).toHaveBeenCalledWith({
      oficinaId: "oficina-id",
      clienteId: "cliente-id",
      whatsapp: "+5541999990000",
    });
    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith({
      to: "+5541999990000",
      templateName: "confirmacao_servico",
      languageCode: "pt_BR",
      bodyParameters: ["Joao", "óleo", "Civic 2018", "Auto Center Silva"],
      bodyParameterNames: ["nome", "produto", "carro", "oficina"],
    });
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body:
        "Cliente cadastrado. Vou lembrar o Joao em 24/07/2026 pra voltar com você. Já avisei o Joao que o serviço foi registrado.",
    });
  });

  test("envia o botão wa.me da oficina na confirmação quando o flag está ativo (ADR-0018)", async () => {
    vi.stubEnv("WHATSAPP_CONFIRMACAO_BUTTON_WA_ME", "true");
    try {
      const getOficinaById = vi.fn(async () => ({
        id: "oficina-id",
        nome: "Auto Center Silva",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      }));
      const repository = phase2Repository({
        getOficinaByWhatsapp: vi.fn(async () => ({
          id: "oficina-id",
          nome: "Auto Center Silva",
          whatsappPrincipal: "+5541999421180",
          diasLembretePadrao: 90,
        })),
        getOficinaById,
      });
      const whatsapp = {
        sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
        sendTemplateMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.tmpl-1" })),
      };
      const onboardingAgent = {
        generateReply: vi.fn(async () => ({
          body: "",
          context: {},
          registerServiceInput: {
            nomeCliente: "Joao",
            whatsappCliente: "+5541999990000",
            veiculo: "Civic 2018",
            servico: "troca de oleo",
            dataServico: "2026-04-25",
            valor: null,
            consentimentoWhatsapp: true,
            tipoServico: "troca_oleo" as const,
            marcaPeca: null,
          },
          nextAgentMode: "operacao" as const,
          toolCalls: [],
        })),
      };

      const handlers = createWhatsappWebhookHandlers({
        env,
        repository,
        whatsapp,
        agent: { generateReply: vi.fn() },
        onboardingAgent,
      });

      const response = await handlers.POST(
        signedRequest(
          inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
          env.WHATSAPP_APP_SECRET,
        ),
      );

      expect(response.status).toBe(200);
      expect(getOficinaById).toHaveBeenCalledWith({ oficinaId: "oficina-id" });
      expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith(
        expect.objectContaining({ urlButtonParameter: "5541999421180" }),
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("does not message the customer without consent", async () => {
    const repository = phase2Repository({
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Auto Center Silva",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
      // Sem consentimento o RPC não insere em `lembretes`: `scheduled_at` volta
      // null (QTR-35 P0-3, achado E).
      registerServiceWithReminder: vi.fn(async () => ({
        clienteId: "cliente-id",
        veiculoId: "veiculo-id",
        servicoId: "servico-id",
        lembreteId: null,
        scheduledAt: null,
        diasLembrete: 90,
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
      sendTemplateMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.tmpl-1" })),
    };
    const onboardingAgent = {
      generateReply: vi.fn(async () => ({
        body: "",
        context: {},
        registerServiceInput: {
          nomeCliente: "Joao",
          whatsappCliente: "+5541999990000",
          veiculo: "Civic 2018",
          servico: "troca de oleo",
          dataServico: "2026-04-25",
          valor: null,
          consentimentoWhatsapp: false,
          tipoServico: "troca_oleo" as const,
          marcaPeca: null,
        },
        nextAgentMode: "operacao" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      onboardingAgent,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    expect(whatsapp.sendTemplateMessage).not.toHaveBeenCalled();
    expect(repository.upsertClienteFinalConversation).not.toHaveBeenCalled();
    // Sem lembrete agendado o bot NÃO promete aviso — antes prometia "em 90
    // dias" um lembrete que nunca seria enviado (QTR-35 P0-3, achado E).
    expect(whatsapp.sendTextMessage).toHaveBeenCalledWith({
      to: "+5541999421180",
      body:
        "Cliente cadastrado. Como não tem autorização de WhatsApp, não vou mandar lembrete pro Joao.",
    });
  });
  // QTR-35 P0-3: a data do ack tem de ser a MESMA que está em
  // `lembretes.scheduled_at`. Antes o texto vinha de
  // `oficinas.dias_lembrete_padrao` (90) enquanto o RPC agendava pela cadência
  // do tipo — `amortecedor` = 730 dias — e o bot prometia 90 tendo gravado 730.
  test("informa a data que o RPC agendou, em toda cadência de tipo_servico", async () => {
    const casos = [
      { tipoServico: "troca_oleo" as const, dias: 90, scheduledAt: "2026-07-24T00:00:00+00", esperado: "24/07/2026" },
      { tipoServico: "amortecedor" as const, dias: 730, scheduledAt: "2028-04-24T00:00:00+00", esperado: "24/04/2028" },
      { tipoServico: "revisao" as const, dias: 180, scheduledAt: "2026-10-22T00:00:00+00", esperado: "22/10/2026" },
      { tipoServico: "outro" as const, dias: 180, scheduledAt: "2026-10-22T00:00:00+00", esperado: "22/10/2026" },
    ];

    for (const caso of casos) {
      const repository = phase2Repository({
        getOficinaByWhatsapp: vi.fn(async () => ({
          id: "oficina-id",
          nome: "Auto Center Silva",
          whatsappPrincipal: "+5541999421180",
          // Config da oficina propositalmente diferente da cadência do tipo:
          // se a copy voltar a ler daqui, o teste quebra.
          diasLembretePadrao: 90,
        })),
        registerServiceWithReminder: vi.fn(async () => ({
          clienteId: "cliente-id",
          veiculoId: "veiculo-id",
          servicoId: "servico-id",
          lembreteId: "lembrete-id",
          scheduledAt: caso.scheduledAt,
          diasLembrete: caso.dias,
        })),
      });
      const whatsapp = {
        sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
        sendTemplateMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.tmpl-1" })),
      };
      const onboardingAgent = {
        generateReply: vi.fn(async () => ({
          body: "",
          context: {},
          registerServiceInput: {
            nomeCliente: "Joao",
            whatsappCliente: "+5541999990000",
            veiculo: "Civic 2018",
            servico: "troca de oleo",
            dataServico: "2026-04-25",
            valor: null,
            consentimentoWhatsapp: true,
            tipoServico: caso.tipoServico,
            marcaPeca: caso.tipoServico === "amortecedor" ? ("perfect" as const) : null,
          },
          nextAgentMode: "operacao" as const,
          toolCalls: [],
        })),
      };

      const handlers = createWhatsappWebhookHandlers({
        env,
        repository,
        whatsapp,
        agent: { generateReply: vi.fn() },
        onboardingAgent,
      });

      const response = await handlers.POST(
        signedRequest(
          inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
          env.WHATSAPP_APP_SECRET,
        ),
      );

      expect(response.status, caso.tipoServico).toBe(200);
      const sent = whatsapp.sendTextMessage.mock.calls.at(0)?.at(0) as
        | { body: string }
        | undefined;
      expect(sent?.body, caso.tipoServico).toContain(caso.esperado);
      // Nunca volta a falar em "N dias" — número de dias não é conferível pela
      // oficina e foi o que escondeu a divergência de 8x.
      expect(sent?.body, caso.tipoServico).not.toMatch(/\d+\s*dias/);
    }
  });

  // Lição 0002: o código sobe por push na main, as migrations são aplicadas à
  // parte. Na janela entre os dois o RPC antigo não devolve `scheduled_at` —
  // e existe lembrete. O ack não pode inventar data nem negar o lembrete.
  test("RPC sem scheduled_at (migration pendente) não inventa data nem nega lembrete", async () => {
    const repository = phase2Repository({
      getOficinaByWhatsapp: vi.fn(async () => ({
        id: "oficina-id",
        nome: "Auto Center Silva",
        whatsappPrincipal: "+5541999421180",
        diasLembretePadrao: 90,
      })),
      registerServiceWithReminder: vi.fn(async () => ({
        clienteId: "cliente-id",
        veiculoId: "veiculo-id",
        servicoId: "servico-id",
        lembreteId: "lembrete-id",
        scheduledAt: null,
        diasLembrete: 90,
      })),
    });
    const whatsapp = {
      sendTextMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.out-1" })),
      sendTemplateMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.tmpl-1" })),
    };
    const onboardingAgent = {
      generateReply: vi.fn(async () => ({
        body: "",
        context: {},
        registerServiceInput: {
          nomeCliente: "Joao",
          whatsappCliente: "+5541999990000",
          veiculo: "Civic 2018",
          servico: "troca de oleo",
          dataServico: "2026-04-25",
          valor: null,
          consentimentoWhatsapp: true,
          tipoServico: "troca_oleo" as const,
          marcaPeca: null,
        },
        nextAgentMode: "operacao" as const,
        toolCalls: [],
      })),
    };

    const handlers = createWhatsappWebhookHandlers({
      env,
      repository,
      whatsapp,
      agent: { generateReply: vi.fn() },
      onboardingAgent,
    });

    const response = await handlers.POST(
      signedRequest(
        inboundPayload("Joao, Civic 2018, troca de oleo hoje, 41999990000"),
        env.WHATSAPP_APP_SECRET,
      ),
    );

    expect(response.status).toBe(200);
    const sent = whatsapp.sendTextMessage.mock.calls.at(0)?.at(0) as
      | { body: string }
      | undefined;
    expect(sent?.body).toContain("quando estiver na hora de voltar");
    expect(sent?.body).not.toMatch(/\d+\s*dias/);
    expect(sent?.body).not.toContain("autorização");
  });
});
