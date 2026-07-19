import { describe, expect, test, vi } from "vitest";

import {
  processFollowupLeadsBatch,
  selectLeadsForFollowup,
} from "@/lib/whatsapp/followup-leads";
import type { FollowupLeadCandidate } from "@/lib/whatsapp/types";

const NOW = new Date("2026-07-18T12:00:00.000Z");

function candidate(
  overrides: Partial<FollowupLeadCandidate> = {},
): FollowupLeadCandidate {
  return {
    leadId: "lead-1",
    conversationId: "conv-1",
    whatsapp: "+5541999990000",
    nome: "Joao Silva",
    status: "em_conversa",
    followupCount: 0,
    lastFollowupAt: null,
    // 30h atrás — passou a janela de 24h do 1º follow-up.
    referenceAt: "2026-07-17T06:00:00.000Z",
    handoffRequired: false,
    ...overrides,
  };
}

describe("selectLeadsForFollowup — janelas", () => {
  test("1º follow-up: seleciona lead sem inbound há mais de 24h", () => {
    const selected = selectLeadsForFollowup({ candidates: [candidate()], now: NOW });
    expect(selected).toHaveLength(1);
    expect(selected[0].followupNumber).toBe(1);
  });

  test("1º follow-up: NÃO seleciona lead com menos de 24h", () => {
    const selected = selectLeadsForFollowup({
      candidates: [candidate({ referenceAt: "2026-07-18T00:00:00.000Z" })], // 12h
      now: NOW,
    });
    expect(selected).toHaveLength(0);
  });

  test("2º follow-up: seleciona lead com 1 follow-up e sem inbound há mais de 72h", () => {
    const selected = selectLeadsForFollowup({
      candidates: [
        candidate({
          followupCount: 1,
          referenceAt: "2026-07-15T06:00:00.000Z", // 78h
          lastFollowupAt: "2026-07-16T06:00:00.000Z", // 30h atrás (> gap mínimo)
        }),
      ],
      now: NOW,
    });
    expect(selected).toHaveLength(1);
    expect(selected[0].followupNumber).toBe(2);
  });

  test("2º follow-up: NÃO seleciona lead com 1 follow-up mas só 48h sem inbound", () => {
    const selected = selectLeadsForFollowup({
      candidates: [
        candidate({
          followupCount: 1,
          referenceAt: "2026-07-16T12:00:00.000Z", // 48h
          lastFollowupAt: "2026-07-16T12:00:00.000Z",
        }),
      ],
      now: NOW,
    });
    expect(selected).toHaveLength(0);
  });
});

describe("selectLeadsForFollowup — caps e exclusões", () => {
  test("cap de 2: lead com 2 follow-ups nunca é selecionado", () => {
    const selected = selectLeadsForFollowup({
      candidates: [
        candidate({
          followupCount: 2,
          referenceAt: "2026-07-10T06:00:00.000Z",
          lastFollowupAt: "2026-07-14T06:00:00.000Z",
        }),
      ],
      now: NOW,
    });
    expect(selected).toHaveLength(0);
  });

  test("exclui status não elegíveis (perdido, convertido, teste_aceito, interessado)", () => {
    for (const status of ["perdido", "convertido", "teste_aceito", "interessado", "novo"] as const) {
      const selected = selectLeadsForFollowup({
        candidates: [candidate({ status })],
        now: NOW,
      });
      expect(selected, `status ${status}`).toHaveLength(0);
    }
  });

  test("exclui conversa em handoff", () => {
    const selected = selectLeadsForFollowup({
      candidates: [candidate({ handoffRequired: true })],
      now: NOW,
    });
    expect(selected).toHaveLength(0);
  });

  test("exclui lead sem conversa (sem onde registrar o outbound)", () => {
    const selected = selectLeadsForFollowup({
      candidates: [candidate({ conversationId: null })],
      now: NOW,
    });
    expect(selected).toHaveLength(0);
  });
});

