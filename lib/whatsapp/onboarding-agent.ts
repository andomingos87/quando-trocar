import OpenAI from "openai";

import { normalizeText, normalizeWhatsappPhone } from "./sales-agent";
import type {
  ConversationAgentMode,
  ConversationContext,
  MarcaAmortecedor,
  OnboardingAgent,
  OnboardingAgentReply,
  RegisterServiceInput,
  ServiceDraft,
  TipoServico,
} from "./types";

type MissingField = NonNullable<ConversationContext["missing_field"]>;

const WEEKDAY_PATTERN = /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/;
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;
const SERVICE_PATTERN =
  /\b(troca|oleo|óleo|revisao|revisão|filtro|pastilha|freio|alinhamento|balanceamento|servico|serviço|amortecedor)\b/;
const NEUTRAL_PATTERN = /^(ok|okay|obrigado|obrigada|valeu|beleza|bom dia|boa tarde|boa noite|certo)$/;
const PROMPT_INJECTION_PATTERN =
  /\b(ignore|ignora|instrucoes|instruções|prompt|sistema|system|developer|delete|apague|drop table|sql|senha|token|segredo)\b/;

const TIPO_AMORTECEDOR_PATTERN = /\bamortecedor(es)?\b/;
const TIPO_OLEO_PATTERN = /\b(troca\s+de\s+oleo|oleo|filtro\s+de\s+oleo)\b/;
const TIPO_REVISAO_PATTERN = /\b(revisao|revisar)\b/;

const MARCA_VALIDAS: ReadonlyArray<MarcaAmortecedor> = [
  "perfect",
  "monroe",
  "cofap",
  "nakata",
  "outra",
];

function detectTipoServico(servico: string | undefined | null): TipoServico {
  if (!servico) return "troca_oleo";
  const normalized = normalizeText(servico);
  if (TIPO_AMORTECEDOR_PATTERN.test(normalized)) return "amortecedor";
  if (TIPO_OLEO_PATTERN.test(normalized)) return "troca_oleo";
  if (TIPO_REVISAO_PATTERN.test(normalized)) return "revisao";
  if (/\b(alinhamento|balanceamento|freio|pastilha|suspensao|pneu)\b/.test(normalized)) {
    return "outro";
  }
  return "troca_oleo";
}

function normalizeMarca(input: string | null | undefined): MarcaAmortecedor | null {
  if (!input) return null;
  const n = normalizeText(input).replace(/\s+/g, "");
  if (!n) return null;
  if (/perfec/.test(n)) return "perfect";
  if (/monroe|monro/.test(n)) return "monroe";
  if (/cofap/.test(n)) return "cofap";
  if (/nakat/.test(n)) return "nakata";
  if (/^(outra|outro|outras|outros|naosei|nao\s*sei)$/.test(n)) return "outra";
  return null;
}

function extractMarcaFromMessage(message: string): MarcaAmortecedor | null {
  const normalized = normalizeText(message);
  for (const marca of MARCA_VALIDAS) {
    const aliases =
      marca === "perfect" ? "perfec" : marca === "nakata" ? "nakat" : marca === "monroe" ? "monro" : marca;
    if (new RegExp(`\\b${aliases}\\w*\\b`).test(normalized)) {
      return marca;
    }
  }
  return null;
}

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

function isPromptInjectionAttempt(message: string) {
  return PROMPT_INJECTION_PATTERN.test(normalizeText(message));
}

function isNeutralMessage(message: string) {
  return NEUTRAL_PATTERN.test(normalizeText(message));
}

function isQuestionLike(message: string) {
  const normalized = normalizeText(message);
  return message.includes("?") || /^(qual|como|porque|por que|quando|onde|quem)\b/.test(normalized);
}

function hasRegistrationSignal(message: string) {
  const normalized = normalizeText(message);
  const commaCount = (message.match(/,/g) ?? []).length;
  const hasPhone = extractPhone(message) !== null;
  const hasService = SERVICE_PATTERN.test(normalized);

  return (commaCount >= 2 && (hasPhone || hasService)) || (hasPhone && hasService);
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

// A oficina às vezes envia o nome embrulhado em frase de intenção
// ("Quero cadastrar o cliente Luca Marcilli") ou com rótulo/pontuação solta.
// Normalizamos para guardar SOMENTE o nome, estruturado (sem prefixos de
// intenção, sem pontuação nas pontas, com caixa de nome próprio).
const NOME_CLIENTE_STRIP_PATTERNS: ReadonlyArray<RegExp> = [
  // pronome / cortesia inicial
  /^(?:eu\s+)?(?:quero|queria|gostaria(?:\s+de)?|preciso(?:\s+de)?|vou|pode(?:r(?:ia)?)?|favor|por\s+favor|me\s+ajud\w*(?:\s+a)?)\s+/i,
  // verbos de cadastro
  /^(?:cadastr\w*|registr\w*|adicion\w*|inclu\w*|inser\w*|anot\w*|salv\w*|coloc\w*|criar?|abrir?)\s+/i,
  // artigos / determinantes
  /^(?:o|a|os|as|um|uma|esse|essa|este|esta|aquele|aquela|meu|minha|novo|nova)\s+/i,
  // rótulo cliente / nome
  /^(?:clientes?|clienta|nome(?:\s+(?:do|da|de))?(?:\s+cliente)?)\b\s*/i,
  // conectores
  /^(?:chamad[oa]|de\s+nome|que\s+(?:se\s+)?chama|é|eh|seria)\s+/i,
  // pontuação residual nas pontas
  /^[\s:,.\-]+/,
];

const NOME_PARTICULAS_MINUSCULAS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

function toTitleCaseName(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && NOME_PARTICULAS_MINUSCULAS.has(word)) return word;
      return word.replace(/(^|[-'])(\p{L})/gu, (_, sep: string, ch: string) =>
        sep + ch.toLocaleUpperCase("pt-BR"),
      );
    })
    .join(" ");
}

