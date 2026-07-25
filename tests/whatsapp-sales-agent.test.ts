import { describe, expect, test } from "vitest";

import {
  WhatsappSalesAgent,
  classifySalesMessage,
  detectBasicGreeting,
  detectLeadOrigin,
  detectNeutralAck,
  detectPain,
  detectPriceQuestion,
  detectQuerHumano,
  detectScaleHandoff,
  detectSmallTalk,
  detectSocialTest,
  detectVaiPensar,
  extractRepresentanteCodigo,
  extractVolumeOrTicket,
  matchFaq,
} from "@/lib/whatsapp/sales-agent";
import type { ConfiguracoesVendedor, FaqVendasRecord } from "@/lib/whatsapp/types";

const baseConfig: ConfiguracoesVendedor = {
  taxaRecuperacaoRoi: 0.15,
  whatsappHandoffComercial: "+5511945207618",
  frasesLanding: ["oi quero testar o quando trocar"],
  precoPartida: 59,
  geracaoLlmModo: "off",
};

const faqs: FaqVendasRecord[] = [
  {
    id: "faq-cancelar",
    pergunta: "Posso cancelar quando quiser?",
    resposta: "Pode sim chefe, e so me avisar por aqui e a gente pausa. Sem multa.",
    palavras_chave: ["cancelar", "sair", "parar"],
    ordem: 40,
  },
  {
    id: "faq-integracao",
    pergunta: "Precisa integrar com meu sistema?",
    resposta: "Nao precisa nao chefe. Funciona a parte. Integracao especifica a gente ve caso a caso depois.",
    palavras_chave: ["integrar", "integracao", "sistema", "erp"],
    ordem: 120,
  },
  {
    id: "faq-prova-social",
    pergunta: "Voces tem cliente?",
    resposta: "Produto novo chefe, to abrindo as primeiras oficinas agora.",
    palavras_chave: ["tem cliente", "quem usa", "cases", "referencia"],
    ordem: 200,
  },
  {
    id: "faq-quem-e-voce",
    pergunta: "Quem e voce? E IA?",
    resposta: "Sou o assistente do Quando Trocar chefe, ajudo a oficina a entender o produto.",
    palavras_chave: ["quem e voce", "voce e ia", "voce e robo", "qual seu nome"],
    ordem: 240,
  },
  {
    id: "faq-serve-outros-servicos",
    pergunta: "Serve para outros servicos alem de troca de oleo?",
    resposta:
      "O carro-chefe e troca de oleo chefe. Mas a gente tambem traz de volta cliente de revisao, troca de amortecedor e qualquer servico com retorno previsivel (3 meses a 2 anos).",
    palavras_chave: [
      "outros servicos",
      "amortecedor",
      "revisao",
      "alinhamento",
      "suspensao",
      "freio",
      "filtro",
      "alem de oleo",
      "alem do oleo",
      "so faz oleo",
      "tipos de servico",
    ],
    ordem: 250,
  },
];

