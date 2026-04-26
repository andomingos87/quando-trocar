import { describe, expect, test } from "vitest";

import { WhatsappOnboardingAgent } from "@/lib/whatsapp/onboarding-agent";
import type { ConversationContext } from "@/lib/whatsapp/types";

describe("WhatsappOnboardingAgent", () => {
  test("extracts a complete service registration from the workshop example format", async () => {
    const agent = new WhatsappOnboardingAgent({ openai: null });

    const result = await agent.generateReply({
      message: "Joao, Civic 2018, troca de oleo hoje, 41999990000",
      mode: "onboarding",
      context: {},
      today: "2026-04-25",
    });

    expect(result.registerServiceInput).toEqual({
      nomeCliente: "Joao",
      whatsappCliente: "+5541999990000",
      veiculo: "Civic 2018",
      servico: "troca de oleo",
      dataServico: "2026-04-25",
      valor: null,
      consentimentoWhatsapp: true,
    });
    expect(result.context).toEqual({});
    expect(result.nextAgentMode).toBe("operacao");
  });

  test("asks only for the missing WhatsApp and stores the service draft", async () => {
    const agent = new WhatsappOnboardingAgent({ openai: null });

    const result = await agent.generateReply({
      message: "Joao, Civic 2018, troca de oleo hoje",
      mode: "onboarding",
      context: {},
      today: "2026-04-25",
    });

    expect(result.body).toBe("Qual é o WhatsApp do cliente?");
    expect(result.registerServiceInput).toBeNull();
    expect(result.context).toEqual({
      pending_action: "registrar_primeira_troca",
      missing_field: "whatsapp_cliente",
      service_draft: {
        nome_cliente: "Joao",
        veiculo: "Civic 2018",
        servico: "troca de oleo",
        data_servico: "2026-04-25",
        valor: null,
        consentimento_whatsapp: true,
      },
    });
  });

  test("combines a follow-up answer with the stored service draft", async () => {
    const agent = new WhatsappOnboardingAgent({ openai: null });
    const context: ConversationContext = {
      pending_action: "registrar_primeira_troca",
      missing_field: "whatsapp_cliente",
      service_draft: {
        nome_cliente: "Joao",
        veiculo: "Civic 2018",
        servico: "troca de oleo",
        data_servico: "2026-04-25",
        valor: null,
        consentimento_whatsapp: true,
      },
    };

    const result = await agent.generateReply({
      message: "41999990000",
      mode: "onboarding",
      context,
      today: "2026-04-25",
    });

    expect(result.registerServiceInput).toEqual({
      nomeCliente: "Joao",
      whatsappCliente: "+5541999990000",
      veiculo: "Civic 2018",
      servico: "troca de oleo",
      dataServico: "2026-04-25",
      valor: null,
      consentimentoWhatsapp: true,
    });
    expect(result.context).toEqual({});
  });

  test("does not assume an ambiguous weekday date", async () => {
    const agent = new WhatsappOnboardingAgent({ openai: null });

    const result = await agent.generateReply({
      message: "Joao, Civic 2018, troca de oleo segunda, 41999990000",
      mode: "operacao",
      context: {},
      today: "2026-04-25",
    });

    expect(result.body).toBe("Qual foi a data do serviço?");
    expect(result.registerServiceInput).toBeNull();
    expect(result.context.missing_field).toBe("data_servico");
  });

  test("does not create a reminder when the workshop says the customer did not authorize WhatsApp", async () => {
    const agent = new WhatsappOnboardingAgent({ openai: null });

    const result = await agent.generateReply({
      message: "Joao, Civic 2018, troca de oleo hoje, 41999990000, cliente nao autorizou mensagem",
      mode: "operacao",
      context: {},
      today: "2026-04-25",
    });

    expect(result.registerServiceInput).toMatchObject({
      consentimentoWhatsapp: false,
    });
  });
});
