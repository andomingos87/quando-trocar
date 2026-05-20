import { describe, expect, test } from "vitest";

import {
  WhatsappSalesAgent,
  classifySalesMessage,
  detectLeadOrigin,
  detectPain,
  detectPriceQuestion,
  detectScaleHandoff,
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