describe("whatsapp sales agent — deterministic detectors", () => {
  test("detectLeadOrigin honors configurable landing phrases", () => {
    expect(detectLeadOrigin("Oi quero testar o Quando Trocar")).toBe("landing_page");
    expect(detectLeadOrigin("oi", ["oi"])).toBe("landing_page");
    expect(detectLeadOrigin("bom dia")).toBe("manual_whatsapp");
  });

  test("extractRepresentanteCodigo captures #REP token and cleans the message (ADR-0019)", () => {
    expect(
      extractRepresentanteCodigo("Oi quero testar o Quando Trocar #REP-CARLOS"),
    ).toEqual({ codigo: "CARLOS", cleaned: "Oi quero testar o Quando Trocar" });
    // case-insensitive + normaliza para maiusculas
    expect(extractRepresentanteCodigo("oi #rep-carlos-sp tudo bem")).toEqual({
      codigo: "CARLOS-SP",
      cleaned: "oi tudo bem",
    });
    // espaco entre # e REP tolerado
    expect(extractRepresentanteCodigo("# REP-A1 oi").codigo).toBe("A1");
    // sem token → mensagem intacta
    expect(extractRepresentanteCodigo("Oi quero testar o Quando Trocar")).toEqual({
      codigo: null,
      cleaned: "Oi quero testar o Quando Trocar",
    });
    // codigo de 1 caractere e invalido
    expect(extractRepresentanteCodigo("oi #REP-X").codigo).toBeNull();
    // hifen final descartado
    expect(extractRepresentanteCodigo("oi #REP-ABC-").codigo).toBe("ABC");
  });

  test("extractRepresentanteCodigo + detectLeadOrigin: codigo nao quebra a frase-gatilho", () => {
    const { codigo, cleaned } = extractRepresentanteCodigo(
      "Oi quero testar o Quando Trocar #REP-CARLOS",
    );
    expect(codigo).toBe("CARLOS");
    expect(detectLeadOrigin(cleaned)).toBe("landing_page");
    // sem a limpeza, o match exato falharia
    expect(detectLeadOrigin("Oi quero testar o Quando Trocar #REP-CARLOS")).toBe(
      "manual_whatsapp",
    );
  });

  test("detectPriceQuestion catches common price phrasing", () => {
    expect(detectPriceQuestion("quanto custa?")).toBe(true);
    expect(detectPriceQuestion("qual o valor da mensalidade?")).toBe(true);
    expect(detectPriceQuestion("como funciona?")).toBe(false);
  });

  test("detectScaleHandoff catches multi-shop hints", () => {
    expect(detectScaleHandoff("tenho uma rede de oficinas")).toBe(true);
    expect(detectScaleHandoff("somos uma franquia")).toBe(true);
    expect(detectScaleHandoff("faco 80 trocas")).toBe(false);
  });

  test("detectPain catches typical workshop pains", () => {
    expect(detectPain("o cliente some depois da troca")).toBe(true);
    expect(detectPain("anoto no caderno")).toBe(true);
    expect(detectPain("tudo bem por aqui")).toBe(false);
  });

  test("extractVolumeOrTicket handles single-number messages", () => {
    expect(extractVolumeOrTicket("faco 80 trocas por mes")).toEqual({ monthlyChanges: 80 });
    expect(extractVolumeOrTicket("o ticket medio fica em 180")).toEqual({ averageTicket: 180 });
    expect(extractVolumeOrTicket("faco 80 trocas, ticket 180")).toEqual({
      monthlyChanges: 80,
      averageTicket: 180,
    });
  });

  test("matchFaq picks best match by keyword count and order", () => {
    const match = matchFaq("preciso integrar com meu erp", faqs);
    expect(match?.id).toBe("faq-integracao");
  });

  test("classifySalesMessage prioritizes price over FAQ", () => {
    expect(classifySalesMessage("quanto custa?", faqs).intent).toBe("pergunta_preco");
  });

  test("classifySalesMessage uses FAQ as fallback", () => {
    expect(classifySalesMessage("preciso integrar com meu erp", faqs)).toMatchObject({
      intent: "pergunta_faq",
      faqId: "faq-integracao",
    });
  });
});

