// Concierge do cliente final ANTES de existir qualquer lembrete (ADR-0018).
//
// Quando a oficina registra um serviço, o cliente final recebe a confirmação
// (template `confirmacao_servico`). Se ele responder nessa janela — antes de o
// primeiro lembrete existir — ele NÃO é um lead de vendas. Este agente dá uma
// resposta curta e on-brand, e encaminha pra oficina (wa.me) tudo que é
// acionável. Determinístico (sem LLM): mensagens ambíguas caem em handoff, que
// é o destino seguro. O botão "Chamar no WhatsApp" é quick-reply do template,
// então o toque chega aqui como uma intent dedicada.

import { normalizeText } from "./sales-agent";
import type {
  ClienteFinalConciergeAgent,
  ClienteFinalConciergeIntent,
  ClienteFinalConciergeReply,
} from "./types";

const OPT_OUT_PATTERNS = [
  /\bparar\b/,
  /\bcancelar\b/,
  /\bremover\b/,
  /\bnao quero receber\b/,
  /\bnao me mande\b/,
  /\bnao me mandem\b/,
  /\bpare\b/,
  /\bsair\b/,
  /\bdescadastrar\b/,
];

const NUMERO_ERRADO_PATTERNS = [
  /\bnumero errado\b/,
  /\btelefone errado\b/,
  /\bnao sou eu\b/,
  /\bpessoa errada\b/,
  /\bnao e meu numero\b/,
  /\bnao e o meu numero\b/,
];

const NAO_RECONHECE_PATTERNS = [
  /\bnao reconheco\b/,
  /\bnao fui eu\b/,
  /\bnao fiz\b/,
  /\bnao tenho esse carro\b/,
  /\bnao e meu carro\b/,
  /\bnao conheco esse servico\b/,
];

const QUEM_E_PATTERNS = [
  /\bquem e\b/,
  /\bquem sao\b/,
  /\bquem fala\b/,
  /\bque empresa\b/,
  /\bo que e isso\b/,
  /\bnao conheco voces\b/,
  /\bque numero e esse\b/,
  /\bde onde\b/,
];

const AGRADECIMENTO_PATTERNS = [
  /\bobrigad[oa]\b/,
  /\bvaleu\b/,
  /\bshow\b/,
  /\bperfeito\b/,
  /\blegal\b/,
  /\botimo\b/,
  /\bbeleza\b/,
  /\bjoia\b/,
  /\bde boa\b/,
  /\bblz\b/,
  /^ok$/,
  /^okay$/,
];

const CHAMAR_OFICINA_PATTERNS = [
  /\bchamar\s+no\s+whatsapp\b/,
  /\bchamar\s+no\s+whats\b/,
  /\bfalar\s+com\s+a\s+oficina\b/,
];

// Pedidos que só a oficina resolve → handoff wa.me (ADR-0009/0012: bot não
// agenda nem cota preço).
const PEDIDO_OFICINA_PATTERNS = [
  /\bpreco\b/,
  /\bvalor\b/,
  /\bquanto\b/,
  /\bagendar\b/,
  /\bmarcar\b/,
  /\bremarcar\b/,
  /\breagendar\b/,
  /\bhorario\b/,
  /\borcamento\b/,
  /\breclama\w*\b/,
  /\bproblema\b/,
  /\bgarantia\b/,
  /\bnota fiscal\b/,
];

export function classifyConciergeMessage(message: string): ClienteFinalConciergeIntent {
  const normalized = normalizeText(message);

  if (OPT_OUT_PATTERNS.some((p) => p.test(normalized))) return "opt_out";
  if (NUMERO_ERRADO_PATTERNS.some((p) => p.test(normalized))) return "numero_errado";
  if (NAO_RECONHECE_PATTERNS.some((p) => p.test(normalized))) return "nao_reconhece";
  if (CHAMAR_OFICINA_PATTERNS.some((p) => p.test(normalized))) return "chamar_oficina";
  if (PEDIDO_OFICINA_PATTERNS.some((p) => p.test(normalized))) return "pedido_oficina";
  if (QUEM_E_PATTERNS.some((p) => p.test(normalized))) return "quem_e";
  if (AGRADECIMENTO_PATTERNS.some((p) => p.test(normalized))) return "agradecimento";

  return "mensagem_indefinida";
}

