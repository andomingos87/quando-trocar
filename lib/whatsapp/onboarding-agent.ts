import OpenAI from "openai";

import { normalizeText, normalizeWhatsappPhone } from "./sales-agent";
import type {
  ConversationAgentMode,
  ConversationContext,
  OnboardingAgent,
  OnboardingAgentReply,
  RegisterServiceInput,
  ServiceDraft,
} from "./types";

type MissingField = NonNullable<ConversationContext["missing_field"]>;

const WEEKDAY_PATTERN = /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/;

function isoDateOffset(today: string, offsetDays: number) {
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function hasNegativeConsent(message: string) {
  const normalized = normalizeText(message);
  return (
    /\bnao autorizou\b/.test(normalized) ||
    /\bsem autorizacao\b/.test(normalized) ||
    /\bnao pode mandar\b/.test(normalized) ||
    /\bnao quer receber\b/.test(normalized)
  );
}

function extractPhone(message: string) {
  const matches = [...message.matchAll(/(?:\+?\d[\d\s().-]{8,}\d)/g)]
    .map((match) => match[0])
    .filter((value) => value.replace(/\D/g, "").length >= 10);

  return matches.at(-1) ?? null;
}

function removePhone(message: string, phone: string | null) {
  if (!phone) return message;
  return message.replace(phone, "").replace(/\s*,\s*$/, "").trim();
}

function extractDate(message: string, today: string) {
  const normalized = normalizeText(message);
  if (/\bhoje\b/.test(normalized)) {
    return { date: today, ambiguous: false };
  }
  if (/\bontem\b/.test(normalized)) {
    return { date: isoDateOffset(today, -1), ambiguous: false };
  }
  if (WEEKDAY_PATTERN.test(normalized)) {
    return { date: null, ambiguous: true };
  }

  const dateMatch = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!dateMatch) {
    return { date: null, ambiguous: false };
  }

  const day = dateMatch[1].padStart(2, "0");
  const month = dateMatch[2].padStart(2, "0");
  const year = dateMatch[3]
    ? dateMatch[3].length === 2
      ? `20${dateMatch[3]}`
      : dateMatch[3]
    : today.slice(0, 4);

  return { date: `${year}-${month}-${day}`, ambiguous: false };
}