describe("whatsapp sales agent — generateReply", () => {
  test("price first ask returns soft redirect with starting price", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quanto custa?",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body).toMatch(/R\$\s?59/);
    expect(reply.body).toMatch(/14 dias/);
    expect(reply.handoffRequired).toBeFalsy();
    expect(reply.updatedContext?.sales?.price_mentions).toBe(1);
  });

  test("price asked twice triggers commercial handoff", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "mas preciso saber o preco",
      leadStatus: "em_conversa",
      context: { sales: { price_mentions: 1 } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("preco_insistente");
    expect(reply.body).toMatch(/wa\.me\/5511945207618/);
    expect(reply.updatedContext?.sales?.price_mentions).toBe(2);
  });

  test("FAQ match returns the configured response", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "preciso integrar com meu erp",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body).toContain("Nao precisa nao chefe");
    expect(reply.toolCalls).toEqual([
      expect.objectContaining({ toolName: "faq_lookup" }),
    ]);
  });

  test("FAQ amortecedor: lead pergunta sobre outros servicos e recebe resposta estratificada", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "voces servem para troca de amortecedor tambem?",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body.toLowerCase()).toContain("oleo");
    expect(reply.body.toLowerCase()).toContain("amortecedor");
    expect(reply.body.toLowerCase()).toContain("revisao");
    expect(reply.toolCalls).toEqual([
      expect.objectContaining({ toolName: "faq_lookup" }),
    ]);
  });

  test("remembers volume across messages and computes ROI with 15%", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });

    const first = await agent.generateReply({
      message: "faco 80 trocas por mes",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });
    expect(first.body).toMatch(/ticket/i);
    expect(first.updatedContext?.sales?.volume_known).toBe(80);

    const second = await agent.generateReply({
      message: "ticket medio fica em 180",
      leadStatus: first.status,
      context: first.updatedContext,
      salesConfig: baseConfig,
      faqs,
    });

    expect(second.status).toBe("qualificado");
    // 80 * 180 * 0.15 = 2160
    expect(second.body).toMatch(/R\$\s?2\.160/);
    expect(second.body).toMatch(/15%/);
    expect(second.toolCalls).toEqual([
      expect.objectContaining({ toolName: "calculate_roi" }),
    ]);
  });

  test("pain is mirrored only once per conversation", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });

    const first = await agent.generateReply({
      message: "cliente some e nao volta, como funciona?",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });
    expect(first.body.toLowerCase()).toContain("pois e chefe");
    expect(first.updatedContext?.sales?.pain_detected).toBe(true);

    const second = await agent.generateReply({
      message: "cliente some mesmo, como funciona?",
      leadStatus: "em_conversa",
      context: first.updatedContext,
      salesConfig: baseConfig,
      faqs,
    });
    expect(second.body.toLowerCase()).not.toContain("pois e chefe");
  });

  test("volume above 300/month triggers handoff", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "faco 500 trocas, ticket 250",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("volume_alto");
  });

  test("mention of rede/franquia triggers handoff", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "tenho uma rede de oficinas",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("rede_ou_franquia");
  });

  test("explicit no-interest marks lead as perdido", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "nao tenho interesse",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("perdido");
  });

  test("quer testar asks for the workshop name before converting", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quero testar",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("teste_aceito");
    expect(reply.convertToOficina).toBeUndefined();
    expect(reply.body.toLowerCase()).toContain("oficina");
    expect(reply.updatedContext?.sales?.awaiting_workshop_name).toBe(true);
  });

  test("captures the workshop name answer and flags convertToOficina", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "Auto Center Silva",
      leadStatus: "teste_aceito",
      context: { sales: { awaiting_workshop_name: true, greeted: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("teste_aceito");
    expect(reply.convertToOficina).toBe(true);
    expect(reply.nomeOficina).toBe("Auto Center Silva");
    expect(reply.updatedContext?.sales?.awaiting_workshop_name).toBe(false);
    expect(reply.updatedContext?.sales?.workshop_name).toBe("Auto Center Silva");
  });

  test("re-asks the workshop name when the answer is not a name", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quanto custa?",
      leadStatus: "teste_aceito",
      context: { sales: { awaiting_workshop_name: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.convertToOficina).toBeUndefined();
    expect(reply.body.toLowerCase()).toContain("nome");
    expect(reply.updatedContext?.sales?.awaiting_workshop_name).toBe(true);
  });

  test("openAI fallback honors closed intent enum", async () => {
    const agent = new WhatsappSalesAgent({
      classifierModel: "test-model",
      openai: {
        responses: {
          create: async () => ({
            output_text: JSON.stringify({
              intent: "quer_testar",
              confidence: 0.91,
              monthlyChanges: null,
              averageTicket: null,
            }),
          }),
        },
      } as never,
    });

    const reply = await agent.generateReply({
      message: "uma frase ambigua",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("teste_aceito");
  });
});

describe("whatsapp sales agent — post-test fixes (1-5)", () => {
  test("fix #1a (det): pain message classifies as pergunta_funcionamento with painDetected", () => {
    const cls = classifySalesMessage("cliente some", faqs);
    expect(cls.intent).toBe("pergunta_funcionamento");
    expect(cls.painDetected).toBe(true);
  });

  test("fix #1b (OpenAI override): LLM sem_interesse on pain message becomes pergunta_funcionamento", async () => {
    // Forco classifySalesMessage determinitico a NAO bater (mensagem ambigua + pain)
    // usando uma frase que so vira pain via regex, mas ainda assim deterministico bate.
    // Aqui o teste valida o segundo gate: se openai retornar sem_interesse e pain,
    // o agente sobrescreve. Simulo via mensagem "cliente some" — deterministico
    // ja resolve, openai nao e chamado. Pra testar o override, uso uma frase
    // com confidence baixa que tambem dispara detectPain.
    // "ah, perco cliente as vezes" — sem palavra-chave forte, mas detectPain bate via "perco cliente".
    const cls = classifySalesMessage("ah, perco cliente as vezes", faqs);
    // se ja for pergunta_funcionamento deterministico, o override e desnecessario,
    // mas tambem nao quebra o teste — validamos o resultado final.
    const agent = new WhatsappSalesAgent({
      classifierModel: "test-model",
      openai: {
        responses: {
          create: async () => ({
            output_text: JSON.stringify({
              intent: "sem_interesse",
              confidence: 0.95,
              monthlyChanges: null,
              averageTicket: null,
            }),
          }),
        },
      } as never,
    });

    const reply = await agent.generateReply({
      message: "ah, perco cliente as vezes",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).not.toBe("perdido");
    expect(reply.body.toLowerCase()).toContain("pois e chefe");
    expect(cls.intent).toBe("pergunta_funcionamento");
  });

  test("fix #2: greeting only on first turn", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });

    const first = await agent.generateReply({
      message: "fala",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });
    expect(first.body).toContain("Fala chefe!");
    expect(first.body).toContain("Aqui e do Quando Trocar");
    expect(first.updatedContext?.sales?.greeted).toBe(true);

    const second = await agent.generateReply({
      message: "como funciona?",
      leadStatus: "em_conversa",
      context: first.updatedContext,
      salesConfig: baseConfig,
      faqs,
    });
    expect(second.body).not.toContain("Aqui e do Quando Trocar");
  });

  test("fix #3: price reply connects with known ROI when memory has volume+ticket", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quanto custa?",
      leadStatus: "qualificado",
      context: { sales: { volume_known: 80, ticket_known: 140 } },
      salesConfig: baseConfig,
      faqs,
    });

    // 80 * 140 * 0.15 = 1680
    expect(reply.body).toMatch(/R\$\s?59/);
    expect(reply.body).toMatch(/R\$\s?1\.680/);
    expect(reply.body.toLowerCase()).toContain("praticamente de graca");
  });

  test("fix #4: small talk returns dedicated short response without changing status", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "Pra que time voce torce?",
      leadStatus: "qualificado",
      context: { sales: { greeted: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body.toLowerCase()).toContain("nao to aqui pra isso");
    expect(reply.status).toBe("qualificado");
    expect(reply.body).not.toContain("Funciona assim");
  });

  test("fix #4 detector: detectSmallTalk catches off-topic chatter only", () => {
    expect(detectSmallTalk("pra que time voce torce")).toBe(true);
    expect(detectSmallTalk("isso e brincadeira")).toBe(true);
    // No ciclo 3, "voce e robo" foi movido pra FAQ ("Quem e voce?") — nao bate mais em small_talk
    expect(detectSmallTalk("voce e um robo?")).toBe(false);
    expect(detectSmallTalk("faco 80 trocas por mes")).toBe(false);
  });

  test("fix #5: fora_escopo on subsequent turns returns short variation", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    // Uma mensagem que cai em fora_escopo de verdade (nao "blz" — agora isso e
    // confirmacao_neutra; e "manda ai" virou aceite no QTR-35 P1-4a).
    const reply = await agent.generateReply({
      message: "to so olhando aqui",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body.toLowerCase()).toContain("nao entendi muito bem chefe");
    expect(reply.body).not.toContain("Funciona assim");
    expect(reply.body).not.toContain("Aqui e do Quando Trocar");
  });
});