export function normalizeNomeCliente(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  let value = raw.replace(/\s+/g, " ").trim();
  if (!value) return null;

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of NOME_CLIENTE_STRIP_PATTERNS) {
      const next = value.replace(pattern, "");
      if (next !== value) {
        value = next.trim();
        changed = true;
      }
    }
  }

  value = value.replace(/[\s:,.\-]+$/g, "").trim();
  if (!value) return null;

  return toTitleCaseName(value);
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

  if (parts[0]) {
    const nome = normalizeNomeCliente(parts[0]);
    if (nome) draft.nome_cliente = nome;
  }
  if (parts[1]) draft.veiculo = parts[1];
  if (service) draft.servico = service;
  if (phone) draft.whatsapp_cliente = normalizeWhatsappPhone(phone);
  if (parsedDate.date) draft.data_servico = parsedDate.date;

  if (service) {
    const tipo = detectTipoServico(service);
    draft.tipo_servico = tipo;
    if (tipo === "amortecedor") {
      const marca = extractMarcaFromMessage(message);
      if (marca) draft.marca_peca = marca;
    }
  }

  return draft;
}

function applyFollowUp(
  context: ConversationContext,
  message: string,
  today: string,
): ServiceDraft {
  const draft = { ...(context.service_draft ?? {}) };

  if (context.missing_field === "whatsapp_cliente") {
    const phone = extractPhone(message);
    if (phone) {
      const normalizedPhone = normalizeWhatsappPhone(phone);
      if (E164_PATTERN.test(normalizedPhone)) {
        draft.whatsapp_cliente = normalizedPhone;
      }
    }
  }

  if (context.missing_field === "nome_cliente") {
    if (!isNeutralMessage(message) && !isQuestionLike(message) && message.trim().length >= 2) {
      const nome = normalizeNomeCliente(message);
      if (nome) draft.nome_cliente = nome;
    }
  }

  if (context.missing_field === "veiculo") {
    if (!isNeutralMessage(message) && !isQuestionLike(message) && message.trim().length >= 3) {
      draft.veiculo = message.trim();
    }
  }

  if (context.missing_field === "servico") {
    const service = cleanServiceText(message);
    if (!isNeutralMessage(message) && !isQuestionLike(message) && service.length >= 3) {
      draft.servico = service;
    }
  }

  if (context.missing_field === "data_servico") {
    const parsedDate = extractDate(message, today);
    if (parsedDate.date) {
      draft.data_servico = parsedDate.date;
    }
  }

  if (context.missing_field === "marca_peca") {
    const marca = normalizeMarca(message) ?? extractMarcaFromMessage(message);
    if (marca) {
      draft.marca_peca = marca;
    } else if (!isNeutralMessage(message) && !isQuestionLike(message)) {
      // Resposta livre que nao casa com lista fechada vira 'outra'.
      draft.marca_peca = "outra";
    }
  }

  if (draft.servico && !draft.tipo_servico) {
    draft.tipo_servico = detectTipoServico(draft.servico);
  }

  return draft;
}

function missingFieldForDraft(draft: ServiceDraft): MissingField | null {
  if (!draft.nome_cliente) return "nome_cliente";
  if (!draft.whatsapp_cliente) return "whatsapp_cliente";
  if (!draft.veiculo) return "veiculo";
  if (!draft.servico) return "servico";
  if (!draft.data_servico) return "data_servico";
  const tipo = draft.tipo_servico ?? detectTipoServico(draft.servico);
  if (tipo === "amortecedor" && !draft.marca_peca) return "marca_peca";
  return null;
}

function registrationExample() {
  return "Exemplo: Joao Silva, Civic 2018, troca de oleo, hoje, 41999990000.";
}

