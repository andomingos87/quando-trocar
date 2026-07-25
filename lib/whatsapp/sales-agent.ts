import OpenAI from "openai";

import { whatsappLink } from "../config";
import {
  SALES_FALLBACK_BUTTONS,
  SALES_FALLBACK_BUTTONS_BODY,
  SALES_FALLBACK_BUTTONS_TEXT,
} from "./sales-buttons";
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

// ADR-0019: o link wa.me do representante embute "#REP-<codigo>" na primeira
// mensagem. Extracao deterministica (sem LLM). O token precisa sair da
// mensagem antes de detectLeadOrigin (match exato da frase-gatilho) e antes
// do agente processar o texto.
const REPRESENTANTE_CODIGO_REGEX = /#\s*REP-([A-Z0-9][A-Z0-9-]{0,29})/i;

export function extractRepresentanteCodigo(message: string): {
  codigo: string | null;
  cleaned: string;
} {
  const match = message.match(REPRESENTANTE_CODIGO_REGEX);
  if (!match) return { codigo: null, cleaned: message };

  const codigo = match[1].toUpperCase().replace(/-+$/, "");
  const cleaned = message.replace(REPRESENTANTE_CODIGO_REGEX, " ").replace(/\s+/g, " ").trim();
  return { codigo: codigo.length >= 2 ? codigo : null, cleaned };
}

export function isExplicitLossMessage(message: string) {
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

export function detectSmallTalk(message: string) {
  const normalized = normalizeText(message);
  // OBS: pergunta sobre o bot ("voce e robo", "qual seu nome") foi movida pra FAQ
  // ("Quem e voce?"). Aqui ficam apenas off-topics explicitos.
  return [
    /\b(que time|futebol|torce|jogo|copa|brasileirao|flamengo|corinthians|palmeiras|sao paulo|santos|gremio|internacional|atletico|cruzeiro|fluminense|botafogo|vasco)\b/,
    /\b(piada|brincadeira|tudo certo por ai|td certo)\b/,
  ].some((re) => re.test(normalized));
}

export function detectBasicGreeting(message: string) {
  const normalized = normalizeText(message);
  // Body vazio (sticker, emoji solto) tambem conta como greeting.
  if (normalized.length === 0) return true;
  return [
    /^(oi|oie|ola|ei|eai|e ai|opa|fala|fala ai|fala mano|fala chefe|alo|alou)$/,
    /^(bom dia|boa tarde|boa noite|bdia|btarde|bnoite)$/,
    /^(tudo bem|td bem|tudo certo|tudo joia|tudo tranquilo|de boa|como vai|como esta)\??$/,
    /^(ta ai|esta ai|alguem|alguem ai)\??$/,
  ].some((re) => re.test(normalized));
}

export function detectNeutralAck(message: string) {
  const normalized = normalizeText(message);
  return [
    /^(ok|okay|okk+|blz|beleza|show|top|legal|bacana|joia|massa)$/,
    /^(entendi|entendido|saquei|sacou|certo)$/,
    /^(ta|ta bom|ta certo|tah|tah bom)$/,
    /^(uhum|aham|ahum|hmm+|hum)$/,
    /^(obrigado|obrigada|valeu|vlw|obg|grato|brigado)$/,
  ].some((re) => re.test(normalized));
}

export function detectVaiPensar(message: string) {
  const normalized = normalizeText(message);
  return [
    /\bvou pensar\b/,
    /\bdeixa eu (pensar|ver|analisar)\b/,
    /\bvou (ver|analisar|olhar|conversar) (com|sobre|isso|melhor|depois|amanha|antes)\b/,
    /\bdepois (eu )?(te (falo|respondo|aviso)|vejo|olho|volto)\b/,
    /\bagora nao (da|posso|consigo)\b/,
    /\bmais (tarde|pra frente|adiante)\b/,
    /\btalvez (depois|mais tarde|mais pra frente|outra hora)\b/,
    /\bpreciso (ver|conversar|alinhar|pensar)\b/,
    /\bvou (conversar|alinhar) com (o |a |meu |minha )?(socio|socia|equipe|chefe|esposa|marido)\b/,
  ].some((re) => re.test(normalized));
}

export function detectSocialTest(message: string) {
  const normalized = normalizeText(message);
  if (normalized.length === 0) return false; // greeting trata isso
  // Mensagens muito curtas (ate 3 chars) que nao sao greeting nem ack
  if (normalized.length <= 3 && !/^(oi|ola|ei|eai|opa|ok|ta|tah)$/.test(normalized)) {
    return true;
  }
  return [
    /^(kkk+|kekek+|hahaha+|rsrs+|huehue+|hueheue+|kkkkk+)$/,
    /^(testando|to testando|tava testando|so testando|teste pra ver)$/,
    /^(opa kk|opa rs|kk testando|rs testando)$/,
  ].some((re) => re.test(normalized));
}

export function detectQuerHumano(message: string) {
  const normalized = normalizeText(message);
  return [
    /\b(quero|posso|gostaria|preciso) falar com (humano|pessoa|atendente|vendedor|responsavel|gerente|alguem)\b/,
    /\bpassa pro?( |s )?(anderson|vendedor|responsavel|humano|chefe|gerente)\b/,
    /\b(tem|tinha) (alguem|atendente|pessoa) (de verdade|real|humano)\b/,
    /\b(quero|prefiro) (atendente|humano|pessoa) (real|de verdade)\b/,
    /\bfala com o anderson\b/,
    /\bchama o anderson\b/,
    /\bme chama (no |numa )?(reuniao|call|ligacao)\b/,
  ].some((re) => re.test(normalized));
}

// Frases que a oficina costuma embrulhar antes do nome ("minha oficina se
// chama X", "é a X", "o nome é X"). Removemos pra guardar só o nome.
const WORKSHOP_NAME_STRIP_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:oficina|auto\s*center|garagem|funilaria|mec[aâ]nica)\s+(?:se\s+chama|chama(?:-se)?|e|eh|seria)\s+/i,
  /^(?:o\s+)?nome\s+(?:da\s+oficina\s+)?(?:e|eh|seria|:)\s*/i,
  /^(?:se\s+)?chama(?:-se)?\s+/i,
  /^(?:e|eh|seria)\s+/i,
  /^(?:a|o|minha|meu)\s+/i,
  /^[\s:,.\-]+/,
];

