import { describe, expect, test } from "vitest";

import {
  classifyReminderReply,
  retryDelaySecondsForAttempt,
  renderReminderTemplate,
  WhatsappReminderAgent,
} from "@/lib/whatsapp/reminder-agent";

describe("whatsapp reminder agent", () => {
  test("classifies opt-out deterministically", () => {
    expect(classifyReminderReply("Parar de me mandar mensagem")).toMatchObject({
      intent: "opt_out",
      confidence: 0.95,
      handoffRequired: false,
    });
  });

  test("classifies price and schedule questions deterministically", () => {
    expect(classifyReminderReply("qual o preco da troca?")).toMatchObject({
      intent: "pergunta_preco",
      handoffRequired: true,
      handoffReason: "pergunta_preco",
    });
    expect(classifyReminderReply("quais horarios voces tem amanha?")).toMatchObject({
      intent: "pergunta_horario",
      handoffRequired: true,
      handoffReason: "pergunta_horario",
    });
  });

  test("opens handoff for scheduling interest without confirming an appointment", async () => {
    const agent = new WhatsappReminderAgent({ openai: null });

    const reply = await agent.generateReply({ message: "quero agendar" });

    expect(reply.intent).toBe("quer_agendar");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("pedido_agendamento");
    expect(reply.replyBody).toContain("oficina");
    expect(reply.replyBody).not.toContain("agendado");
  });

  test("falls back to OpenAI when deterministic confidence is low", async () => {
    const agent = new WhatsappReminderAgent({
      classifierModel: "test-model",
      openai: {
        responses: {
          create: async () => ({
            output_text: JSON.stringify({
              intent: "ja_fez_servico",
              confidence: 0.91,
            }),
          }),
        },
      } as never,
    });

    const reply = await agent.generateReply({ message: "ja troquei em outro lugar" });

    expect(reply.intent).toBe("ja_fez_servico");
    expect(reply.lembreteStatus).toBe("respondido");
  });

  test("renders the approved reminder template text", () => {
    expect(
      renderReminderTemplate({
        customerName: "Joao",
        workshopName: "Auto Center Silva",
        vehicleDescription: "Civic 2018",
      }),
    ).toBe(
      "Oi Joao, aqui e da Auto Center Silva.\nJa esta na hora da proxima troca de oleo do seu Civic 2018.\nQuer agendar?",
    );
  });

  test("uses the agreed retry backoff sequence", () => {
    expect(retryDelaySecondsForAttempt(1)).toBe(15 * 60);
    expect(retryDelaySecondsForAttempt(2)).toBe(2 * 60 * 60);
    expect(retryDelaySecondsForAttempt(3)).toBe(24 * 60 * 60);
    expect(retryDelaySecondsForAttempt(4)).toBeNull();
  });
});