function questionForMissingField(field: MissingField) {
  if (field === "nome_cliente") return "Perfeito. Falta so o nome do cliente.";
  if (field === "whatsapp_cliente") return "Perfeito. Agora me passe o WhatsApp do cliente.";
  if (field === "veiculo") return "Certo. Qual e o carro do cliente?";
  if (field === "servico") return "Certo. Qual servico foi feito?";
  if (field === "data_servico") return "Certo. Qual foi a data do servico?";
  return "Anotei amortecedor. Qual a marca da peca? (Cofap, Monroe, Nakata, Perfect, outra)";
}

function draftToRegisterInput(
  draft: ServiceDraft,
): Omit<RegisterServiceInput, "oficinaId"> {
  const tipoServico = draft.tipo_servico ?? detectTipoServico(draft.servico);
  const marcaPeca = tipoServico === "amortecedor" ? draft.marca_peca ?? null : null;
  return {
    nomeCliente: draft.nome_cliente!,
    whatsappCliente: draft.whatsapp_cliente!,
    veiculo: draft.veiculo!,
    servico: draft.servico!,
    dataServico: draft.data_servico!,
    valor: draft.valor ?? null,
    consentimentoWhatsapp: draft.consentimento_whatsapp ?? true,
    tipoServico,
    marcaPeca,
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
        tipo_servico?: string | null;
        marca_peca?: string | null;
      };
    };
    if (!parsed.data) return null;
    const tipoRaw = parsed.data.tipo_servico ?? null;
    const tipo: TipoServico | undefined =
      tipoRaw === "troca_oleo" ||
      tipoRaw === "amortecedor" ||
      tipoRaw === "revisao" ||
      tipoRaw === "outro"
        ? tipoRaw
        : parsed.data.servico
          ? detectTipoServico(parsed.data.servico)
          : undefined;
    const marca = normalizeMarca(parsed.data.marca_peca ?? null);
    return {
      nome_cliente: normalizeNomeCliente(parsed.data.nome_cliente) ?? undefined,
      whatsapp_cliente: parsed.data.whatsapp_cliente
        ? normalizeWhatsappPhone(parsed.data.whatsapp_cliente)
        : undefined,
      veiculo: parsed.data.veiculo ?? undefined,
      servico: parsed.data.servico ?? undefined,
      data_servico: parsed.data.data_servico ?? undefined,
      valor: parsed.data.valor ?? null,
      consentimento_whatsapp: parsed.data.consentimento_whatsapp ?? true,
      tipo_servico: tipo,
      marca_peca: tipo === "amortecedor" ? marca : null,
    };
  } catch {
    return null;
  }
}

function neutralReply(message: string): OnboardingAgentReply {
  const normalized = normalizeText(message);
  const isGreeting =
    /\b(oi|ola|olá|bom dia|boa tarde|boa noite)\b/.test(normalized) ||
    /\bcomo eu faco\b/.test(normalized) ||
    /\bcomo faco\b/.test(normalized);

  return {
    body: isGreeting
      ? [
          "Bom dia. Posso registrar a troca por aqui.",
          "Me envie em uma mensagem: nome do cliente, carro, servico, data e WhatsApp.",
          registrationExample(),
        ].join("\n")
      : [
          "Posso registrar por aqui.",
          "Me envie nome do cliente, carro, servico, data e WhatsApp.",
          registrationExample(),
        ].join("\n"),
    context: {},
    registerServiceInput: null,
    nextAgentMode: null,
    toolCalls: [
      {
        toolName: "ignored_operational_message",
        input: { message },
        output: { reason: "no_registration_signal" },
      },
    ],
  };
}

function blockedPromptInjectionReply(message: string): OnboardingAgentReply {
  return {
    body:
      "Nao consigo ajudar com esse tipo de solicitacao. Para registrar uma troca, envie nome do cliente, carro, servico, data e WhatsApp.",
    context: {},
    registerServiceInput: null,
    nextAgentMode: null,
    toolCalls: [
      {
        toolName: "blocked_prompt_injection",
        input: { message },
        output: { reason: "prompt_injection_signal" },
      },
    ],
  };
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
    if (isPromptInjectionAttempt(input.message)) {
      return blockedPromptInjectionReply(input.message);
    }

    if (!input.context.missing_field && !hasRegistrationSignal(input.message)) {
      return neutralReply(input.message);
    }

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

    const aiDraft = hasRegistrationSignal(message) ? await this.extractWithOpenAI(message) : null;
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
                    tipo_servico: {
                      type: ["string", "null"],
                      enum: ["troca_oleo", "amortecedor", "revisao", "outro", null],
                    },
                    marca_peca: {
                      type: ["string", "null"],
                      enum: ["perfect", "monroe", "cofap", "nakata", "outra", null],
                    },
                  },
                  required: [
                    "nome_cliente",
                    "whatsapp_cliente",
                    "veiculo",
                    "servico",
                    "data_servico",
                    "valor",
                    "consentimento_whatsapp",
                    "tipo_servico",
                    "marca_peca",
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