function cleanServiceText(input: string) {
  return input
    .replace(/\bhoje\b/gi, "")
    .replace(/\bontem\b/gi, "")
    .replace(WEEKDAY_PATTERN, "")
    .replace(/cliente\s+nao\s+autorizou\s+mensagem/gi, "")
    .replace(/cliente\s+não\s+autorizou\s+mensagem/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

function parseDeterministic(message: string, today: string): ServiceDraft {
  const phone = extractPhone(message);
  const withoutPhone = removePhone(message, phone);
  const parts = withoutPhone
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const serviceSource = parts.slice(2).join(", ") || parts[2] || "";
  const parsedDate = extractDate(message, today);
  const service = cleanServiceText(serviceSource);
  const draft: ServiceDraft = {
    valor: null,
    consentimento_whatsapp: !hasNegativeConsent(message),
  };

  if (parts[0]) draft.nome_cliente = parts[0];
  if (parts[1]) draft.veiculo = parts[1];
  if (service) draft.servico = service;
  if (phone) draft.whatsapp_cliente = normalizeWhatsappPhone(phone);
  if (parsedDate.date) draft.data_servico = parsedDate.date;

  return draft;
}

function applyFollowUp(
  context: ConversationContext,
  message: string,
  today: string,
): ServiceDraft {
  const draft = { ...(context.service_draft ?? {}) };

  if (context.missing_field === "whatsapp_cliente") {
    const phone = extractPhone(message) ?? message;
    draft.whatsapp_cliente = normalizeWhatsappPhone(phone);
  }

  if (context.missing_field === "nome_cliente") {
    draft.nome_cliente = message.trim();
  }

  if (context.missing_field === "veiculo") {
    draft.veiculo = message.trim();
  }

  if (context.missing_field === "servico") {
    draft.servico = cleanServiceText(message);
  }

  if (context.missing_field === "data_servico") {
    const parsedDate = extractDate(message, today);
    if (parsedDate.date) {
      draft.data_servico = parsedDate.date;
    }
  }

  return draft;
}

function missingFieldForDraft(draft: ServiceDraft): MissingField | null {
  if (!draft.nome_cliente) return "nome_cliente";
  if (!draft.whatsapp_cliente) return "whatsapp_cliente";
  if (!draft.veiculo) return "veiculo";
  if (!draft.servico) return "servico";
  if (!draft.data_servico) return "data_servico";
  return null;
}

function questionForMissingField(field: MissingField) {
  if (field === "nome_cliente") return "Qual é o nome do cliente?";
  if (field === "whatsapp_cliente") return "Qual é o WhatsApp do cliente?";
  if (field === "veiculo") return "Qual é o carro?";
  if (field === "servico") return "Foi troca de óleo ou outro serviço?";
  return "Qual foi a data do serviço?";
}

function draftToRegisterInput(
  draft: ServiceDraft,
): Omit<RegisterServiceInput, "oficinaId"> {
  return {
    nomeCliente: draft.nome_cliente!,
    whatsappCliente: draft.whatsapp_cliente!,
    veiculo: draft.veiculo!,
    servico: draft.servico!,
    dataServico: draft.data_servico!,
    valor: draft.valor ?? null,
    consentimentoWhatsapp: draft.consentimento_whatsapp ?? true,
  };
}

function draftContext(draft: ServiceDraft, missingField: MissingField): ConversationContext {
  return {
    pending_action: "registrar_primeira_troca",
    missing_field: missingField,
    service_draft: draft,
  };
}

function parseOpenAIExtraction(text: string): ServiceDraft | null {
  try {
    const parsed = JSON.parse(text) as {
      data?: {
        nome_cliente?: string | null;
        whatsapp_cliente?: string | null;
        veiculo?: string | null;
        servico?: string | null;
        data_servico?: string | null;
        valor?: number | null;
        consentimento_whatsapp?: boolean | null;
      };
    };
    if (!parsed.data) return null;
    return {
      nome_cliente: parsed.data.nome_cliente ?? undefined,
      whatsapp_cliente: parsed.data.whatsapp_cliente
        ? normalizeWhatsappPhone(parsed.data.whatsapp_cliente)
        : undefined,
      veiculo: parsed.data.veiculo ?? undefined,
      servico: parsed.data.servico ?? undefined,
      data_servico: parsed.data.data_servico ?? undefined,
      valor: parsed.data.valor ?? null,
      consentimento_whatsapp: parsed.data.consentimento_whatsapp ?? true,
    };
  } catch {
    return null;
  }
}

export class WhatsappOnboardingAgent implements OnboardingAgent {
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
    mode: Extract<ConversationAgentMode, "onboarding" | "operacao">;
    context: ConversationContext;
    today: string;
  }): Promise<OnboardingAgentReply> {
    const draft =
      input.context.missing_field && input.context.service_draft
        ? applyFollowUp(input.context, input.message, input.today)
        : await this.extractDraft(input.message, input.today);
    const missingField = missingFieldForDraft(draft);

    if (missingField) {
      return {
        body: questionForMissingField(missingField),
        context: draftContext(draft, missingField),
        registerServiceInput: null,
        nextAgentMode: null,
        toolCalls: [],
      };
    }

    return {
      body: "",
      context: {},
      registerServiceInput: draftToRegisterInput(draft),
      nextAgentMode: input.mode === "onboarding" ? "operacao" : null,
      toolCalls: [],
    };
  }

  private async extractDraft(message: string, today: string): Promise<ServiceDraft> {
    const deterministic = parseDeterministic(message, today);

    if (
      deterministic.nome_cliente &&
      deterministic.veiculo &&
      deterministic.servico &&
      (deterministic.whatsapp_cliente || deterministic.data_servico)
    ) {
      return deterministic;
    }

    const aiDraft = await this.extractWithOpenAI(message);
    return { ...deterministic, ...(aiDraft ?? {}) };
  }

  private async extractWithOpenAI(message: string): Promise<ServiceDraft | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.responses.create({
        model: this.classifierModel,
        input: [
          {
            role: "system",
            content:
              "Extraia dados de cadastro de troca de oficina. Responda apenas JSON compacto no schema solicitado.",
          },
          { role: "user", content: message },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "service_registration",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: { type: "string", enum: ["registrar_troca", "outro"] },
                confidence: { type: "number" },
                missing_fields: {
                  type: "array",
                  items: { type: "string" },
                },
                data: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    nome_cliente: { type: ["string", "null"] },
                    whatsapp_cliente: { type: ["string", "null"] },
                    veiculo: { type: ["string", "null"] },
                    servico: { type: ["string", "null"] },
                    data_servico: { type: ["string", "null"] },
                    valor: { type: ["number", "null"] },
                    consentimento_whatsapp: { type: ["boolean", "null"] },
                  },
                  required: [
                    "nome_cliente",
                    "whatsapp_cliente",
                    "veiculo",
                    "servico",
                    "data_servico",
                    "valor",
                    "consentimento_whatsapp",
                  ],
                },
              },
              required: ["intent", "confidence", "missing_fields", "data"],
            },
          },
        },
      });

      return parseOpenAIExtraction(response.output_text);
    } catch {
      return null;
    }
  }
}
