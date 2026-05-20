import { describe, expect, test } from "vitest";

import {
  classifySupportMessage,
  WhatsappSupportAgent,
} from "@/lib/whatsapp/support-agent";

describe("whatsapp support agent", () => {
  test("classifies bug keywords deterministically with handoff", async () => {
    const agent = new WhatsappSupportAgent({ openai: null });

    const reply = await agent.generateReply({
      message: "esta travando quando tento cadastrar cliente",
      context: {},
      oficinaNome: "Auto Center Silva",
    });

    expect(reply.intent).toBe("bug_ou_travamento");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("bug_ou_travamento");
  });

  test("classifies how-to question as duvida_uso without handoff", async () => {
    const agent = new WhatsappSupportAgent({ openai: null });

    const reply = await agent.generateReply({
      message: "como cadastro um novo cliente?",
      context: {},
      oficinaNome: null,
    });

    expect(reply.intent).toBe("duvida_uso");
    expect(reply.handoffRequired).toBe(false);
    expect(reply.handoffReason).toBeNull();
  });

  test("classifies billing question with handoff", () => {
    const result = classifySupportMessage("qual o valor da mensalidade?");
    expect(result.intent).toBe("cobranca");
  });

  test("ambiguous message goes to outro with handoff", async () => {
    const agent = new WhatsappSupportAgent({ openai: null });

    const reply = await agent.generateReply({
      message: "blz",
      context: {},
      oficinaNome: null,
    });

    expect(reply.intent).toBe("outro");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("mensagem_ambigua");
  });

  test("falls back to OpenAI when deterministic confidence is low", async () => {
    const agent = new WhatsappSupportAgent({
      classifierModel: "test-model",
      openai: {
        responses: {
          create: async () => ({
            output_text: JSON.stringify({
              intent: "duvida_uso",
              confidence: 0.9,
            }),
          }),
        },
      } as never,
    });

    const reply = await agent.generateReply({
      message: "tenho uma pergunta",
      context: {},
      oficinaNome: null,
    });

    expect(reply.intent).toBe("duvida_uso");
    expect(reply.handoffRequired).toBe(false);
  });
});
