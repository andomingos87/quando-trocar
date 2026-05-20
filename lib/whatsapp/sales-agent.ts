import OpenAI from "openai";

import { whatsappLink } from "../config";
import type {
  AgentReply,
  ConfiguracoesVendedor,
  ConversationContext,
  FaqVendasRecord,
  LeadOrigin,
  LeadStatus,
  RoiCalculation,
  SalesAgentInput,
  SalesClassification,
  SalesConversationMemory,
  SalesIntent,
} from "./types";

const DEFAULT_LANDING_PHRASES = ["oi quero testar o quando trocar"];
const DEFAULT_RECOVERY_RATE = 0.15;
const DEFAULT_PRECO_PARTIDA = 59;
const DEFAULT_HANDOFF_WHATSAPP = "+5511945207618";
const SCALE_HANDOFF_VOLUME = 300;

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
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function detectLeadOrigin(
  message: string,
  landingPhrases: string[] = DEFAULT_LANDING_PHRASES,
): LeadOrigin {
  const normalized = normalizeText(message);
  const normalizedPhrases = landingPhrases.map((phrase) => normalizeText(phrase));
  return normalizedPhrases.includes(normalized) ? "landing_page" : "manual_whatsapp";
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

export function detectPriceQuestion(message: string) {
  const normalized = normalizeText(message);
  return /\b(quanto custa|quanto fica|preco|valor|mensalidade|investimento|cobranca|cobram)\b/.test(
    normalized,
  );
}

export function detectScaleHandoff(message: string) {
  const normalized = normalizeText(message);
  return /\b(rede|matriz|filial|filiais|franquia|franquias|grupo de oficinas|varias oficinas|varias unidades)\b/.test(
    normalized,
  );
}

export function detectPain(message: string) {
  const normalized = normalizeText(message);
  return [
    /\bcliente some\b/,
    /\bclientes? somem\b/,
    /\bninguem volta\b/,
    /\bnao volta(m)?\b/,
    /\banoto no caderno\b/,
    /\besqueco de chamar\b/,
    /\besqueco de ligar\b/,
    /\bperco cliente\b/,
    /\bperdi cliente\b/,
    /\bperdi muito cliente\b/,
    /\bperco muito cliente\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function calculateRoi(input: {
  monthlyChanges: number;
  averageTicket: number;
  recoveryRate?: number;
}): RoiCalculation {
  const recoveryRate = input.recoveryRate ?? DEFAULT_RECOVERY_RATE;

  return {
    monthlyChanges: input.monthlyChanges,
    averageTicket: input.averageTicket,
    recoveryRate,
    recoveredRevenue: input.monthlyChanges * input.averageTicket * recoveryRate,
  };
}

const TICKET_HINT = /\b(ticket|medio|media|r\$|reais|valor)\b/;
const VOLUME_HINT = /\b(trocas?|por mes|mensal|atendo|servicos? por mes|clientes? por mes)\b/;

type ExtractedNumbers = {
  monthlyChanges?: number;
  averageTicket?: number;
};

export function extractVolumeOrTicket(message: string): ExtractedNumbers {
  const normalized = normalizeText(message);
  const numbers = [...normalized.matchAll(/\d+(?:[,.]\d+)?/g)].map((match) =>
    Number(match[0].replace(",", ".")),
  );

  if (numbers.length === 0) return {};

  if (numbers.length >= 2) {
    const ticketIndex = normalized.search(TICKET_HINT);
    if (ticketIndex >= 0) {
      const tokens = [...normalized.matchAll(/\d+(?:[,.]\d+)?/g)];
      const ticketToken = tokens.find(
        (match) => match.index !== undefined && match.index > ticketIndex,
      );
      if (ticketToken) {
        const averageTicket = Number(ticketToken[0].replace(",", "."));
        const monthlyChanges = numbers.find((value) => value !== averageTicket) ?? numbers[0];
        return { monthlyChanges, averageTicket };
      }
    }
    return { monthlyChanges: numbers[0], averageTicket: numbers[1] };
  }

  const onlyNumber = numbers[0];
  if (TICKET_HINT.test(normalized) && !VOLUME_HINT.test(normalized)) {
    return { averageTicket: onlyNumber };
  }
  if (VOLUME_HINT.test(normalized) && !TICKET_HINT.test(normalized)) {
    return { monthlyChanges: onlyNumber };
  }

  return {};
}

export function matchFaq(
  message: string,
  faqs: ReadonlyArray<FaqVendasRecord>,
): FaqVendasRecord | null {
  if (!faqs.length) return null;
  const normalized = normalizeText(message);

  let best: { faq: FaqVendasRecord; matches: number } | null = null;
  for (const faq of faqs) {
    let matches = 0;
    for (const keyword of faq.palavras_chave) {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) continue;
      if (normalized.includes(normalizedKeyword)) matches += 1;
    }
    if (matches > 0) {
      if (!best || matches > best.matches || (matches === best.matches && faq.ordem < best.faq.ordem)) {
        best = { faq, matches };
      }
    }
  }

  return best?.faq ?? null;
}

export function classifySalesMessage(
  message: string,
  faqs: ReadonlyArray<FaqVendasRecord> = [],
): SalesClassification {
  if (isExplicitLossMessage(message)) {
    return { intent: "sem_interesse", confidence: 0.9 };
  }

  if (detectPriceQuestion(message)) {
    return { intent: "pergunta_preco", confidence: 0.92 };
  }

  const numbers = extractVolumeOrTicket(message);
  if (numbers.monthlyChanges !== undefined || numbers.averageTicket !== undefined) {
    return {
      intent: "informa_volume_ticket",
      confidence: 0.86,
      ...numbers,
    };
  }

  const normalized = normalizeText(message);

  if (/\b(como funciona|funciona|explica|explique|o que e|o que faz)\b/.test(normalized)) {
    return { intent: "pergunta_funcionamento", confidence: 0.86 };
  }

  if (/\b(quero testar|teste|proximo passo|vamos|tenho interesse|bora|topo)\b/.test(normalized)) {
    return { intent: "quer_testar", confidence: 0.86 };
  }

  const faqMatch = matchFaq(message, faqs);
  if (faqMatch) {
    return { intent: "pergunta_faq", confidence: 0.85, faqId: faqMatch.id };
  }

  return { intent: "fora_escopo", confidence: 0.6 };
}

function statusForIntent(intent: SalesIntent): LeadStatus {
  if (intent === "informa_volume_ticket") return "qualificado";
  if (intent === "quer_testar") return "interessado";
  if (intent === "sem_interesse") return "perdido";
  return "em_conversa";
}

function formatBrl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function painPrefix(memory: SalesConversationMemory, message: string) {
  if (memory.pain_detected) return null;
  if (!detectPain(message)) return null;
  return "Pois e chefe, e isso que a gente resolve aqui.";
}

function withPain(memory: SalesConversationMemory, message: string, body: string) {
  const prefix = painPrefix(memory, message);
  if (!prefix) return { body, painDetected: memory.pain_detected ?? false };
  return { body: `${prefix} ${body}`, painDetected: true };
}

function commercialHandoff(handoffWhatsapp: string) {
  const link = whatsappLink({ phone: handoffWhatsapp });
  return `Chefe, pra esse caso eu prefiro o Anderson conversar direto contigo. Posso pedir pra ele te chamar agora: ${link}`;
}

type ReplyContext = {
  message: string;
  leadStatus: LeadStatus;
  memory: SalesConversationMemory;
  salesConfig: ConfiguracoesVendedor;
};

function buildReply(
  classification: SalesClassification,
  context: ReplyContext,
): AgentReply {
  const memory: SalesConversationMemory = { ...context.memory };

  // Handoff direto por porte (rede/franquia)
  if (detectScaleHandoff(context.message)) {
    return {
      status: context.leadStatus === "novo" ? "em_conversa" : context.leadStatus,
      body: commercialHandoff(context.salesConfig.whatsappHandoffComercial),
      toolCalls: [],
      handoffRequired: true,
      handoffReason: "rede_ou_franquia",
      updatedContext: { sales: memory },
    };
  }

  // Pergunta de preco — soft redirect na 1a, handoff na 2a
  if (classification.intent === "pergunta_preco") {
    const previous = memory.price_mentions ?? 0;
    const nextCount = previous + 1;
    memory.price_mentions = nextCount;

    if (nextCount === 1) {
      const partida = formatBrl(context.salesConfig.precoPartida);
      const reply = withPain(
        memory,
        context.message,
        `Olha chefe, parte de ${partida}/mes. O valor final a gente fecha olhando o tamanho da sua oficina, mas antes de combinar preco, bora ativar 14 dias gratis pra voce ver rodando?`,
      );
      memory.pain_detected = reply.painDetected;
      return {
        status: context.leadStatus,
        body: reply.body,
        toolCalls: [],
        updatedContext: { sales: memory },
      };
    }

    return {
      status: context.leadStatus,
      body: commercialHandoff(context.salesConfig.whatsappHandoffComercial),
      toolCalls: [],
      handoffRequired: true,
      handoffReason: "preco_insistente",
      updatedContext: { sales: memory },
    };
  }

  // FAQ
  if (classification.intent === "pergunta_faq" && classification.faqId) {
    // resposta vem do banco — buildReply só sabe o id; quem injeta o texto é o caller.
    // Marker reply: caller resolve.
    return {
      status: context.leadStatus,
      body: "__FAQ_PLACEHOLDER__",
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Volume e ticket — com memoria
  if (classification.intent === "informa_volume_ticket") {
    const volume = classification.monthlyChanges ?? memory.volume_known;
    const ticket = classification.averageTicket ?? memory.ticket_known;

    if (classification.monthlyChanges !== undefined) memory.volume_known = classification.monthlyChanges;
    if (classification.averageTicket !== undefined) memory.ticket_known = classification.averageTicket;

    // Handoff por volume alto
    if (volume !== undefined && volume > SCALE_HANDOFF_VOLUME) {
      return {
        status: context.leadStatus,
        body: commercialHandoff(context.salesConfig.whatsappHandoffComercial),
        toolCalls: [],
        handoffRequired: true,
        handoffReason: "volume_alto",
        updatedContext: { sales: memory },
      };
    }

    if (volume === undefined || ticket === undefined) {
      const ask = volume === undefined ? "quantas trocas voce faz por mes?" : "qual o ticket medio?";
      const reply = withPain(
        memory,
        context.message,
        `Beleza chefe, me ajuda com um numero: ${ask}`,
      );
      memory.pain_detected = reply.painDetected;
      return {
        status: statusForIntent(classification.intent),
        body: reply.body,
        toolCalls: [],
        updatedContext: { sales: memory },
      };
    }

    const recoveryRate = context.salesConfig.taxaRecuperacaoRoi;
    const roi = calculateRoi({ monthlyChanges: volume, averageTicket: ticket, recoveryRate });
    const recoveredFmt = formatBrl(roi.recoveredRevenue);
    const ticketFmt = formatBrl(ticket);
    const pct = Math.round(recoveryRate * 100);

    const body = `Olha chefe, oficinas do seu tamanho costumam trazer de volta uns ${pct}% dos clientes que somem. Com ${volume} trocas/mes e ticket de ${ticketFmt}, pra voce isso seria uns ${recoveredFmt}/mes caindo de novo na oficina. Bora ativar 14 dias gratis pra testar?`;
    const reply = withPain(memory, context.message, body);
    memory.pain_detected = reply.painDetected;

    return {
      status: "qualificado",
      body: reply.body,
      toolCalls: [
        {
          toolName: "calculate_roi",
          input: { monthlyChanges: volume, averageTicket: ticket, recoveryRate },
          output: { recoveredRevenue: roi.recoveredRevenue },
        },
      ],
      updatedContext: { sales: memory },
    };
  }

  // Quero testar
  if (classification.intent === "quer_testar") {
    return {
      status: "teste_aceito",
      body: "Beleza chefe! Vou cadastrar sua oficina em teste por aqui mesmo.",
      toolCalls: [],
      convertToOficina: true,
      updatedContext: { sales: memory },
    };
  }

  // Sem interesse
  if (classification.intent === "sem_interesse") {
    if (!isExplicitLossMessage(context.message)) {
      return {
        status: context.leadStatus,
        body:
          context.leadStatus === "interessado"
            ? `Anotado chefe: "${context.message}". O Anderson segue daqui com os proximos passos.`
            : "Tranquilo chefe, deixo registrado. Se quiser saber como funciona ou testar, e so me chamar.",
        toolCalls: [],
        updatedContext: { sales: memory },
      };
    }

    return {
      status: "perdido",
      body: "Tranquilo chefe, deixo registrado. Se mudar de ideia, e so me chamar de novo.",
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Pergunta funcionamento
  if (classification.intent === "pergunta_funcionamento") {
    const reply = withPain(
      memory,
      context.message,
      "Funciona assim chefe: voce cadastra a troca aqui, o sistema chama o cliente no dia certo da proxima e te avisa quem voltou. Pra eu te mostrar quanto isso vale pra sua oficina, quantas trocas voce faz por mes e qual o ticket medio?",
    );
    memory.pain_detected = reply.painDetected;
    return {
      status: statusForIntent(classification.intent),
      body: reply.body,
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Fora de escopo — se ja interessado, segura status
  if (context.leadStatus === "interessado") {
    return {
      status: "interessado",
      body: `Anotado chefe: "${context.message}". O Anderson segue daqui.`,
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  const fallback = withPain(
    memory,
    context.message,
    "Funciona assim chefe: voce cadastra a troca aqui, o sistema chama o cliente no dia certo e te avisa quem voltou. Pra eu te dar um numero, quantas trocas voce faz por mes e qual o ticket medio?",
  );
  memory.pain_detected = fallback.painDetected;

  return {
    status: statusForIntent(classification.intent),
    body: fallback.body,
    toolCalls: [],
    updatedContext: { sales: memory },
  };
}

function parseOpenAIClassification(text: string): SalesClassification | null {
  try {
    const parsed = JSON.parse(text) as Partial<SalesClassification>;
    if (
      parsed.intent === "pergunta_funcionamento" ||
      parsed.intent === "informa_volume_ticket" ||
      parsed.intent === "pergunta_preco" ||
      parsed.intent === "pergunta_faq" ||
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

function defaultConfig(): ConfiguracoesVendedor {
  return {
    taxaRecuperacaoRoi: DEFAULT_RECOVERY_RATE,
    whatsappHandoffComercial: DEFAULT_HANDOFF_WHATSAPP,
    frasesLanding: DEFAULT_LANDING_PHRASES,
    precoPartida: DEFAULT_PRECO_PARTIDA,
  };
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

  async generateReply(input: SalesAgentInput): Promise<AgentReply> {
    const salesConfig = input.salesConfig ?? defaultConfig();
    const faqs = input.faqs ?? [];
    const memory: SalesConversationMemory = { ...(input.context?.sales ?? {}) };

    const deterministic = classifySalesMessage(input.message, faqs);

    let classification: SalesClassification = deterministic;
    if (deterministic.confidence < 0.85) {
      const fromOpenAI = await this.classifyWithOpenAI(input.message);
      if (fromOpenAI) {
        // Se o LLM disser pergunta_faq, prefiro o match deterministico.
        if (fromOpenAI.intent === "pergunta_faq") {
          const faq = matchFaq(input.message, faqs);
          classification = faq
            ? { ...fromOpenAI, faqId: faq.id }
            : deterministic;
        } else {
          classification = fromOpenAI;
        }
      }
    }

    const reply = buildReply(classification, {
      message: input.message,
      leadStatus: input.leadStatus,
      memory,
      salesConfig,
    });

    // Resolve FAQ placeholder
    if (reply.body === "__FAQ_PLACEHOLDER__" && classification.faqId) {
      const faq = faqs.find((item) => item.id === classification.faqId);
      if (faq) {
        const replyMemory = reply.updatedContext?.sales ?? memory;
        const withPainPrefix = withPain(replyMemory, input.message, faq.resposta);
        const newMemory: SalesConversationMemory = {
          ...replyMemory,
          pain_detected: withPainPrefix.painDetected,
        };
        return {
          ...reply,
          body: withPainPrefix.body,
          toolCalls: [
            {
              toolName: "faq_lookup",
              input: { faqId: faq.id, pergunta: faq.pergunta },
              output: { resposta: faq.resposta },
            },
          ],
          updatedContext: { sales: newMemory },
        };
      }
      // Sem FAQ encontrada (raro): cai pro fallback
      return buildReply(
        { intent: "fora_escopo", confidence: 0.5 },
        { message: input.message, leadStatus: input.leadStatus, memory, salesConfig },
      );
    }

    return reply;
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
                    "pergunta_preco",
                    "pergunta_faq",
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

export type { ConversationContext };
