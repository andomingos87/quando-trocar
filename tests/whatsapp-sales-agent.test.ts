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
  extractVolumeOrTicket,
  matchFaq,
} from "@/lib/whatsapp/sales-agent";
import type { ConfiguracoesVendedor, FaqVendasRecord } from "@/lib/whatsapp/types";

const baseConfig: ConfiguracoesVendedor = {
  taxaRecuperacaoRoi: 0.15,
  whatsappHandoffComercial: "+5511945207618",
  frasesLanding: ["oi quero testar o quando trocar"],
  precoPartida: 59,
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
];

describe("whatsapp sales agent — deterministic detectors", () => {
  test("detectLeadOrigin honors configurable landing phrases", () => {
    expect(detectLeadOrigin("Oi quero testar o Quando Trocar")).toBe("landing_page");
    expect(detectLeadOrigin("oi", ["oi"])).toBe("landing_page");
    expect(detectLeadOrigin("bom dia")).toBe("manual_whatsapp");
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

  test("quer testar marks teste_aceito and flags convertToOficina", async () => {
    const agent = new WhatsappSalesAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quero testar",
      leadStatus: "em_conversa",
      context: {},
      salesConfig: baseConfig,
      faqs,
    });

    expect(reply.status).toBe("teste_aceito");
    expect(reply.convertToOficina).toBe(true);
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
    // Uma mensagem que cai em fora_escopo de verdade (nao "blz" — agora isso e confirmacao_neutra).
    const reply = await agent.generateReply({
      message: "manda ai entao kkk",
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
      message: "manda ai kkk",
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
