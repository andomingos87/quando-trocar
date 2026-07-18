import OpenAI from "openai";

import type { RecentMessage } from "./types";

// Resumo de handoff de vendas (fase CV3, QTR-12). Quando o agente de vendas
// decide passar o lead para um humano (`handoffRequired`), geramos um resumo
// curto (≤ 3 linhas) da conversa e o enviamos ao WhatsApp comercial. É de USO
// INTERNO — nunca vai para o lead. O espelho legível deste prompt vive em
// `.codex/prompts/whatsapp-handoff-summary.md`.
//
// Invariantes (herdadas da camada de geração, ADR-0020):
// - Nunca decide estado (ADR-0001): o handoff já foi decidido pelo backend; o
//   resumo é só texto para o humano.
// - Best-effort: qualquer falha/timeout/vazio -> null -> o webhook NÃO envia o
//   resumo e NÃO bloqueia o handoff (o link wa.me já saiu para o lead).

const SUMMARY_TIMEOUT_MS = 3000;
const MAX_HISTORY_LINES = 12;

// Versão do prompt do resumo (bump manual a cada mudança de comportamento).
export const HANDOFF_SUMMARY_PROMPT_VERSION = "cv3-1";

const SYSTEM_PROMPT = [
  "Voce resume, para um vendedor humano assumir, uma conversa de vendas do",
  "WhatsApp do produto Quando Trocar. O resumo e de USO INTERNO — nunca vai",
  "para o cliente.",
  "",
  "Escreva no maximo 3 linhas curtas, em portugues do Brasil, cobrindo:",
  "- quem e o lead (nome/oficina, se aparecer na conversa);",
  "- o que ele quer ou perguntou;",
  "- por que esta sendo passado para um humano (o motivo informado).",
  "",
  "REGRAS:",
  "- Use APENAS o que esta na conversa e no motivo. NAO invente nome, numero,",
  "  preco, promessa ou qualquer dado que nao apareca.",
  "- Sem saudacao, sem despedida, sem 'segue o resumo'. So o resumo.",
  "- Objetivo e telegrafico: o vendedor bate o olho e entende o caso.",
].join("\n");

function historyBlock(history: RecentMessage[]): string {
  const lines = history
    .slice(-MAX_HISTORY_LINES)
    .map((m) => `${m.direction === "inbound" ? "Lead" : "Bot"}: ${m.body}`)
    .join("\n");
  return lines.length > 0 ? lines : "(sem historico)";
}

export type HandoffSummaryInput = {
  history: RecentMessage[];
  handoffReason: string;
  leadName: string | null;
};

export interface HandoffSummarizer {
  // Devolve o resumo, ou null quando não deve/não conseguiu gerar (o caller
  // trata null como "não envia resumo", sem bloquear o handoff).
  summarizeHandoff(input: HandoffSummaryInput): Promise<string | null>;
}

export class OpenAiHandoffSummarizer implements HandoffSummarizer {
  private openai: OpenAI | null;
  private model: string | undefined;

  constructor(input?: { openai?: OpenAI; model?: string }) {
    this.openai =
      input?.openai ??
      (process.env.OPENAI_API_KEY
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null);
    this.model = input?.model ?? process.env.OPENAI_MODEL_RESPONDER;
  }

  async summarizeHandoff(input: HandoffSummaryInput): Promise<string | null> {
    if (!this.openai || !this.model) return null;
    // Sem histórico não há o que resumir — evita chamada inútil.
    if (input.history.length === 0) return null;

    const userPrompt = [
      `Motivo do handoff: ${input.handoffReason}`,
      `Nome do lead (se conhecido): ${input.leadName ?? "(desconhecido)"}`,
      "",
      "Conversa (mais antigo -> mais novo):",
      historyBlock(input.history),
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
    try {
      const response = await this.openai.responses.create(
        {
          model: this.model,
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "handoff_summary",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: { summary: { type: "string" } },
                required: ["summary"],
              },
            },
          },
        },
        { signal: controller.signal },
      );

      const summary = parseSummary(response.output_text);
      return summary && summary.length > 0 ? summary : null;
    } catch {
      // Rede, timeout (abort) ou JSON inválido -> sem resumo (best-effort).
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseSummary(text: string | null | undefined): string | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { summary?: unknown };
    return typeof parsed.summary === "string" ? parsed.summary.trim() : null;
  } catch {
    return null;
  }
}
