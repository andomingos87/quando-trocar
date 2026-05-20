import { describe, expect, test } from "vitest";

import {
  classifyCobrancaMessage,
  WhatsappCobrancaAgent,
} from "@/lib/whatsapp/cobranca-agent";

const pendingPayment = {
  valor: 89,
  vencimento: "2026-05-02",
  mpPreferenceId: "PREF-ABC-123",
};

describe("whatsapp cobranca agent", () => {
  test("classifies 'manda o link' deterministically as pediu_link", () => {
    const result = classifyCobrancaMessage(
      "manda o link de novo",
      "cobranca_inadimplente",
    );
    expect(result.intent).toBe("pediu_link");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  test("inadimplente + pediu_link with pendingPayment → reply contains link and value", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "me manda o link",
      submode: "cobranca_inadimplente",
      oficinaNome: "Auto Center Silva",
      proximoVencimento: null,
      pendingPayment,
      context: {},
    });

    expect(reply.intent).toBe("pediu_link");
    expect(reply.handoffRequired).toBe(false);
    expect(reply.replyBody).toContain("PREF-ABC-123");
    expect(reply.replyBody).toContain("R$");
    expect(reply.replyBody).toContain("02/05/2026");
  });

  test("inadimplente + pediu_link without pendingPayment → handoff", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "me manda o link",
      submode: "cobranca_inadimplente",
      oficinaNome: "Auto Center Silva",
      proximoVencimento: null,
      pendingPayment: null,
      context: {},
    });

    expect(reply.intent).toBe("pediu_link");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("link_indisponivel");
  });

  test("negocia_prazo always triggers handoff in inadimplente submode", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "posso pagar dia 25?",
      submode: "cobranca_inadimplente",
      oficinaNome: null,
      proximoVencimento: null,
      pendingPayment,
      context: {},
    });

    expect(reply.intent).toBe("negocia_prazo");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("negocia_prazo");
    expect(reply.replyBody).not.toContain("PREF-ABC-123");
  });

  test("ja_paguei triggers handoff for human verification", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "ja paguei",
      submode: "cobranca_inadimplente",
      oficinaNome: null,
      proximoVencimento: null,
      pendingPayment,
      context: {},
    });

    expect(reply.intent).toBe("ja_paguei");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("verificar_pagamento");
  });

  test("winback submode replies curiously without link", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "oi",
      submode: "cobranca_winback",
      oficinaNome: "Auto Center Silva",
      proximoVencimento: null,
      pendingPayment: null,
      context: {},
    });

    expect(reply.submode).toBe("cobranca_winback");
    expect(reply.replyBody).not.toContain("PREF-");
    expect(reply.replyBody.toLowerCase()).toContain("faltou");
  });

  test("winback + quer_voltar triggers reactivation handoff", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "quero voltar a usar",
      submode: "cobranca_winback",
      oficinaNome: null,
      proximoVencimento: null,
      pendingPayment: null,
      context: {},
    });

    expect(reply.intent).toBe("quer_voltar");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("reativacao_voluntaria");
  });

  test("disputa triggers handoff with appropriate reason", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "por que voces me pausaram",
      submode: "cobranca_inadimplente",
      oficinaNome: null,
      proximoVencimento: null,
      pendingPayment,
      context: {},
    });

    expect(reply.intent).toBe("disputa");
    expect(reply.handoffRequired).toBe(true);
    expect(reply.handoffReason).toBe("disputa_cobranca");
  });

  test("inadimplente + ambiguous message includes link in reply when available", async () => {
    const agent = new WhatsappCobrancaAgent({ openai: null });
    const reply = await agent.generateReply({
      message: "blz",
      submode: "cobranca_inadimplente",
      oficinaNome: null,
      proximoVencimento: null,
      pendingPayment,
      context: {},
    });

    expect(reply.replyBody).toContain("PREF-ABC-123");
  });
});