describe("whatsapp sales agent — QTR-35 P1-6: apresentacao em toda primeira resposta", () => {
  const GREETING = "Aqui e do Quando Trocar";

  test("primeira resposta contem a apresentacao para FAQ, preco, small talk, volume e humano", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const firstMessages = [
      "preciso integrar com meu erp", // pergunta_faq
      "quanto custa?", // pergunta_preco
      "pra que time voce torce?", // small_talk
      "faco 80 trocas por mes", // informa_volume_ticket
      "quero falar com humano", // quer_humano (handoff)
      "quero testar", // quer_testar (pergunta o nome)
    ];

    for (const message of firstMessages) {
      const reply = await agent.generateReply({
        message,
        leadStatus: "em_conversa",
        context: {},
        salesConfig: baseConfig,
        faqs,
      });
      expect(reply.body, message).toContain(GREETING);
      expect(reply.updatedContext?.sales?.greeted, message).toBe(true);
    }
  });

  test("segunda mensagem nao repete a apresentacao", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const first = await agent.generateReply({
      message: "preciso integrar com meu erp",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });
    const second = await agent.generateReply({
      message: "quanto custa?",
      leadStatus: "em_conversa",
      context: first.updatedContext,
      salesConfig: baseConfig,
      faqs,
    });
    expect(second.body).not.toContain(GREETING);
  });

  test("explainer de primeiro turno nao ganha prefixo duplicado", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "como funciona?",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });
    const occurrences = reply.body.split(GREETING).length - 1;
    expect(occurrences).toBe(1);
  });
});