describe("selectLeadsForFollowup — idempotência", () => {
  test("intervalo mínimo: não reenvia se o último follow-up foi há poucas horas", () => {
    const selected = selectLeadsForFollowup({
      candidates: [
        candidate({
          followupCount: 1,
          referenceAt: "2026-07-14T06:00:00.000Z", // > 72h
          lastFollowupAt: "2026-07-18T06:00:00.000Z", // 6h atrás (< gap mínimo de 20h)
        }),
      ],
      now: NOW,
    });
    expect(selected).toHaveLength(0);
  });

  test("rodar 2× no mesmo instante seleciona o mesmo conjunto (função pura)", () => {
    const candidates = [candidate(), candidate({ leadId: "lead-2", conversationId: "conv-2" })];
    const a = selectLeadsForFollowup({ candidates, now: NOW });
    const b = selectLeadsForFollowup({ candidates, now: NOW });
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
  });
});

describe("processFollowupLeadsBatch — orquestração", () => {
  function makeRepo(candidates: FollowupLeadCandidate[]) {
    return {
      listFollowupCandidates: vi.fn(async () => candidates),
      createOutboundMessage: vi.fn(async () => ({ id: "outbox-1" })),
      markOutboundSent: vi.fn(async () => undefined),
      saveOutboundMessage: vi.fn(async () => ({ duplicate: false, messageId: "m1" })),
      markLeadFollowup: vi.fn(async () => undefined),
      markOutboundFailed: vi.fn(async () => undefined),
    };
  }

  test("envia template com o primeiro nome e avança o contador em sucesso", async () => {
    const repo = makeRepo([candidate()]);
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => ({
        whatsappMessageId: "wamid.f1",
        response: { messages: [{ id: "wamid.f1" }] },
      })),
    };

    const result = await processFollowupLeadsBatch({
      repository: repo as never,
      whatsapp: whatsapp as never,
      now: NOW,
      templateFirst: "followup_lead_24h",
      templateSecond: "followup_lead_72h",
    });

    expect(result).toEqual({ candidates: 1, selected: 1, sent: 1, failed: 0 });
    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith({
      to: "+5541999990000",
      templateName: "followup_lead_24h",
      languageCode: "pt_BR",
      bodyParameters: ["Joao"],
    });
    expect(repo.markLeadFollowup).toHaveBeenCalledWith({
      leadId: "lead-1",
      followupNumber: 1,
      at: NOW.toISOString(),
    });
  });

  test("usa o template do 2º follow-up quando followupCount = 1", async () => {
    const repo = makeRepo([
      candidate({
        followupCount: 1,
        referenceAt: "2026-07-15T06:00:00.000Z",
        lastFollowupAt: "2026-07-16T06:00:00.000Z",
      }),
    ]);
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.f2" })),
    };

    await processFollowupLeadsBatch({
      repository: repo as never,
      whatsapp: whatsapp as never,
      now: NOW,
      templateFirst: "followup_lead_24h",
      templateSecond: "followup_lead_72h",
    });

    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ templateName: "followup_lead_72h" }),
    );
    expect(repo.markLeadFollowup).toHaveBeenCalledWith(
      expect.objectContaining({ followupNumber: 2 }),
    );
  });

  test("falha de envio NÃO avança o contador (idempotência: reprocessável)", async () => {
    const repo = makeRepo([candidate()]);
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => {
        throw new Error("template not approved");
      }),
    };

    const result = await processFollowupLeadsBatch({
      repository: repo as never,
      whatsapp: whatsapp as never,
      now: NOW,
      templateFirst: "followup_lead_24h",
      templateSecond: "followup_lead_72h",
    });

    expect(result).toEqual({ candidates: 1, selected: 1, sent: 0, failed: 1 });
    expect(repo.markLeadFollowup).not.toHaveBeenCalled();
    expect(repo.markOutboundFailed).toHaveBeenCalledOnce();
  });

  test("nome vazio cai numa saudação neutra no parâmetro do template", async () => {
    const repo = makeRepo([candidate({ nome: null })]);
    const whatsapp = {
      sendTemplateMessage: vi.fn(async () => ({ whatsappMessageId: "wamid.f3" })),
    };

    await processFollowupLeadsBatch({
      repository: repo as never,
      whatsapp: whatsapp as never,
      now: NOW,
      templateFirst: "followup_lead_24h",
      templateSecond: "followup_lead_72h",
    });

    expect(whatsapp.sendTemplateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ bodyParameters: ["tudo bem"] }),
    );
  });
});
