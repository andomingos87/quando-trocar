import OpenAI from "openai";

import { normalizeText } from "./sales-agent";
import type {
  ConversationContext,
  ReminderAgent,
  ReminderAgentReply,
  ReminderIntent,
} from "./types";

type ReminderClassification = {
  intent: ReminderIntent;
  confidence: number;
  handoffRequired: boolean;
  handoffReason: string | null;
};

const OPT_OUT_PATTERNS = [
  /\bparar\b/,
  /\bcancelar\b/,
  /\bremover\b/,
  /\bnao quero receber\b/,
  /\bnao me mande\b/,
  /\bpare\b/,
  /\bsair\b/,
  /\bdescadastrar\b/,
];

const WRONG_NUMBER_PATTERNS = [
  /\bnumero errado\b/,
  /\bnao sou\b/,
  /\bnao e\b/,
  /\bnao eh\b/,
  /\btelefone errado\b/,
];

export function renderReminderTemplate(input: {
  customerName: string;
  workshopName: string;
  vehicleDescription: string;
}) {
  return `Oi ${input.customerName}, aqui e da ${input.workshopName}.\nJa esta na hora da proxima troca de oleo do seu ${input.vehicleDescription}.\nQuer agendar?`;
}

export function retryDelaySecondsForAttempt(attempt: number) {
  if (attempt === 1) return 15 * 60;
  if (attempt === 2) return 2 * 60 * 60;
  if (attempt === 3) return 24 * 60 * 60;
  return null;
}

function replyForIntent(intent: ReminderIntent): Omit<ReminderAgentReply, "confidence" | "toolCalls"> {
  if (intent === "opt_out") {
    return {
      handoffRequired: false,
      handoffReason: null,
      lembreteStatus: "cancelado",
      clienteStatus: "opt_out",
      shouldCancelFutureReminders: true,
      replyBody: "Tudo certo. Vou parar por aqui e nao envio mais lembretes.",
      intent,
    };
  }

  if (intent === "numero_errado") {
    return {
      handoffRequired: false,
      handoffReason: null,
      lembreteStatus: "cancelado",
      clienteStatus: "numero_errado",
      shouldCancelFutureReminders: true,
      replyBody: "Entendi. Vou parar os lembretes para este numero.",
      intent,
    };
  }

  if (intent === "pergunta_preco") {
    return {
      handoffRequired: true,
      handoffReason: "pergunta_preco",
      lembreteStatus: null,
      clienteStatus: null,
      shouldCancelFutureReminders: false,
      replyBody: "Vou avisar a oficina para falar com voce sobre valores.",
      intent,
    };
  }

  if (intent === "pergunta_horario") {
    return {
      handoffRequired: true,
      handoffReason: "pergunta_horario",
      lembreteStatus: null,
      clienteStatus: null,
      shouldCancelFutureReminders: false,
      replyBody: "Vou avisar a oficina para confirmar os horarios com voce.",
      intent,
    };
  }

  if (intent === "quer_agendar" || intent === "quer_reagendar") {
    return {
      handoffRequired: true,
      handoffReason: "pedido_agendamento",
      lembreteStatus: null,
      clienteStatus: null,
      shouldCancelFutureReminders: false,
      replyBody: "Perfeito. Vou avisar a oficina para seguir com voce pelo melhor horario.",
      intent,
    };
  }

  if (intent === "ja_fez_servico") {
    return {
      handoffRequired: false,
      handoffReason: null,
      lembreteStatus: "respondido",
      clienteStatus: null,
      shouldCancelFutureReminders: false,
      replyBody: "Perfeito. Obrigado por avisar.",
      intent,
    };
  }

  if (intent === "nao_tem_interesse") {
    return {
      handoffRequired: false,
      handoffReason: null,
      lembreteStatus: "sem_resposta",
      clienteStatus: null,
      shouldCancelFutureReminders: false,
      replyBody: "Tudo bem. Obrigado por responder.",
      intent,
    };
  }

  return {
    handoffRequired: true,
    handoffReason: "mensagem_ambigua",
    lembreteStatus: null,
    clienteStatus: null,
    shouldCancelFutureReminders: false,
    replyBody: "Recebi sua mensagem. Vou avisar a oficina para continuar com voce.",
    intent,
  };
}