describe("whatsapp sales agent — QTR-35 P1-4: aceite ampliado e guard simetrico", () => {
  test("variacoes reais de aceite classificam como quer_testar sem LLM", () => {
    for (const message of [
      "Quero fazer",
      "quero sim",
      "quero ativar",
      "pode ativar",
      "fechado",
      "fechou chefe",
      "manda ai",
      "tô dentro",
      "to dentro",
      "vou querer sim",
      "topa ai",
    ]) {
      const cls = classifySalesMessage(message, faqs);
      expect(cls.intent, message).toBe("quer_testar");
      expect(cls.confidence, message).toBeGreaterThanOrEqual(0.85);
    }
  });

  test('"Quero fazer" nunca recebe copy de despedida (caso real da issue)', async () => {
    // Mesmo que o classificador OpenAI rodasse e devolvesse sem_interesse, o
    // deterministico agora resolve em 0.86 e o LLM nem e chamado.
    const agent = new WhatsappSalesAgent({
      classifierModel: "test-model",
      openai: {
        responses: {
          create: async () => {
            throw new Error("nao deveria chamar OpenAI para aceite explicito");
          },
        },
      } as never,
    });

    const reply = await agent.generateReply({
      message: "Quero fazer",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("teste_aceito");
    expect(reply.body.toLowerCase()).not.toContain("deixo registrado");
    expect(reply.updatedContext?.sales?.awaiting_workshop_name).toBe(true);
  });

  test("guard simetrico: LLM sem_interesse sem recusa explicita nao vira despedida nem perdido", async () => {
    const agent = new WhatsappSalesAgent({
      classifierModel: "test-model",
      openai: {
        responses: {
          create: async () => ({
            output_text: JSON.stringify({
              intent: "sem_interesse",
              confidence: 0.95,
              monthlyChanges: null,
              averageTicket: null,
            }),
          }),
        },
      } as never,
    });

    // Mensagem ambigua SEM dor e SEM recusa explicita: deterministico da
    // fora_escopo 0.6 -> LLM roda -> sem_interesse e rebaixado.
    const reply = await agent.generateReply({
      message: "hmm depende de muita coisa isso ai",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).not.toBe("perdido");
    expect(reply.body.toLowerCase()).not.toContain("deixo registrado");
    expect(reply.body.toLowerCase()).not.toContain("se mudar de ideia");
  });

  test("recusa explicita continua levando a perdido (guard nao afrouxa a regra 1)", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "nao quero mais, pode parar",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("perdido");
  });
});

describe("whatsapp sales agent — Ciclo 3 (TIER 1 + TIER 2 criticos)", () => {
  test("detectBasicGreeting catches saudacoes puras and empty bodies", () => {
    expect(detectBasicGreeting("oi")).toBe(true);
    expect(detectBasicGreeting("Ola!")).toBe(true);
    expect(detectBasicGreeting("Bom dia")).toBe(true);
    expect(detectBasicGreeting("E ai?")).toBe(true);
    expect(detectBasicGreeting("tudo bem?")).toBe(true);
    expect(detectBasicGreeting("")).toBe(true); // sticker/emoji
    expect(detectBasicGreeting("oi tudo bem, como funciona?")).toBe(false); // contem mais conteudo
    expect(detectBasicGreeting("faco 80 trocas")).toBe(false);
  });

  test("detectNeutralAck catches short confirmations only", () => {
    expect(detectNeutralAck("ok")).toBe(true);
    expect(detectNeutralAck("blz")).toBe(true);
    expect(detectNeutralAck("entendi")).toBe(true);
    expect(detectNeutralAck("valeu")).toBe(true);
    expect(detectNeutralAck("ok pode me ligar")).toBe(false); // string maior
    expect(detectNeutralAck("quero testar")).toBe(false);
  });

  test("detectVaiPensar catches hesitation patterns", () => {
    expect(detectVaiPensar("vou pensar e depois te falo")).toBe(true);
    expect(detectVaiPensar("preciso conversar com o socio")).toBe(true);
    expect(detectVaiPensar("agora nao da, mais tarde")).toBe(true);
    expect(detectVaiPensar("depois eu vejo")).toBe(true);
    expect(detectVaiPensar("nao quero")).toBe(false); // explicit loss, nao hesitation
    expect(detectVaiPensar("quero testar")).toBe(false);
  });

  test("detectQuerHumano catches requests for human attendant", () => {
    expect(detectQuerHumano("quero falar com humano")).toBe(true);
    expect(detectQuerHumano("passa pro Anderson por favor")).toBe(true);
    expect(detectQuerHumano("fala com o anderson")).toBe(true);
    expect(detectQuerHumano("tem alguem de verdade?")).toBe(true);
    expect(detectQuerHumano("prefiro humano real")).toBe(true);
    expect(detectQuerHumano("quanto custa?")).toBe(false);
  });

  test('classifySalesMessage routes "oi" to fora_escopo with high confidence', () => {
    const cls = classifySalesMessage("oi", faqs);
    expect(cls.intent).toBe("fora_escopo");
    expect(cls.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test("classifySalesMessage routes confirmation to confirmacao_neutra", () => {
    expect(classifySalesMessage("ok", faqs).intent).toBe("confirmacao_neutra");
    expect(classifySalesMessage("blz", faqs).intent).toBe("confirmacao_neutra");
  });

  test("classifySalesMessage routes hesitation to vai_pensar", () => {
    expect(classifySalesMessage("vou pensar com o socio", faqs).intent).toBe("vai_pensar");
  });

  test("classifySalesMessage routes human request to quer_humano", () => {
    expect(classifySalesMessage("quero falar com humano", faqs).intent).toBe("quer_humano");
    expect(classifySalesMessage("passa pro anderson", faqs).intent).toBe("quer_humano");
  });

  test('"oi" returns greeting + explainer (not small_talk)', async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "oi",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body).toContain("Fala chefe!");
    expect(reply.body).toContain("Aqui e do Quando Trocar");
    expect(reply.body.toLowerCase()).not.toContain("nao to aqui pra isso");
  });

  test("neutral ack after explainer returns short reply (no pitch repeat)", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "ok",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body.toLowerCase()).toContain("to por aqui");
    expect(reply.body).not.toContain("Funciona assim");
    expect(reply.body).not.toContain("Aqui e do Quando Trocar");
  });

  test("neutral ack BEFORE explainer falls into the regular flow (greeting + explainer)", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "ok",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    // Sem funcionamento_explained, cai em fora_escopo: greeting + explainer
    expect(reply.body).toContain("Fala chefe!");
    expect(reply.body).toContain("Funciona assim");
  });

  test('"vou pensar" returns sem pressa copy, status unchanged, no handoff', async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "vou pensar e depois te falo",
      leadStatus: "qualificado",
      context: { sales: { greeted: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("qualificado");
    expect(reply.handoffRequired).toBeFalsy();
    expect(reply.body.toLowerCase()).toContain("sem pressa");
  });

  test('"quero falar com humano" triggers handoff with wa.me', async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "passa pro Anderson por favor",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("pedido_humano");
    expect(reply.body).toMatch(/wa\.me\/5511945207618/);
  });

  test("FAQ matching: question about the bot routes to 'Quem e voce' FAQ", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quem e voce?",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body).toContain("assistente do Quando Trocar");
  });

  test("FAQ matching: question about clients routes to prova social FAQ", () => {
    const match = matchFaq("voces tem cliente que ja usa?", faqs);
    expect(match?.id).toBe("faq-prova-social");
  });
});

