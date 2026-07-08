import { describe, expect, test } from "vitest";

import {
  WhatsappClienteFinalConciergeAgent,
  buildWorkshopWaLink,
  classifyConciergeMessage,
} from "@/lib/whatsapp/cliente-final-concierge";

const agent = new WhatsappClienteFinalConciergeAgent();

function reply(message: string, workshopWhatsapp: string | null = "+5541999990000") {
  return agent.generateReply({
    message,
    workshopName: "Auto Peças Anderson",
    workshopWhatsapp,
  });
}

describe("buildWorkshopWaLink", () => {
  test("monta wa.me só com dígitos", () => {
    expect(buildWorkshopWaLink("+55 41 99999-0000")).toBe("https://wa.me/5541999990000");
  });
  test("retorna null sem telefone ou curto demais", () => {
    expect(buildWorkshopWaLink(null)).toBeNull();
    expect(buildWorkshopWaLink("123")).toBeNull();
  });
});

describe("classifyConciergeMessage", () => {
  test("classifica os intents principais", () => {
    expect(classifyConciergeMessage("obrigado!")).toBe("agradecimento");
    expect(classifyConciergeMessage("que empresa é essa?")).toBe("quem_e");
    expect(classifyConciergeMessage("quanto custou?")).toBe("pedido_oficina");
    expect(classifyConciergeMessage("quero remarcar")).toBe("pedido_oficina");
    expect(classifyConciergeMessage("não quero receber mais")).toBe("opt_out");
    expect(classifyConciergeMessage("número errado")).toBe("numero_errado");
    expect(classifyConciergeMessage("não reconheço esse serviço")).toBe("nao_reconhece");
    expect(classifyConciergeMessage("asdfghjk")).toBe("mensagem_indefinida");
  });
});

describe("WhatsappClienteFinalConciergeAgent", () => {
  test("opt-out: cancela lembretes e marca status, sem handoff", () => {
    const r = reply("pode parar de mandar");
    expect(r.intent).toBe("opt_out");
    expect(r.clienteStatus).toBe("opt_out");
    expect(r.shouldCancelFutureReminders).toBe(true);
    expect(r.handoffRequired).toBe(false);
  });

  test("número errado: cancela lembretes, sem handoff", () => {
    const r = reply("número errado, não sou eu");
    expect(r.intent).toBe("numero_errado");
    expect(r.clienteStatus).toBe("numero_errado");
    expect(r.shouldCancelFutureReminders).toBe(true);
    expect(r.handoffRequired).toBe(false);
  });

  test("pedido acionável: handoff com link da oficina", () => {
    const r = reply("quanto ficou a troca?");
    expect(r.handoffRequired).toBe(true);
    expect(r.handoffReason).toBe("pedido_cliente_final");
    expect(r.replyBody).toContain("Auto Peças Anderson");
    expect(r.replyBody).toContain("https://wa.me/5541999990000");
  });

  test("agradecimento: resposta amigável, sem handoff", () => {
    const r = reply("valeu!");
    expect(r.intent).toBe("agradecimento");
    expect(r.handoffRequired).toBe(false);
    expect(r.clienteStatus).toBeNull();
    expect(r.replyBody).toContain("Auto Peças Anderson");
  });

  test("não reconhece: handoff + flag específica", () => {
    const r = reply("não reconheço esse carro");
    expect(r.intent).toBe("nao_reconhece");
    expect(r.handoffRequired).toBe(true);
    expect(r.handoffReason).toBe("cliente_nao_reconhece");
    expect(r.shouldCancelFutureReminders).toBe(false);
  });

  test("sem telefone da oficina: handoff sem link, ainda nomeia a oficina", () => {
    const r = reply("quero agendar", null);
    expect(r.handoffRequired).toBe(true);
    expect(r.replyBody).toContain("Auto Peças Anderson");
    expect(r.replyBody).not.toContain("wa.me");
  });

  test("sempre registra tool call cliente_final_concierge", () => {
    const r = reply("obrigado");
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].toolName).toBe("cliente_final_concierge");
  });
});
