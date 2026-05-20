import OpenAI from "openai";

import { normalizeText } from "./sales-agent";
import type {
  CobrancaAgent,
  CobrancaAgentReply,
  CobrancaIntent,
  CobrancaPendingPayment,
  CobrancaSubmode,
  ConversationContext,
} from "./types";

type CobrancaClassification = {
  intent: CobrancaIntent;
  confidence: number;
};

const PEDIU_LINK_PATTERNS = [
  /\b(manda|envia|me manda|me envia|preciso|quero)\s+(o\s+)?link\b/,
  /\blink\s+(de\s+)?pagamento\b/,
  /\bcomo\s+(eu\s+)?pago\b/,
  /\bonde\s+(eu\s+)?pago\b/,
];

const NEGOCIA_PATTERNS = [
  /\bposso pagar (dia|so dia|amanha|na sexta|segunda|terca|quarta|quinta|semana que vem)\b/,
  /\bda\s+pra\s+(parcelar|dividir|adiar)\b/,
  /\bparcelar?\b/,
  /\bparcel(a|amento)\b/,
  /\bdesconto\b/,
  /\bsem grana\b/,
  /\bnao tenho (como pagar|grana|dinheiro)\b/,
  /\bprorrogar\b/,
  /\badiar\b/,
];

const JA_PAGUEI_PATTERNS = [
  /\bja paguei\b/,
  /\bpaguei ontem\b/,
  /\bpaguei hoje\b/,
  /\bpaguei semana passada\b/,
  /\bvoces nao receberam\b/,
];

const VAI_PAGAR_PATTERNS = [
  /\bvou pagar\b/,
  /\bja vou pagar\b/,
  /\bpago hoje\b/,
  /\bpago agora\b/,
];

const DISPUTA_PATTERNS = [
  /\bpor que\s+(voces\s+)?me pausaram\b/,
  /\bisso e um absurdo\b/,
  /\bnao concordo\b/,
  /\bcobranca indevida\b/,
  /\bvou cancelar\b/,
];

const QUER_VOLTAR_PATTERNS = [
  /\bquero voltar\b/,
  /\bquero retomar\b/,
  /\bquero reativar\b/,
  /\bvoltar a usar\b/,
];

const NAO_QUER_VOLTAR_PATTERNS = [
  /\bnao quero voltar\b/,
  /\bnao tenho interesse\b/,
  /\bdesisti\b/,
  /\bnao quero mais\b/,
];

export function classifyCobrancaMessage(
  message: string,
  submode: CobrancaSubmode,
): CobrancaClassification {
  const normalized = normalizeText(message);

  if (DISPUTA_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "disputa", confidence: 0.9 };
  }

  if (NEGOCIA_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "negocia_prazo", confidence: 0.92 };
  }

  if (JA_PAGUEI_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "ja_paguei", confidence: 0.92 };
  }

  if (submode === "cobranca_inadimplente") {
    if (PEDIU_LINK_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { intent: "pediu_link", confidence: 1.0 };
    }
    if (VAI_PAGAR_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { intent: "vai_pagar", confidence: 0.9 };
    }
  } else {
    if (QUER_VOLTAR_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { intent: "quer_voltar", confidence: 0.92 };
    }
    if (NAO_QUER_VOLTAR_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return { intent: "nao_quer_voltar", confidence: 0.92 };
    }
  }

  return { intent: "outro", confidence: 0.4 };
}

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatVencimento(vencimento: string | null): string {
  if (!vencimento) return "sem data definida";
  const [year, month, day] = vencimento.split("-");
  if (!year || !month || !day) return vencimento;
  return `${day}/${month}/${year}`;
}

function buildMpLink(mpPreferenceId: string): string {
  return `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${mpPreferenceId}`;
}

function replyInadimplente(
  intent: CobrancaIntent,
  pendingPayment: CobrancaPendingPayment | null,
): Pick<CobrancaAgentReply, "replyBody" | "handoffRequired" | "handoffReason"> {
  if (intent === "negocia_prazo") {
    return {
      replyBody:
        "Vou pedir para a equipe avaliar com voce. Te respondem por aqui.",
      handoffRequired: true,
      handoffReason: "negocia_prazo",
    };
  }

  if (intent === "ja_paguei") {
    return {
      replyBody:
        "Vou conferir com a equipe e te aviso. Se confirmar, reativo seu acesso.",
      handoffRequired: true,
      handoffReason: "verificar_pagamento",
    };
  }

  if (intent === "disputa") {
    return {
      replyBody:
        "Entendi. Vou pedir para a equipe te chamar para conversar sobre isso.",
      handoffRequired: true,
      handoffReason: "disputa_cobranca",
    };
  }

  if (intent === "pediu_link" || intent === "vai_pagar") {
    if (!pendingPayment || !pendingPayment.mpPreferenceId) {
      return {
        replyBody:
          "Vou pedir para a equipe gerar um link novo para voce. Te respondem por aqui.",
        handoffRequired: true,
        handoffReason: "link_indisponivel",
      };
    }
    return {
      replyBody:
        `Voce tem ${formatBRL(pendingPayment.valor)} em aberto, ` +
        `com vencimento em ${formatVencimento(pendingPayment.vencimento)}.\n` +
        `Link: ${buildMpLink(pendingPayment.mpPreferenceId)}`,
      handoffRequired: false,
      handoffReason: null,
    };
  }

  // intent === 'outro' (mensagem ambigua de oficina inadimplente)
  if (pendingPayment && pendingPayment.mpPreferenceId) {
    return {
      replyBody:
        `Seu acesso esta pausado por falta de pagamento. ` +
        `Em aberto: ${formatBRL(pendingPayment.valor)} (vencimento ${formatVencimento(pendingPayment.vencimento)}).\n` +
        `Link: ${buildMpLink(pendingPayment.mpPreferenceId)}\n` +
        `Se ja pagou ou precisa falar com a equipe, me avise.`,
      handoffRequired: false,
      handoffReason: null,
    };
  }
  return {
    replyBody:
      "Seu acesso esta pausado. Vou pedir para a equipe te chamar para regularizar.",
    handoffRequired: true,
    handoffReason: "link_indisponivel",
  };
}