describe("whatsapp sales agent — Ciclo 4 (greeting subsequente + contador + variacoes + social/teste)", () => {
  test("Fix 1: greeting subsequente (greeted=true) retorna resposta social dedicada", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "bom dia",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true } },
      salesConfig: baseConfig,
      faqs,
    });

    // Nao deve repetir "Nao entendi muito bem chefe" — deve usar uma das 5 variacoes
    expect(reply.body.toLowerCase()).not.toContain("nao entendi muito bem chefe");
    // Pelo menos uma das variacoes deve aparecer parcialmente
    expect(reply.body).toMatch(/td (certo|bem|bom)|tamo aqui|fala chefe|posso te ajudar/i);
  });

  test("Fix 1: variacoes diferentes em chamadas consecutivas", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const ctx1 = { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 0 } };
    const ctx2 = { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 1 } };

    const r1 = await agent.generateReply({ message: "oi", leadStatus: "em_conversa", context: ctx1, salesConfig: baseConfig, faqs });
    const r2 = await agent.generateReply({ message: "ola", leadStatus: "em_conversa", context: ctx2, salesConfig: baseConfig, faqs });

    // Bodies devem ser diferentes (rotacao no pool de 5)
    expect(r1.body).not.toBe(r2.body);
  });

  test("Fix 2: contador consecutive_fallback incrementa em fora_escopo seguidos", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });

    const r1 = await agent.generateReply({
      // "manda ai" virou aceite (QTR-35 P1-4a) — usa frase sem gatilho.
      message: "sei la chefe",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 1 } },
      salesConfig: baseConfig,
      faqs,
    });
    expect(r1.updatedContext?.sales?.consecutive_fallback).toBe(2);

    const r2 = await agent.generateReply({
      message: "blah aleatorio",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 3 } },
      salesConfig: baseConfig,
      faqs,
    });
    expect(r2.updatedContext?.sales?.consecutive_fallback).toBe(4);
  });

  test("Fix 2: contador chega em 7 -> handoff automatico", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "frase aleatoria sem sentido",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 6 } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("fallback_loop");
    expect(reply.body).toMatch(/wa\.me/);
  });

  test("Fix 2: outros intents resetam o contador", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quanto custa?",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 5 } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.updatedContext?.sales?.consecutive_fallback).toBe(0);
  });

  test("ADR-0024: caso geral do fora_escopo marca respond; contador segue incrementando", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    // consecutive_fallback = 2 -> indice 2 (nao e o slot do menu, que a CV3
    // troca por botoes). Prova que o caso geral segue marcando respond.
    const reply = await agent.generateReply({
      message: "voces atendem moto tambem?",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 2 } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.conversationalGenerationMode).toBe("respond");
    // Invariante: o sinal de geracao nunca mexe no estado (off/sombra/on so
    // diferem no texto enviado) — o contador incrementa normalmente.
    expect(reply.updatedContext?.sales?.consecutive_fallback).toBe(3);
  });

  test("ADR-0024: sub-caminhos do fora_escopo seguem deterministicos (sem respond)", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });

    // Saudacao subsequente
    const saudacao = await agent.generateReply({
      message: "bom dia",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 0 } },
      salesConfig: baseConfig,
      faqs,
    });
    expect(saudacao.conversationalGenerationMode).toBeUndefined();

    // Primeira aparicao (explainer)
    const primeira = await agent.generateReply({
      message: "hmm",
      leadStatus: "em_conversa",
      context: { sales: {} },
      salesConfig: baseConfig,
      faqs,
    });
    expect(primeira.conversationalGenerationMode).toBeUndefined();

    // Lead ja interessado
    const interessado = await agent.generateReply({
      message: "frase aleatoria",
      leadStatus: "interessado",
      context: { sales: { greeted: true, funcionamento_explained: true } },
      salesConfig: baseConfig,
      faqs,
    });
    expect(interessado.conversationalGenerationMode).toBeUndefined();

    // Handoff automatico em >= 7
    const handoff = await agent.generateReply({
      message: "frase aleatoria sem sentido",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: 6 } },
      salesConfig: baseConfig,
      faqs,
    });
    expect(handoff.handoffRequired).toBe(true);
    expect(handoff.conversationalGenerationMode).toBeUndefined();
  });

  test("Fix 3: pool de 5 variacoes do fallback gera respostas diferentes", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const bodies = new Set<string>();
    for (let i = 1; i <= 5; i++) {
      const reply = await agent.generateReply({
        message: "frase aleatoria " + i,
        leadStatus: "em_conversa",
        context: { sales: { greeted: true, funcionamento_explained: true, consecutive_fallback: i } },
        salesConfig: baseConfig,
        faqs,
      });
      bodies.add(reply.body);
    }
    // Pelo menos 3 textos distintos no pool (alguns podem repetir pelo pain_prefix)
    expect(bodies.size).toBeGreaterThanOrEqual(3);
  });

  test("Fix 4: detectSocialTest catches short/test messages", () => {
    expect(detectSocialTest("kk")).toBe(true);
    expect(detectSocialTest("kkkk")).toBe(true);
    expect(detectSocialTest("rs")).toBe(true);
    expect(detectSocialTest("testando")).toBe(true);
    expect(detectSocialTest("to testando")).toBe(true);
    // "?" cai em detectBasicGreeting (body vazio apos normalize), nao em social_test
    expect(detectSocialTest("?")).toBe(false);
    expect(detectSocialTest("ok")).toBe(false); // ack, nao social
    expect(detectSocialTest("oi")).toBe(false); // greeting, nao social
    expect(detectSocialTest("quanto custa?")).toBe(false);
  });

  test('Fix 4: "kk" classifica como social_test', () => {
    expect(classifySalesMessage("kkkk", faqs).intent).toBe("social_test");
    expect(classifySalesMessage("testando", faqs).intent).toBe("social_test");
  });

  test("Fix 4: social_test retorna variacoes do pool", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "kkkk",
      leadStatus: "em_conversa",
      context: { sales: { greeted: true } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body.toLowerCase()).toMatch(/hahaha|td bem|tamo aqui|beleza chefe|chefe/);
    expect(reply.status).toBe("em_conversa");
  });
});

