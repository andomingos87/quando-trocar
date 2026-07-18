import { describe, expect, test, vi } from "vitest";
import type OpenAI from "openai";

import { OpenAiHandoffSummarizer } from "@/lib/whatsapp/handoff-summary";
import type { RecentMessage } from "@/lib/whatsapp/types";

const history: RecentMessage[] = [
  { direction: "inbound", body: "voces atendem frota?", sentAt: null },
  { direction: "outbound", body: "atende sim chefe", sentAt: null },
];

function fakeOpenAI(create: () => Promise<{ output_text: string }>): OpenAI {
  return { responses: { create } } as unknown as OpenAI;
}

describe("OpenAiHandoffSummarizer", () => {
  test("sem modelo configurado -> null (nao chama a API)", async () => {
    const create = vi.fn();
    const summarizer = new OpenAiHandoffSummarizer({
      openai: fakeOpenAI(create),
      model: undefined,
    });

    const result = await summarizer.summarizeHandoff({
      history,
      handoffReason: "preco_insistente",
      leadName: "Auto Silva",
    });

    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  test("historico vazio -> null (nada a resumir)", async () => {
    const create = vi.fn();
    const summarizer = new OpenAiHandoffSummarizer({
      openai: fakeOpenAI(create),
      model: "gpt-x",
    });

    const result = await summarizer.summarizeHandoff({
      history: [],
      handoffReason: "pedido_humano",
      leadName: null,
    });

    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  test("sucesso -> devolve o resumo (trim)", async () => {
    const summarizer = new OpenAiHandoffSummarizer({
      openai: fakeOpenAI(async () => ({
        output_text: JSON.stringify({ summary: "  Lead Auto Silva quer frota; passou por preco.  " }),
      })),
      model: "gpt-x",
    });

    const result = await summarizer.summarizeHandoff({
      history,
      handoffReason: "preco_insistente",
      leadName: "Auto Silva",
    });

    expect(result).toBe("Lead Auto Silva quer frota; passou por preco.");
  });

  test("erro/JSON invalido -> null (best-effort)", async () => {
    const summarizer = new OpenAiHandoffSummarizer({
      openai: fakeOpenAI(async () => ({ output_text: "nao e json" })),
      model: "gpt-x",
    });

    const result = await summarizer.summarizeHandoff({
      history,
      handoffReason: "volume_alto",
      leadName: null,
    });

    expect(result).toBeNull();
  });

  test("summary vazio -> null", async () => {
    const summarizer = new OpenAiHandoffSummarizer({
      openai: fakeOpenAI(async () => ({ output_text: JSON.stringify({ summary: "   " }) })),
      model: "gpt-x",
    });

    const result = await summarizer.summarizeHandoff({
      history,
      handoffReason: "rede_ou_franquia",
      leadName: null,
    });

    expect(result).toBeNull();
  });
});