function replyWinback(
  intent: CobrancaIntent,
  oficinaNome: string | null,
): Pick<CobrancaAgentReply, "replyBody" | "handoffRequired" | "handoffReason"> {
  const saudacao = oficinaNome ? `Oi, ${oficinaNome}! ` : "Oi! ";

  if (intent === "quer_voltar") {
    return {
      replyBody:
        "Que bom! Vou pedir para a equipe te chamar para reativar seu acesso.",
      handoffRequired: true,
      handoffReason: "reativacao_voluntaria",
    };
  }

  if (intent === "nao_quer_voltar") {
    return {
      replyBody:
        "Tudo bem. Se precisar de algo, e so chamar por aqui. Obrigado!",
      handoffRequired: false,
      handoffReason: null,
    };
  }

  if (intent === "disputa") {
    return {
      replyBody:
        "Entendi. Vou pedir para a equipe te chamar para conversar.",
      handoffRequired: true,
      handoffReason: "disputa_winback",
    };
  }

  if (intent === "negocia_prazo") {
    return {
      replyBody:
        "Vou pedir para a equipe avaliar opcoes com voce. Te respondem por aqui.",
      handoffRequired: true,
      handoffReason: "negocia_winback",
    };
  }

  return {
    replyBody:
      `${saudacao}Vi que voce pausou o uso do Quando Trocar. ` +
      `O que faltou para a gente? Posso pedir para a equipe te chamar para conversar.`,
    handoffRequired: false,
    handoffReason: null,
  };
}

function parseOpenAIClassification(
  text: string,
): CobrancaClassification | null {
  try {
    const parsed = JSON.parse(text) as Partial<CobrancaClassification>;
    const validIntents: CobrancaIntent[] = [
      "pediu_link",
      "vai_pagar",
      "ja_paguei",
      "negocia_prazo",
      "quer_voltar",
      "nao_quer_voltar",
      "disputa",
      "outro",
    ];
    if (parsed.intent && validIntents.includes(parsed.intent)) {
      return {
        intent: parsed.intent,
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export class WhatsappCobrancaAgent implements CobrancaAgent {
  private readonly openai: OpenAI | null;
  private readonly classifierModel: string;

  constructor(input?: { openai?: OpenAI | null; classifierModel?: string }) {
    this.openai =
      input?.openai ??
      (process.env.OPENAI_API_KEY
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null);
    this.classifierModel =
      input?.classifierModel ??
      process.env.OPENAI_MODEL_CLASSIFIER ??
      "gpt-4o-mini";
  }

  async generateReply(input: {
    message: string;
    submode: CobrancaSubmode;
    oficinaNome: string | null;
    proximoVencimento: string | null;
    pendingPayment: CobrancaPendingPayment | null;
    context: ConversationContext;
  }): Promise<CobrancaAgentReply> {
    const deterministic = classifyCobrancaMessage(input.message, input.submode);
    const classification =
      deterministic.confidence >= 0.85
        ? deterministic
        : (await this.classifyWithOpenAI(input.message)) ?? deterministic;

    const reply =
      input.submode === "cobranca_inadimplente"
        ? replyInadimplente(classification.intent, input.pendingPayment)
        : replyWinback(classification.intent, input.oficinaNome);

    return {
      intent: classification.intent,
      confidence: classification.confidence,
      submode: input.submode,
      replyBody: reply.replyBody,
      handoffRequired: reply.handoffRequired,
      handoffReason: reply.handoffReason,
      toolCalls: [],
    };
  }

  private async classifyWithOpenAI(
    message: string,
  ): Promise<CobrancaClassification | null> {
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
              "Classifique mensagens de oficinas em cobranca ou winback. " +
              "Intents: pediu_link, vai_pagar, ja_paguei, negocia_prazo, " +
              "quer_voltar, nao_quer_voltar, disputa, outro. " +
              "Responda apenas JSON compacto com intent e confidence.",
          },
          { role: "user", content: message },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "cobranca_classification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "pediu_link",
                    "vai_pagar",
                    "ja_paguei",
                    "negocia_prazo",
                    "quer_voltar",
                    "nao_quer_voltar",
                    "disputa",
                    "outro",
                  ],
                },
                confidence: { type: "number" },
              },
              required: ["intent", "confidence"],
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