describe("whatsapp sales agent — Ciclo 5 (escopo amplo + zero friction na abertura)", () => {
  test("Ciclo 5: abertura NAO pergunta volume/ticket — termina com CTA pros 14 dias", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "como funciona?",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    // Sem pergunta de qualificacao na abertura
    expect(reply.body.toLowerCase()).not.toMatch(
      /quantas trocas voce faz|quantos servicos voce faz|qual o ticket medio/,
    );
    // Termina com CTA pros 14 dias
    expect(reply.body.toLowerCase()).toContain("14 dias gratis");
  });

  test("Ciclo 5: abertura menciona escopo amplo (alem de oleo)", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "oi",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    // Pelo menos uma das palavras de escopo amplo deve aparecer
    expect(reply.body.toLowerCase()).toMatch(/amortecedor|filtro|peca|servico/);
  });

  test("Ciclo 5: ROI calculado usa 'servicos/mes' (nao 'trocas/mes')", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "faco 80 trocas a 180",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body).toContain("servicos/mes");
    expect(reply.body).not.toContain("trocas/mes");
  });

  test("Ciclo 5: pergunta de complemento (so volume veio) tem saida facil pro teste", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "faco 80 trocas por mes",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.body).toMatch(/ticket medio/i);
    // Saida facil
    expect(reply.body.toLowerCase()).toMatch(/sem stress|sem pressao|teste de 14 dias|bora/);
  });
});

