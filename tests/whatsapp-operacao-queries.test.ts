import { describe, expect, test } from "vitest";

import {
  classifyReadOnlyQuery,
  extractClienteTermo,
  WhatsappOnboardingAgent,
} from "@/lib/whatsapp/onboarding-agent";
import {
  ajudaMessage,
  clienteNaoEncontrado,
  formatClienteResumo,
  formatRemindersSentThisMonth,
  formatUpcomingReminders,
} from "@/lib/whatsapp/operacao-queries";
import type { ClienteResumo, UpcomingReminder } from "@/lib/whatsapp/types";

describe("classifyReadOnlyQuery (CV6)", () => {
  test("próximos lembretes", () => {
    for (const msg of [
      "quais lembretes dessa semana?",
      "quem eu vou avisar essa semana",
      "me mostra os proximos lembretes",
      "tem lembrete pra sair hoje?",
      "quem ta pra voltar?",
    ]) {
      expect(classifyReadOnlyQuery(msg), msg).toEqual({
        kind: "consulta_lembretes",
        scope: "proximos",
      });
    }
  });

  test("contagem de lembretes no mês", () => {
    for (const msg of [
      "quantos lembretes saíram esse mês?",
      "quantas mensagens foram esse mes",
    ]) {
      expect(classifyReadOnlyQuery(msg), msg).toEqual({
        kind: "consulta_lembretes",
        scope: "mes",
      });
    }
  });

  test("consulta de cliente por nome e por telefone", () => {
    expect(classifyReadOnlyQuery("dados do cliente João Silva")).toEqual({
      kind: "consulta_cliente",
      termo: "João Silva",
    });
    expect(classifyReadOnlyQuery("resumo do cliente 41999998888")).toEqual({
      kind: "consulta_cliente",
      termo: "41999998888",
    });
  });

  test("mensagens neutras / cadastro não viram consulta", () => {
    expect(classifyReadOnlyQuery("bom dia")).toBeNull();
    expect(classifyReadOnlyQuery("obrigado")).toBeNull();
    expect(classifyReadOnlyQuery("cliente vai gostar disso")).toBeNull();
  });
});

describe("extractClienteTermo (CV6)", () => {
  test("prioriza telefone", () => {
    expect(extractClienteTermo("cliente 41 99999-8888")).toBe("41999998888");
  });
  test("nome após 'cliente'", () => {
    expect(extractClienteTermo("dados do cliente Maria")).toBe("Maria");
  });
  test("ignora 'cliente cadastrado/final'", () => {
    expect(extractClienteTermo("o cliente cadastrado")).toBeNull();
    expect(extractClienteTermo("cliente final")).toBeNull();
  });
});

describe("onboarding-agent dispatch de consulta (CV6)", () => {
  const agent = new WhatsappOnboardingAgent({ openai: null });

  test("modo operacao → readOnlyQuery setado, sem tocar estado", async () => {
    const reply = await agent.generateReply({
      message: "quais lembretes dessa semana?",
      mode: "operacao",
      context: {},
      today: "2026-07-18",
    });
    expect(reply.readOnlyQuery).toEqual({
      kind: "consulta_lembretes",
      scope: "proximos",
    });
    expect(reply.registerServiceInput).toBeNull();
    expect(reply.nextAgentMode).toBeNull();
  });

  test("modo onboarding NÃO faz consulta (oficina ainda aprendendo)", async () => {
    const reply = await agent.generateReply({
      message: "quais lembretes dessa semana?",
      mode: "onboarding",
      context: {},
      today: "2026-07-18",
    });
    expect(reply.readOnlyQuery).toBeUndefined();
  });
});

describe("formatadores literais (CV6)", () => {
  const reminders: UpcomingReminder[] = [
    { clienteNome: "João", veiculo: "Civic 2018", scheduledAt: "2026-07-20T12:00:00Z" },
    { clienteNome: "Maria", veiculo: "Gol", scheduledAt: "2026-07-22T12:00:00Z" },
  ];

  test("lista de lembretes com dados literais", () => {
    const text = formatUpcomingReminders(reminders, 7);
    expect(text).toContain("João (Civic 2018)");
    expect(text).toContain("Maria (Gol)");
    expect(text).toContain("2 lembretes");
  });

  test("lista vazia", () => {
    expect(formatUpcomingReminders([], 7)).toContain("Não tem lembrete");
  });

  test("contagem no mês", () => {
    expect(formatRemindersSentThisMonth(0)).toContain("nenhum");
    expect(formatRemindersSentThisMonth(1)).toContain("1 lembrete");
    expect(formatRemindersSentThisMonth(5)).toContain("5 lembretes");
  });

  test("resumo de cliente e opt-out", () => {
    const resumo: ClienteResumo = {
      nome: "João Silva",
      whatsapp: "+5541999998888",
      status: "opt_out",
      totalServicos: 3,
      ultimoServico: { tipo: "troca_oleo", data: "2026-05-10", veiculo: "Civic 2018" },
      proximoLembreteAt: "2026-08-10T12:00:00Z",
    };
    const text = formatClienteResumo(resumo);
    expect(text).toContain("João Silva");
    expect(text).toContain("troca de óleo");
    expect(text).toContain("Total de serviços registrados: 3");
    expect(text).toContain("não receber mais");
  });

  test("cliente não encontrado", () => {
    expect(clienteNaoEncontrado("Fulano")).toContain("Fulano");
  });

  test("ajuda por modo", () => {
    expect(ajudaMessage("operacao")).toContain("Registrar uma troca");
    expect(ajudaMessage("operacao")).toContain("Consultar um cliente");
    expect(ajudaMessage("suporte")).toContain("/voltar");
  });
});
