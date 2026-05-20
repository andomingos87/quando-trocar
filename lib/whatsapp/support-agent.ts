import OpenAI from "openai";

import { normalizeText } from "./sales-agent";
import type {
  ConversationContext,
  SupportAgent,
  SupportAgentReply,
  SupportIntent,
} from "./types";

type SupportClassification = {
  intent: SupportIntent;
  confidence: number;
};

const BUG_PATTERNS = [
  /\btrav(a|ou|ando)\b/,
  /\bbug\b/,
  /\bnao (funciona|abre|carrega|envia|salva)\b/,
  /\berro\b/,
  /\bquebr(ou|ado)\b/,
  /\bcaiu\b/,
  /\bfora do ar\b/,
];

const BILLING_PATTERNS = [
  /\bcobranca\b/,
  /\bcobranc(a|as)\b/,
  /\bpagamento\b/,
  /\bfatura\b/,
  /\bboleto\b/,
  /\bvencimento\b/,
  /\bplano\b/,
  /\bvalor (do plano|da mensalidade)\b/,
];

const DUVIDA_PATTERNS = [
  /\bcomo\s+(faco|fazer|funciona|cadastro|registro|adiciono|crio|envio|edito|removo|excluo|cancelo|verifico|consulto)\b/,
  /\bonde\s+(fica|encontro|vejo|acho)\b/,
  /\bo que\s+(e|significa)\b/,
  /\bpara que serve\b/,
];

export function classifySupportMessage(message: string): SupportClassification {
  const normalized = normalizeText(message);

  if (BUG_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "bug_ou_travamento", confidence: 0.92 };
  }

  if (BILLING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "cobranca", confidence: 0.9 };
  }

  if (DUVIDA_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { intent: "duvida_uso", confidence: 0.88 };
  }

  return { intent: "outro", confidence: 0.4 };
}

function replyForIntent(
  intent: SupportIntent,
  oficinaNome: string | null,
): Pick<SupportAgentReply, "replyBody" | "handoffRequired" | "handoffReason"> {
  const saudacao = oficinaNome ? `Oi! ` : "";

  if (intent === "duvida_uso") {
    return {
      replyBody:
        `${saudacao}Pode me contar o que voce esta tentando fazer? ` +
        "Te explico o passo a passo. Se eu nao souber, chamo a equipe.",
      handoffRequired: false,
      handoffReason: null,
    };
  }

  if (intent === "bug_ou_travamento") {
    return {
      replyBody:
        "Entendi, parece travamento. Ja vou avisar a equipe tecnica e " +
        "alguem te chama por aqui para resolver.",
      handoffRequired: true,
      handoffReason: "bug_ou_travamento",
    };
  }

  if (intent === "cobranca") {
    return {
      replyBody:
        "Sobre cobranca, vou pedir para a equipe responder por aqui com o detalhe certo.",
      handoffRequired: true,
      handoffReason: "duvida_cobranca",
    };
  }

  return {
    replyBody:
      "Recebi sua mensagem. Vou pedir para a equipe seguir com voce por aqui.",
    handoffRequired: true,
    handoffReason: "mensagem_ambigua",
  };
}

function parseOpenAIClassification(text: string): SupportClassification | null {
  try {
    const parsed = JSON.parse(text) as Partial<SupportClassification>;
    if (
      parsed.intent === "duvida_uso" ||
      parsed.intent === "bug_ou_travamento" ||
      parsed.intent === "cobranca" ||
      parsed.intent === "outro"
    ) {
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

export class WhatsappSupportAgent implements SupportAgent {
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
    context: ConversationContext;
    oficinaNome: string | null;
  }): Promise<SupportAgentReply> {
    const deterministic = classifySupportMessage(input.message);
    const classification =
      deterministic.confidence >= 0.85
        ? deterministic
        : (await this.classifyWithOpenAI(input.message)) ?? deterministic;

    const finalClassification: SupportClassification =
      classification.confidence < 0.6
        ? { intent: "outro", confidence: classification.confidence }
        : classification;

    const reply = replyForIntent(finalClassification.intent, input.oficinaNome);

    return {
      intent: finalClassification.intent,
      confidence: finalClassification.confidence,
      replyBody: reply.replyBody,
      handoffRequired: reply.handoffRequired,
      handoffReason: reply.handoffReason,
      toolCalls: [],
    };
  }

  private async classifyWithOpenAI(
    message: string,
  ): Promise<SupportClassification | null> {
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
              "Classifique mensagens de suporte enviadas por oficinas-clientes do Quando Trocar. " +
              "Categorias: duvida_uso (como usar o produto), bug_ou_travamento (algo nao funciona), " +
              "cobranca (pergunta sobre pagamento ou plano), outro (qualquer outra coisa). " +
              "Responda apenas JSON compacto com intent e confidence.",
          },
          { role: "user", content: message },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "support_classification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                intent: {
                  type: "string",
                  enum: ["duvida_uso", "bug_ou_travamento", "cobranca", "outro"],
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