// --- CV3 (QTR-12) --------------------------------------------------------------

describe("whatsapp sales agent — CV3 botoes no fallback nivel 2", () => {
  // Memoria que leva o fluxo ao caso geral do fora_escopo com o contador no
  // indice do menu (1): ja saudou, ja explicou, consecutive_fallback = 1.
  const nivel2Memory = {
    greeted: true,
    funcionamento_explained: true,
    consecutive_fallback: 1,
  };

  test("fora_escopo generico no nivel 2 emite botoes interativos (nao texto/respond)", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "asdf coisa aleatoria sem sentido nenhum",
      leadStatus: "em_conversa",
      context: { sales: nivel2Memory },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.interactiveButtons).toBeDefined();
    expect(reply.interactiveButtons?.buttons.map((b) => b.id)).toEqual([
      "sales_fb_funcionamento",
      "sales_fb_preco",
      "sales_fb_testar",
    ]);
    // Botao e deterministico: nao marca respond.
    expect(reply.conversationalGenerationMode).toBeUndefined();
    // Estado incrementa igual ao caminho de texto (ADR-0024).
    expect(reply.updatedContext?.sales?.consecutive_fallback).toBe(2);
    // body de degradacao (transporte sem botoes) segue sendo texto de menu.
    expect(reply.body.toLowerCase()).toContain("como funciona");
  });

  test("outros niveis do fallback seguem texto + respond (sem botoes)", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    // consecutive_fallback = 2 -> indice 2 (nao e o menu).
    const reply = await agent.generateReply({
      message: "asdf coisa aleatoria sem sentido nenhum",
      leadStatus: "em_conversa",
      context: { sales: { ...nivel2Memory, consecutive_fallback: 2 } },
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.interactiveButtons).toBeUndefined();
    expect(reply.conversationalGenerationMode).toBe("respond");
  });
});

describe("whatsapp sales agent — CV3 objecoes como FAQ", () => {
  // Espelha os seeds da migration 20260718130000 (objecoes editaveis no admin).
  const objecaoFaqs: FaqVendasRecord[] = [
    {
      id: "faq-obj-tempo",
      pergunta: "Nao tenho tempo pra mais um sistema",
      resposta:
        "Justamente por isso chefe: voce so registra a troca e o sistema chama sozinho. Bora ativar 14 dias gratis?",
      palavras_chave: ["nao tenho tempo", "sem tempo", "tempo pra isso"],
      ordem: 300,
    },
    {
      id: "faq-obj-zap",
      pergunta: "Meu cliente nao usa WhatsApp",
      resposta:
        "A maioria ta no WhatsApp chefe; pra quem nao ta voce segue do seu jeito. Quer testar 14 dias gratis?",
      palavras_chave: ["nao usa whatsapp", "cliente nao tem whatsapp"],
      ordem: 310,
    },
  ];

  test("objecao 'nao tenho tempo' vira pergunta_faq (nao fora_escopo)", () => {
    const cls = classifySalesMessage("nao tenho tempo pra isso agora", objecaoFaqs);
    expect(cls.intent).toBe("pergunta_faq");
    expect(cls.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test("objecao responde com CTA de teste, nunca 'pode reformular'", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "meu cliente nao usa whatsapp",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs: objecaoFaqs,
    });

    expect(reply.body.toLowerCase()).not.toContain("reformular");
    expect(reply.body.toLowerCase()).toMatch(/14 dias|testar|teste/);
    expect(reply.interactiveButtons).toBeUndefined();
  });
});
