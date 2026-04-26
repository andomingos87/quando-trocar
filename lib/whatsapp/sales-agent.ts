import OpenAI from "openai";

import type {
  AgentReply,
  LeadOrigin,
  LeadStatus,
  RoiCalculation,
  SalesClassification,
  SalesIntent,
} from "./types";

const LANDING_MESSAGES = ["oi quero testar o quando trocar"];

export function normalizeWhatsappPhone(input: string) {
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length >= 12) {
    return `+${digits}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  if (digits.length > 0 && input.trim().startsWith("+")) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

export function normalizeText(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function detectLeadOrigin(message: string): LeadOrigin {
  const normalized = normalizeText(message);
  return LANDING_MESSAGES.includes(normalized) ? "landing_page" : "manual_whatsapp";
}

function isExplicitLossMessage(message: string) {
  const normalized = normalizeText(message);
  return [
    /\bnao tenho interesse\b/,
    /\bnao me interessa\b/,
    /\bsem interesse\b/,
    /\bnao quero\b/,
    /\bnao quero mais\b/,
    /\bpare\b/,
    /\bparar\b/,
    /\bcancelar\b/,
    /\bremover\b/,
    /\bdescadastrar\b/,
    /\bnao me chama\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function calculateRoi(input: {
  monthlyChanges: number;
  averageTicket: number;
  recoveryRate?: number;
}): RoiCalculation {
  const recoveryRate = input.recoveryRate ?? 0.1;

  return {
    monthlyChanges: input.monthlyChanges,
    averageTicket: input.averageTicket,
    recoveryRate,
    recoveredRevenue: input.monthlyChanges * input.averageTicket * recoveryRate,
  };
}

function extractVolumeAndTicket(message: string) {
  const normalized = normalizeText(message);
  const numbers = [...normalized.matchAll(/\d+(?:[,.]\d+)?/g)].map((match) =>
    Number(match[0].replace(",", ".")),
  );

  if (numbers.length < 2) {
    return null;
  }

  const ticketIndex = normalized.search(/ticket|medio|media|r\$|reais|valor/);
  if (ticketIndex >= 0) {
    const tokens = [...normalized.matchAll(/\d+(?:[,.]\d+)?/g)];
    const ticketToken = tokens.find((match) => match.index !== undefined && match.index > ticketIndex);
    if (ticketToken) {
      const averageTicket = Number(ticketToken[0].replace(",", "."));
      const monthlyChanges = numbers.find((value) => value !== averageTicket) ?? numbers[0];
      return { monthlyChanges, averageTicket };
    }
  }

  return { monthlyChanges: numbers[0], averageTicket: numbers[1] };
}

export function classifySalesMessage(message: string): SalesClassification {
  const normalized = normalizeText(message);
  const volumeAndTicket = extractVolumeAndTicket(message);

  if (isExplicitLossMessage(message)) {
    return { intent: "sem_interesse", confidence: 0.9 };
  }

  if (volumeAndTicket) {
    return {
      intent: "informa_volume_ticket",
      confidence: 0.86,
      ...volumeAndTicket,
    };
  }

  if (/\b(como funciona|funciona|explica|explique|o que e|o que é)\b/.test(normalized)) {
    return { intent: "pergunta_funcionamento", confidence: 0.86 };
  }

  if (/\b(quero testar|teste|proximo passo|próximo passo|vamos|tenho interesse)\b/.test(normalized)) {
    return { intent: "quer_testar", confidence: 0.86 };
  }

  return { intent: "fora_escopo", confidence: 0.6 };
}

function statusForIntent(intent: SalesIntent): LeadStatus {
  if (intent === "informa_volume_ticket") return "qualificado";
  if (intent === "quer_testar") return "interessado";
  if (intent === "sem_interesse") return "perdido";
  return "em_conversa";
}

function deterministicReply(
  classification: SalesClassification,
  context: { message: string; leadStatus: LeadStatus },
): AgentReply {
  if (context.leadStatus === "interessado" && classification.intent === "fora_escopo") {
    return {
      status: "interessado",
      body: `Obrigado. "${context.message}" registrado. Um humano segue com os próximos passos por aqui.`,
      toolCalls: [],
    };
  }

  if (
    classification.intent === "informa_volume_ticket" &&
    classification.monthlyChanges !== undefined &&
    classification.averageTicket !== undefined
  ) {
    const roi = calculateRoi({
      monthlyChanges: classification.monthlyChanges,
      averageTicket: classification.averageTicket,
    });
    const formattedRevenue = roi.recoveredRevenue.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });

    return {
      status: "qualificado",
      body: `Com ${roi.monthlyChanges} trocas por mês e ticket médio de ${roi.averageTicket.toLocaleString(
        "pt-BR",
        { style: "currency", currency: "BRL", maximumFractionDigits: 0 },
      )}, uma recuperação simples de 10% estima ${formattedRevenue}/mês em receita recuperada. Quer testar o Quando Trocar?`,
      toolCalls: [
        {
          toolName: "calculate_roi",
          input: {
            monthlyChanges: roi.monthlyChanges,
            averageTicket: roi.averageTicket,
            recoveryRate: roi.recoveryRate,
          },
          output: {
            recoveredRevenue: roi.recoveredRevenue,
          },
        },
      ],
    };
  }

  if (classification.intent === "quer_testar") {
    return {
      status: "interessado",
      body: "Perfeito. Nesta etapa eu registro seu interesse e um humano segue com os próximos passos. Para qual cidade é a oficina?",
      toolCalls: [],
    };
  }

  if (classification.intent === "sem_interesse") {
    if (!isExplicitLossMessage(context.message)) {
      return {
        status: context.leadStatus,
        body:
          context.leadStatus === "interessado"
            ? `Obrigado. "${context.message}" registrado. Um humano segue com os próximos passos por aqui.`
            : "Entendi. Vou deixar registrado por aqui. Se quiser saber como funciona ou testar, é só me chamar.",
        toolCalls: [],
      };
    }

    return {
      status: "perdido",
      body: "Entendi. Vou deixar registrado por aqui. Se quiser retomar depois, é só chamar.",
      toolCalls: [],
    };
  }

  return {
    status: statusForIntent(classification.intent),
    body: "Funciona assim: a oficina cadastra a troca, o sistema chama o cliente depois com um lembrete automático e ajuda ele a voltar para a próxima troca. Quantas trocas por mês sua oficina faz e qual é o ticket médio?",
    toolCalls: [],
  };
}

function parseOpenAIClassification(text: string): SalesClassification | null {
  try {
    const parsed = JSON.parse(text) as Partial<SalesClassification>;
    if (
      parsed.intent === "pergunta_funcionamento" ||
      parsed.intent === "informa_volume_ticket" ||
      parsed.intent === "quer_testar" ||
      parsed.intent === "sem_interesse" ||
      parsed.intent === "fora_escopo"
    ) {
      return {
        intent: parsed.intent,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
        monthlyChanges:
          typeof parsed.monthlyChanges === "number" ? parsed.monthlyChanges : undefined,
        averageTicket: typeof parsed.averageTicket === "number" ? parsed.averageTicket : undefined,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export class WhatsappSalesAgent {
  private readonly openai: OpenAI | null;
  private readonly classifierModel: string;

  constructor(input?: { openai?: OpenAI | null; classifierModel?: string }) {
    this.openai =
      input?.openai ??
      (process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null);
    this.classifierModel =
      input?.classifierModel ?? process.env.OPENAI_MODEL_CLASSIFIER ?? "gpt-4o-mini";
  }

  async generateReply(input: { message: string; leadStatus: LeadStatus }): Promise<AgentReply> {
    const deterministic = classifySalesMessage(input.message);

    if (deterministic.confidence >= 0.85) {
      return deterministicReply(deterministic, input);
    }

    const classification = (await this.classifyWithOpenAI(input.message)) ?? deterministic;
    return deterministicReply(classification, input);
  }

  private async classifyWithOpenAI(message: string): Promise<SalesClassification | null> {
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
              "Classifique mensagens comerciais de uma oficina interessada no produto Quando Trocar. Responda apenas JSON compacto com intent, confidence, monthlyChanges e averageTicket quando existirem.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "sales_classification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "pergunta_funcionamento",
                    "informa_volume_ticket",
                    "quer_testar",
                    "sem_interesse",
                    "fora_escopo",
                  ],
                },
                confidence: { type: "number" },
                monthlyChanges: { type: ["number", "null"] },
                averageTicket: { type: ["number", "null"] },
              },
              required: ["intent", "confidence", "monthlyChanges", "averageTicket"],
            },
          },
        },
      });

      const text = response.output_text;
      const parsed = parseOpenAIClassification(text);

      if (!parsed) return null;

      return {
        ...parsed,
        monthlyChanges: parsed.monthlyChanges ?? undefined,
        averageTicket: parsed.averageTicket ?? undefined,
      };
    } catch {
      return null;
    }
  }
}