// wa.me a partir do telefone E.164 da oficina (só dígitos). Sem telefone, não há
// link e a copy cai pra "fale com a {oficina}".
export function buildWorkshopWaLink(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

function handoffSuffix(workshopName: string, waLink: string | null): string {
  return waLink
    ? `fala direto com a ${workshopName} 👉 ${waLink}`
    : `fala direto com a ${workshopName}`;
}

export class WhatsappClienteFinalConciergeAgent implements ClienteFinalConciergeAgent {
  generateReply(input: {
    message: string;
    workshopName: string;
    workshopWhatsapp: string | null;
  }): ClienteFinalConciergeReply {
    const intent = classifyConciergeMessage(input.message);
    const workshopName = input.workshopName;
    const waLink = buildWorkshopWaLink(input.workshopWhatsapp);

    const base = {
      intent,
      toolCalls: [
        {
          toolName: "cliente_final_concierge",
          input: { message: input.message },
          output: { intent },
        },
      ],
    } satisfies Pick<ClienteFinalConciergeReply, "intent" | "toolCalls">;

    if (intent === "opt_out") {
      return {
        ...base,
        replyBody: "Tudo certo, não envio mais mensagens por aqui. 🙏",
        handoffRequired: false,
        handoffReason: null,
        clienteStatus: "opt_out",
        shouldCancelFutureReminders: true,
      };
    }

    if (intent === "numero_errado") {
      return {
        ...base,
        replyBody: "Desculpe o engano! Não envio mais mensagens para este número.",
        handoffRequired: false,
        handoffReason: null,
        clienteStatus: "numero_errado",
        shouldCancelFutureReminders: true,
      };
    }

    if (intent === "nao_reconhece") {
      return {
        ...base,
        replyBody: `Pode deixar que vou avisar a ${workshopName} pra verificar isso com você. Se preferir, ${handoffSuffix(workshopName, waLink)}.`,
        handoffRequired: true,
        handoffReason: "cliente_nao_reconhece",
        clienteStatus: null,
        shouldCancelFutureReminders: false,
      };
    }

    if (intent === "pedido_oficina") {
      return {
        ...base,
        replyBody: `Pra isso o ideal é ${handoffSuffix(workshopName, waLink)}.`,
        handoffRequired: true,
        handoffReason: "pedido_cliente_final",
        clienteStatus: null,
        shouldCancelFutureReminders: false,
      };
    }

    if (intent === "chamar_oficina") {
      return {
        ...base,
        replyBody: waLink
          ? `Pode falar direto com a ${workshopName}: ${waLink}`
          : `Pode falar direto com a ${workshopName}.`,
        handoffRequired: true,
        handoffReason: "cta_confirmacao",
        clienteStatus: null,
        shouldCancelFutureReminders: false,
      };
    }

    if (intent === "quem_e") {
      return {
        ...base,
        replyBody: `Aqui é o assistente da ${workshopName} 🙂 Eles registraram seu serviço no Quando Trocar e a gente te avisa quando chegar perto da próxima troca. Qualquer dúvida, ${handoffSuffix(workshopName, waLink)}.`,
        handoffRequired: false,
        handoffReason: null,
        clienteStatus: null,
        shouldCancelFutureReminders: false,
      };
    }

    if (intent === "agradecimento") {
      return {
        ...base,
        replyBody: `Por nada! 🚗 Quando seu carro estiver perto da próxima troca, a gente te avisa por aqui. Precisando de algo agora, ${handoffSuffix(workshopName, waLink)}.`,
        handoffRequired: false,
        handoffReason: null,
        clienteStatus: null,
        shouldCancelFutureReminders: false,
      };
    }

    // mensagem_indefinida → destino seguro é a oficina.
    return {
      ...base,
      replyBody: `Recebi sua mensagem! Pra te ajudar melhor, ${handoffSuffix(workshopName, waLink)}.`,
      handoffRequired: true,
      handoffReason: "mensagem_ambigua",
      clienteStatus: null,
      shouldCancelFutureReminders: false,
    };
  }
}