// Valida se a mensagem pode ser uma resposta de nome de oficina (não é
// saudação, ack, pergunta nem só dígitos) e devolve o nome limpo, ou null.
export function extractWorkshopName(message: string): string | null {
  const raw = message.replace(/\s+/g, " ").trim();
  if (!raw) return null;

  if (
    detectBasicGreeting(message) ||
    detectNeutralAck(message) ||
    detectPriceQuestion(message) ||
    detectQuerHumano(message)
  ) {
    return null;
  }

  const normalized = normalizeText(message);
  if (message.includes("?") || /^(qual|como|porque|por que|quando|onde|quem|o que)\b/.test(normalized)) {
    return null;
  }

  let value = raw;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of WORKSHOP_NAME_STRIP_PATTERNS) {
      const next = value.replace(pattern, "");
      if (next !== value) {
        value = next.trim();
        changed = true;
      }
    }
  }

  value = value.replace(/[\s:,.\-]+$/g, "").trim();
  if (value.length < 2 || /^\d+$/.test(value.replace(/\s/g, ""))) return null;

  return value;
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
  // Match semântico da FAQ resolvido fora do agente (CV5). Usado só como
  // fallback quando o match por keyword falha — a keyword é curada pelo admin e
  // tem prioridade. Ausente (sem embedder) → comportamento antigo, só keyword.
  preMatchedFaqId?: string | null,
): SalesClassification {
  // 1. Recusa explicita -> sem_interesse (vence tudo, ate dor)
  if (isExplicitLossMessage(message)) {
    return { intent: "sem_interesse", confidence: 0.9 };
  }

  // 2. Dor expressa -> pergunta_funcionamento (override forte; ciclo 2)
  if (detectPain(message)) {
    return {
      intent: "pergunta_funcionamento",
      confidence: 0.9,
      painDetected: true,
    };
  }

  // 3. Pedido de humano -> quer_humano (ciclo 3)
  if (detectQuerHumano(message)) {
    return { intent: "quer_humano", confidence: 0.92 };
  }

  // 4. Hesitacao ("vou pensar") -> vai_pensar (ciclo 3, antes de pricing)
  if (detectVaiPensar(message)) {
    return { intent: "vai_pensar", confidence: 0.9 };
  }

  // 5. Saudacao basica -> fora_escopo com confidence ALTA (ciclo 3)
  //    Confidence >= 0.85 evita ir pro OpenAI fallback (que pode escolher small_talk).
  //    O branch fora_escopo no buildReply diferencia 1a saudacao vs subsequente via memory.
  if (detectBasicGreeting(message)) {
    return { intent: "fora_escopo", confidence: 0.9 };
  }

  // 5.3. Confirmacao curta ("ok", "blz", "entendi") — vem antes do social_test
  // pra "blz" (3 chars) nao ser classificado como social.
  if (detectNeutralAck(message)) {
    return { intent: "confirmacao_neutra", confidence: 0.9 };
  }

  // 5.5. Mensagem social/teste curta ("kk", "rs", "testando", ".") -> social_test
  if (detectSocialTest(message)) {
    return { intent: "social_test", confidence: 0.88 };
  }

  // 6. Pergunta de preco
  if (detectPriceQuestion(message)) {
    return { intent: "pergunta_preco", confidence: 0.92 };
  }

  // 7. Volume/ticket
  const numbers = extractVolumeOrTicket(message);
  if (numbers.monthlyChanges !== undefined || numbers.averageTicket !== undefined) {
    return {
      intent: "informa_volume_ticket",
      confidence: 0.86,
      ...numbers,
    };
  }

  const normalized = normalizeText(message);

  // 8. "como funciona?"
  if (/\b(como funciona|funciona|explica|explique|o que e|o que faz)\b/.test(normalized)) {
    return { intent: "pergunta_funcionamento", confidence: 0.86 };
  }

  // 9. Aceite — QTR-35 P1-4a: cobre as variações reais de aceite ("quero
  //    fazer", "pode ativar", "fechou") que antes caíam no classificador LLM.
  if (
    /\b(quero testar|quero fazer|quero sim|quero ativar|pode ativar|teste|proximo passo|vamos|tenho interesse|bora|topo|topa|fechado|fechou|manda|to dentro|vou querer)\b/.test(
      normalized,
    )
  ) {
    return { intent: "quer_testar", confidence: 0.86 };
  }

  // 10. Small talk (off-topic explicito: futebol, piada)
  if (detectSmallTalk(message)) {
    return { intent: "small_talk", confidence: 0.88 };
  }

  // 12. FAQ por palavra-chave (curada pelo admin — precisa e prioritária).
  const faqMatch = matchFaq(message, faqs);
  if (faqMatch) {
    return { intent: "pergunta_faq", confidence: 0.85, faqId: faqMatch.id };
  }

  // 12b. FAQ por similaridade semântica (CV5): pega paráfrase que a keyword
  // não cobre ("quanto sai por mês?" ~ FAQ de preço com keyword "custa"). Só
  // vale se o id resolver numa FAQ ativa conhecida.
  if (preMatchedFaqId) {
    const semantic = faqs.find((faq) => faq.id === preMatchedFaqId);
    if (semantic) {
      return { intent: "pergunta_faq", confidence: 0.8, faqId: semantic.id };
    }
  }

  // 13. Default
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

const GREETING_PREFIX =
  "Fala chefe! Aqui e do Quando Trocar — a gente faz seu cliente voltar pra proxima troca de qualquer peca ou servico automotivo: oleo, amortecedor, filtro, revisao, alinhamento, freio...";

// Saudacao subsequente (greeted=true): 5 variacoes pra alternar
const GREETING_AFTER_GREETED = [
  "Td certo chefe! Posso te ajudar com algo do produto, ou ja quer ver quanto vale pra sua oficina?",
  "Bom, td bem chefe! Tava te falando aqui — bora ver como funciona pro seu caso?",
  "Fala chefe! Se quiser eu te explico de novo, te mostro o numero, ou ja ativo o teste de 14 dias.",
  "Td bom chefe :) Se for so um oi tranquilo, mas se quiser saber mais do produto e so chamar.",
  "Tamo aqui chefe! Me diz no que posso ajudar: como funciona, preco, ou ja partir pro teste?",
];

// Índice da variação "menu" dentro de FALLBACK_VARIATIONS. No nível 2 do
// fallback (CV3) o webhook envia botões interativos em vez deste texto; o texto
// segue como degradação quando o transporte não suporta botões.
const MENU_VARIATION_INDEX = 1;

// fora_escopo: 5 variacoes (rotaciona conforme consecutive_fallback)
const FALLBACK_VARIATIONS = [
  // [0] explainer curto (1a aparicao apos ja ter explicado uma vez)
  "Nao entendi muito bem chefe. Se quiser ver como funciona ou ja topa testar 14 dias gratis, me fala.",
  // [1] menu de opcoes — CV3: substituido por botoes interativos em runtime
  //     (SALES_FALLBACK_BUTTONS); este texto e a degradacao sem botoes.
  "Pra eu te ajudar melhor chefe, escolhe uma:\n- Como funciona\n- Quanto custa\n- Ja quero testar\n- Falar com o Anderson",
  // [2] simples + gancho
  "Pode reformular chefe? Ou se preferir, eu te explico de novo o produto, te passo o preco, ou ja ativo o teste.",
  // [3] mais social
  "Hmm, me ajuda chefe :) Me diz se voce quer ver como funciona, saber o preco, ou ja topa um teste.",
  // [4] empurra pro humano sem fechar a porta
  "Chefe, se preferir, posso te conectar direto com o Anderson. Senao, me diz o que precisa saber do produto.",
];

// social_test: 5 variacoes
const SOCIAL_TEST_VARIATIONS = [
  "Hahaha to por aqui chefe :) Qualquer coisa do produto e so chamar.",
  "Td bem chefe :) Quer ver como funciona ou ja partir pro teste de 14 dias?",
  "Chefe, se for so testando me avisa kkk. Senao, e so dizer o que precisa.",
  "Beleza chefe :) Quando quiser saber do Quando Trocar, me fala.",
  "Hahaha td bom chefe. Tamo aqui pra ajudar quando voce decidir o que quer saber.",
];

function pickVariation<T>(pool: ReadonlyArray<T>, index: number): T {
  return pool[index % pool.length];
}

// QTR-35 P1-6: a apresentação sai de um ÚNICO ponto — qualquer primeira
// resposta da conversa (FAQ, preço, small talk, handoff...) carrega o prefixo,
// e os branches individuais não precisam lembrar de saudar. Aplica também ao
// corpo dos botões interativos (bodyText), que espelha o corpo enviado.
function ensureGreeting(alreadyGreeted: boolean, reply: AgentReply): AgentReply {
  if (alreadyGreeted) return reply;
  const sales: SalesConversationMemory = {
    ...(reply.updatedContext?.sales ?? {}),
    greeted: true,
  };
  const prefix = (text: string) =>
    text.startsWith(GREETING_PREFIX) ? text : `${GREETING_PREFIX}\n\n${text}`;
  return {
    ...reply,
    body: prefix(reply.body),
    ...(reply.interactiveButtons
      ? {
          interactiveButtons: {
            ...reply.interactiveButtons,
            bodyText: prefix(reply.interactiveButtons.bodyText),
          },
        }
      : {}),
    updatedContext: { ...(reply.updatedContext ?? {}), sales },
  };
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

  // Contador de fallback consecutivo (Fix 2). Por padrao, todo branch
  // que NAO seja fora_escopo final ou social_test reseta. Salvo o
  // valor de entrada pra usar nos branches de loop.
  const incomingFallbackCount = memory.consecutive_fallback ?? 0;
  memory.consecutive_fallback = 0;

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

  // Small talk — resposta gentil, sem mudar status nem repetir pitch
  // (counter ja resetado no topo)
  if (classification.intent === "small_talk") {
    return {
      status: context.leadStatus,
      body:
        "Hahaha nao to aqui pra isso chefe :) Mas se quiser ver como funciona ou ja topa testar 14 dias gratis, e so me chamar.",
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Social/teste ("kk", "rs", "testando", "?") — resposta paciente, varia entre 5.
  // Conta como fallback consecutive porque indica que o lead nao engajou.
  if (classification.intent === "social_test") {
    memory.consecutive_fallback = incomingFallbackCount + 1;
    return {
      status: context.leadStatus,
      body: pickVariation(SOCIAL_TEST_VARIATIONS, incomingFallbackCount),
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Pedido explicito de humano — handoff direto, status mantem
  if (classification.intent === "quer_humano") {
    return {
      status: context.leadStatus,
      body: `Beleza chefe! Vou pedir pro Anderson te chamar direto agora: ${whatsappLink({ phone: context.salesConfig.whatsappHandoffComercial })}`,
      toolCalls: [],
      handoffRequired: true,
      handoffReason: "pedido_humano",
      updatedContext: { sales: memory },
    };
  }

  // Hesitacao ("vou pensar") — copy de respeito ao tempo do lead, sem handoff
  if (classification.intent === "vai_pensar") {
    return {
      status: context.leadStatus,
      body:
        "Tranquilo chefe, sem pressa. Deixo aqui sem compromisso. Se quiser, te chamo daqui uns dias pra saber como ta pensando — ou e so me chamar quando der.",
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Confirmacao neutra ("ok", "blz") — curta se ja explicou; senao cai pro fluxo padrao
  if (classification.intent === "confirmacao_neutra") {
    if (memory.funcionamento_explained) {
      return {
        status: context.leadStatus,
        body:
          "Beleza chefe, to por aqui. Se quiser saber mais ou ja topar testar 14 dias gratis, e so me chamar.",
        toolCalls: [],
        updatedContext: { sales: memory },
      };
    }
    // Ainda nao explicou — cai pro fluxo de fora_escopo (saudacao + explicador)
    classification = { intent: "fora_escopo", confidence: 0.6 };
  }

  // Pergunta de preco — soft redirect na 1a, handoff na 2a
  if (classification.intent === "pergunta_preco") {
    const previous = memory.price_mentions ?? 0;
    const nextCount = previous + 1;
    memory.price_mentions = nextCount;

    if (nextCount === 1) {
      const partida = formatBrl(context.salesConfig.precoPartida);

      // Fix #3: se ja temos volume + ticket no contexto, conecta o custo com a recuperacao
      let bodyText: string;
      if (memory.volume_known !== undefined && memory.ticket_known !== undefined) {
        const roi = calculateRoi({
          monthlyChanges: memory.volume_known,
          averageTicket: memory.ticket_known,
          recoveryRate: context.salesConfig.taxaRecuperacaoRoi,
        });
        const recoveredFmt = formatBrl(roi.recoveredRevenue);
        bodyText = `${partida}/mes chefe, parte dai. Pra voce que ta recuperando uns ${recoveredFmt}/mes, sai praticamente de graca. Bora ativar 14 dias gratis pra testar?`;
      } else {
        bodyText = `Olha chefe, parte de ${partida}/mes. O valor final a gente fecha olhando o tamanho da sua oficina, mas antes de combinar preco, bora ativar 14 dias gratis pra voce ver rodando?`;
      }

      const reply = withPain(memory, context.message, bodyText);
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
      const ask = volume === undefined ? "quantos servicos voce faz por mes?" : "qual o ticket medio?";
      const reply = withPain(
        memory,
        context.message,
        `Show chefe, sabe me dizer ${ask} Se nao tiver de cabeca, sem stress — bora pro teste de 14 dias gratis.`,
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

    const body = `Olha chefe, oficinas do seu tamanho costumam trazer de volta uns ${pct}% dos clientes que somem. Com ${volume} servicos/mes e ticket de ${ticketFmt}, pra voce isso seria uns ${recoveredFmt}/mes caindo de novo na oficina. Bora ativar 14 dias gratis pra testar?`;
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

  // Quero testar — antes de converter, captura o nome da oficina.
  if (classification.intent === "quer_testar") {
    // Já temos o nome guardado (lead reiterou interesse) -> converte.
    if (memory.workshop_name) {
      return {
        status: "teste_aceito",
        body: `Show chefe! Vou cadastrar a ${memory.workshop_name} em teste por aqui mesmo.`,
        toolCalls: [],
        convertToOficina: true,
        nomeOficina: memory.workshop_name,
        updatedContext: { sales: memory },
      };
    }

    // Ainda não sabemos o nome -> pergunta e aguarda a resposta.
    memory.awaiting_workshop_name = true;
    return {
      status: "teste_aceito",
      body: "Boa chefe! Antes de ativar seu teste, como chama a sua oficina?",
      toolCalls: [],
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

  // Pergunta funcionamento — copy longa na 1a, curta nas seguintes; saudacao se for 1o turno
  if (classification.intent === "pergunta_funcionamento") {
    const baseBody = memory.funcionamento_explained
      ? "Lembra chefe: voce cadastra o servico aqui, o sistema chama o cliente no dia certo da proxima e te avisa quem voltou. Bora ativar 14 dias gratis pra testar?"
      : "Funciona assim chefe: voce cadastra o servico aqui (oleo, amortecedor, qualquer peca com retorno previsivel), o sistema chama o cliente no dia certo da proxima e te avisa quem voltou. Bora ativar 14 dias gratis pra voce ver rodando na sua oficina?";

    const painWrapped = withPain(memory, context.message, baseBody);

    memory.pain_detected = painWrapped.painDetected;
    memory.funcionamento_explained = true;

    return {
      status: statusForIntent(classification.intent),
      body: painWrapped.body,
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

  // Fix 1: saudacao SUBSEQUENTE ("bom dia" depois de ja ter saudado)
  // -> resposta social dedicada com 5 variacoes. NAO conta como fallback (reseta).
  if (memory.greeted && detectBasicGreeting(context.message)) {
    return {
      status: statusForIntent(classification.intent),
      body: pickVariation(GREETING_AFTER_GREETED, incomingFallbackCount),
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Primeira aparicao (greeted=false): explainer. Marca como fallback #1.
  // A saudacao em si vem do ensureGreeting no fim do generateReply (P1-6).
  if (!memory.greeted) {
    const baseBody =
      "Funciona assim chefe: voce cadastra o servico aqui (oleo, amortecedor, qualquer peca com retorno previsivel), o sistema chama o cliente no dia certo da proxima e te avisa quem voltou. Bora ativar 14 dias gratis pra ver rodando na sua oficina?";
    const fallbackPain = withPain(memory, context.message, baseBody);

    memory.pain_detected = fallbackPain.painDetected;
    memory.funcionamento_explained = true;
    memory.consecutive_fallback = 1;

    return {
      status: statusForIntent(classification.intent),
      body: fallbackPain.body,
      toolCalls: [],
      updatedContext: { sales: memory },
    };
  }

  // Fix 2: contador de fallback consecutivo. Em >= 7, handoff automatico.
  const nextCount = incomingFallbackCount + 1;
  memory.consecutive_fallback = nextCount;

  if (nextCount >= 7) {
    return {
      status: context.leadStatus,
      body: `Chefe, vou te conectar direto com o Anderson — fica mais rapido a gente fechar isso por la: ${whatsappLink({ phone: context.salesConfig.whatsappHandoffComercial })}`,
      toolCalls: [],
      handoffRequired: true,
      handoffReason: "fallback_loop",
      updatedContext: { sales: memory },
    };
  }

  // CV3: no nivel 2 do fallback (indice do menu), troca o menu de texto por
  // botoes interativos deterministicos. O webhook envia os botoes quando o
  // transporte suporta; senao degrada para o texto do menu (`body`). E um
  // sub-caminho deterministico — NAO marca respond (o clique ja resolve o
  // intent, sem geracao). O estado (consecutive_fallback = nextCount, ja setado
  // acima) e identico ao caminho de texto, preservando a invariante da ADR-0024
  // (estado nunca reage a camada de geracao).
  if (incomingFallbackCount % FALLBACK_VARIATIONS.length === MENU_VARIATION_INDEX) {
    if (!memory.funcionamento_explained) {
      memory.funcionamento_explained = true;
    }
    return {
      status: statusForIntent(classification.intent),
      body: SALES_FALLBACK_BUTTONS_TEXT,
      toolCalls: [],
      updatedContext: { sales: memory },
      interactiveButtons: {
        bodyText: SALES_FALLBACK_BUTTONS_BODY,
        buttons: SALES_FALLBACK_BUTTONS,
      },
    };
  }

  // Fix 3: rotaciona entre 5 variacoes baseado no contador
  // (nextCount = 2 -> indice 1 = menu; 3 -> indice 2; etc.; antigo currentCount=1
  // ja foi tratado no branch !greeted acima)
  const variation = pickVariation(FALLBACK_VARIATIONS, incomingFallbackCount);
  const wrappedPain = withPain(memory, context.message, variation);
  memory.pain_detected = wrappedPain.painDetected;
  if (!memory.funcionamento_explained) {
    memory.funcionamento_explained = true;
  }

  // ADR-0024: so o caso geral do fora_escopo vira faixa livre — o gerador
  // responde grounded (respond) e esta enlatada e o fallback. Os sub-caminhos
  // acima (saudacoes, lead interessado, handoff em >= 7) ficam deterministicos.
  // O contador consecutive_fallback continua incrementando mesmo com geracao
  // boa: off/sombra/on so podem diferir no texto enviado, nunca no estado.
  return {
    status: statusForIntent(classification.intent),
    body: wrappedPain.body,
    toolCalls: [],
    updatedContext: { sales: memory },
    conversationalGenerationMode: "respond",
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
      parsed.intent === "small_talk" ||
      parsed.intent === "social_test" ||
      parsed.intent === "confirmacao_neutra" ||
      parsed.intent === "vai_pensar" ||
      parsed.intent === "quer_humano" ||
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
    geracaoLlmModo: "off",
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
    // QTR-35 P1-6: o estado de "já saudou" é o de ENTRADA do turno; a
    // apresentação é aplicada uma única vez, aqui, sobre QUALQUER resposta.
    const alreadyGreeted = input.context?.sales?.greeted === true;
    const reply = await this.replyForInput(input);
    return ensureGreeting(alreadyGreeted, reply);
  }

  private async replyForInput(input: SalesAgentInput): Promise<AgentReply> {
    const salesConfig = input.salesConfig ?? defaultConfig();
    const faqs = input.faqs ?? [];
    const memory: SalesConversationMemory = { ...(input.context?.sales ?? {}) };

    // Estamos esperando o nome da oficina pra concluir a conversão.
    if (memory.awaiting_workshop_name) {
      // O lead ainda pode desistir nesse ponto.
      if (isExplicitLossMessage(input.message)) {
        return {
          status: "perdido",
          body: "Tranquilo chefe, deixo registrado. Se mudar de ideia, e so me chamar de novo.",
          toolCalls: [],
          updatedContext: { sales: { ...memory, awaiting_workshop_name: false } },
        };
      }

      const nome = extractWorkshopName(input.message);
      if (!nome) {
        // Resposta não parece um nome -> pergunta de novo, sem converter.
        return {
          status: input.leadStatus,
          body: "So pra eu cadastrar certinho chefe: qual o nome da sua oficina?",
          toolCalls: [],
          updatedContext: { sales: memory },
        };
      }

      return {
        status: "teste_aceito",
        body: `Show chefe! Vou cadastrar a ${nome} em teste por aqui mesmo.`,
        toolCalls: [
          {
            toolName: "capture_workshop_name",
            input: { message: input.message },
            output: { nome },
          },
        ],
        convertToOficina: true,
        nomeOficina: nome,
        updatedContext: {
          sales: { ...memory, awaiting_workshop_name: false, workshop_name: nome },
        },
      };
    }

    const deterministic = classifySalesMessage(
      input.message,
      faqs,
      input.preMatchedFaqId,
    );

    let classification: SalesClassification = deterministic;
    if (deterministic.confidence < 0.85) {
      const fromOpenAI = await this.classifyWithOpenAI(input.message);
      if (fromOpenAI) {
        // Guard simétrico (QTR-35 P1-4b, ADR-0001): estado terminal nunca vem
        // do LLM. sem_interesse só vale com recusa explícita — que a regra 1
        // determinística já teria pego. Com dor vira pergunta_funcionamento;
        // sem dor mantém a classificação determinística (fora_escopo), que cai
        // no fluxo de fallback — nunca em copy de despedida.
        if (
          fromOpenAI.intent === "sem_interesse" &&
          !isExplicitLossMessage(input.message)
        ) {
          classification = detectPain(input.message)
            ? {
                intent: "pergunta_funcionamento",
                confidence: 0.85,
                painDetected: true,
              }
            : deterministic;
        } else if (fromOpenAI.intent === "pergunta_faq") {
          // Se o LLM disser pergunta_faq, prefiro o match deterministico
          // (keyword) e, faltando, o semântico (CV5).
          const faq =
            matchFaq(input.message, faqs) ??
            (input.preMatchedFaqId
              ? faqs.find((f) => f.id === input.preMatchedFaqId) ?? null
              : null);
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
            content: [
              "Classifique mensagens comerciais de uma oficina interessada no produto Quando Trocar. Use o intent mais especifico.",
              "Diretrizes:",
              "- small_talk e APENAS para off-topic explicito (time, futebol, piada). NUNCA use small_talk para saudacoes simples ou mensagens curtas vazias.",
              "- Saudacoes simples (\"oi\", \"ola\", \"bom dia\", \"alo\") -> fora_escopo (o backend trata com saudacao dedicada).",
              "- Confirmacao curta (\"ok\", \"blz\", \"entendi\", \"valeu\") -> confirmacao_neutra.",
              "- Hesitacao (\"vou pensar\", \"depois te falo\", \"vou ver com o socio\") -> vai_pensar.",
              "- Pedido de humano (\"passa pro Anderson\", \"quero falar com vendedor\") -> quer_humano.",
              "- Pergunta sobre o bot (\"quem e voce\", \"voce e IA\") -> pergunta_faq (FAQ dedicada).",
              "Responda apenas JSON compacto com intent, confidence, monthlyChanges e averageTicket quando existirem.",
            ].join("\n"),
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
                    "small_talk",
                    "social_test",
                    "confirmacao_neutra",
                    "vai_pensar",
                    "quer_humano",
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