export function classifyReminderReply(message: string): ReminderClassification {
  const normalized = normalizeText(message);

  if (OPT_OUT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "opt_out", confidence: 0.95, handoffRequired: false, handoffReason: null };
  }

  if (WRONG_NUMBER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      intent: "numero_errado",
      confidence: 0.95,
      handoffRequired: false,
      handoffReason: null,
    };
  }

  if (/\bpreco\b|\bvalor\b|\bquanto\b/.test(normalized)) {
    return {
      intent: "pergunta_preco",
      confidence: 0.92,
      handoffRequired: true,
      handoffReason: "pergunta_preco",
    };
  }

  if (/\bhorario\b|\bhorarios\b|\bmanha\b|\btarde\b|\bdisponivel\b|\bdisponibilidade\b/.test(normalized)) {
    return {
      intent: "pergunta_horario",
      confidence: 0.92,
      handoffRequired: true,
      handoffReason: "pergunta_horario",
    };
  }

  if (/\bagendar\b|\bmarcar\b/.test(normalized)) {
    return {
      intent: "quer_agendar",
      confidence: 0.9,
      handoffRequired: true,
      handoffReason: "pedido_agendamento",
    };
  }

  if (/\breagendar\b|\bremarcar\b/.test(normalized)) {
    return {
      intent: "quer_reagendar",
      confidence: 0.9,
      handoffRequired: true,
      handoffReason: "pedido_agendamento",
    };
  }

  if (/\bja fiz\b|\bja troquei\b|\bja fui\b/.test(normalized)) {
    return {
      intent: "ja_fez_servico",
      confidence: 0.82,
      handoffRequired: false,
      handoffReason: null,
    };
  }

  if (/\bnao quero\b|\bsem interesse\b|\bnao tenho interesse\b/.test(normalized)) {
    return {
      intent: "nao_tem_interesse",
      confidence: 0.9,
      handoffRequired: false,
      handoffReason: null,
    };
  }

  return {
    intent: "mensagem_indefinida",
    confidence: 0.45,
    handoffRequired: true,
    handoffReason: "mensagem_ambigua",
  };
}

function parseOpenAIClassification(text: string): ReminderClassification | null {
  try {
    const parsed = JSON.parse(text) as Partial<ReminderClassification>;
    if (
      parsed.intent === "quer_agendar" ||
      parsed.intent === "quer_reagendar" ||
      parsed.intent === "pergunta_preco" ||
      parsed.intent === "pergunta_horario" ||
      parsed.intent === "nao_tem_interesse" ||
      parsed.intent === "ja_fez_servico" ||
      parsed.intent === "numero_errado" ||
      parsed.intent === "mensagem_indefinida" ||
      parsed.intent === "opt_out"
    ) {
      return {
        intent: parsed.intent,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
        handoffRequired: Boolean(parsed.handoffRequired),
        handoffReason:
          typeof parsed.handoffReason === "string" ? parsed.handoffReason : null,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export class WhatsappReminderAgent implements ReminderAgent {
  private readonly openai: OpenAI | null;
  private readonly classifierModel: string;

  constructor(input?: { openai?: OpenAI | null; classifierModel?: string }) {
    this.openai =
      input?.openai ??
      (process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null);
    this.classifierModel =
      input?.classifierModel ?? process.env.OPENAI_MODEL_CLASSIFIER ?? "gpt-4o-mini";
  }

  async generateReply(input: {
    message: string;
    conversationContext: ConversationContext;
  }): Promise<ReminderAgentReply> {
    const deterministic = classifyReminderReply(input.message);
    const classification =
      deterministic.confidence >= 0.85
        ? deterministic
        : (await this.classifyWithOpenAI(input.message)) ?? deterministic;
    const reply = replyForIntent(classification.intent);

    return {
      ...reply,
      confidence: classification.confidence,
      toolCalls: [],
    };
  }

  private async classifyWithOpenAI(message: string): Promise<ReminderClassification | null> {
    if (!this.openai) {
      return null;
    }

    try {
      const response = await this.openai.responses.create({
        model: this.classifierModel,
        input: [
          {
            role: "system",
            content:
              "Classifique respostas curtas de clientes finais para lembretes de troca de oleo. Responda apenas JSON compacto com intent, confidence, handoffRequired e handoffReason.",
          },
          { role: "user", content: message },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "reminder_classification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "quer_agendar",
                    "quer_reagendar",
                    "pergunta_preco",
                    "pergunta_horario",
                    "nao_tem_interesse",
                    "ja_fez_servico",
                    "numero_errado",
                    "mensagem_indefinida",
                    "opt_out",
                  ],
                },
                confidence: { type: "number" },
                handoffRequired: { type: "boolean" },
                handoffReason: { type: ["string", "null"] },
              },
              required: ["intent", "confidence", "handoffRequired", "handoffReason"],
            },
          },
        },
      });

      return parseOpenAIClassification(response.output_text);
    } catch {
      return null;
    }
  }
}
