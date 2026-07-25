import OpenAI from "openai";

import { whatsappLink } from "../config";
import { parseBrazilianDate } from "./date-parse";
import { normalizeText, normalizeWhatsappPhone } from "./sales-agent";
import { ONBOARDING_CONFIRM_BUTTONS } from "./sales-buttons";
import { extractRegistrationPhone, hasRegistrationSignal } from "./registration-signal";
import type {
  ConversationAgentMode,
  ConversationContext,
  InboundMediaType,
  MarcaAmortecedor,
  OnboardingAgent,
  OnboardingAgentReply,
  RegisterServiceInput,
  ReplyGenerationMode,
  ServiceDraft,
  ServiceDraftField,
  TipoServico,
} from "./types";

type MissingField = NonNullable<ConversationContext["missing_field"]>;

const WEEKDAY_PATTERN = /\b(segunda|terca|terça|quarta|quinta|sexta|sabado|sábado|domingo)\b/;
const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;
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

function extractPhone(message: string) {
  return extractRegistrationPhone(message);
}

function removePhone(message: string, phone: string | null) {
  if (!phone) return message;
  return message.replace(phone, "").replace(/\s*,\s*$/, "").trim();
}

function extractDate(message: string, today: string) {
  return parseBrazilianDate(message, today);
}

function cleanServiceText(input: string, dateMatch?: string | null) {
  let value = input;
  // Remove o trecho exato de data reconhecido pelo parser (ex.: "amanha",
  // "daqui 3 dias", "05/06", "quarta que vem") pra não poluir o serviço.
  if (dateMatch) {
    value = value.replace(new RegExp(escapeRegExp(dateMatch), "gi"), " ");
  }
  return value
    .replace(/\bhoje\b/gi, "")
    .replace(/\bontem\b/gi, "")
    .replace(/\bamanh[ãa]\b/gi, "")
    .replace(WEEKDAY_PATTERN, "")
    .replace(/cliente\s+nao\s+autorizou\s+mensagem/gi, "")
    .replace(/cliente\s+não\s+autorizou\s+mensagem/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// A oficina costuma descrever o carro numa frase ("o carro dele é um UP",
// "ela tem um HB20", "carro: Gol"). Guardamos SOMENTE o modelo/descrição, sem o
// embrulho conversacional — esse valor vai direto pra mensagem que o cliente
// final lê (template confirmacao_servico → {{carro}}).
const VEICULO_STRIP_PATTERNS: ReadonlyArray<RegExp> = [
  // posse: "ele/ela tem (um/uma)"
  /^(?:ele|ela|eles|elas)\s+tem\s+(?:um|uma)?\s*/i,
  // rótulo carro/veículo (+ possessivo opcional: dele, do cliente...). O \b
  // depois do possessivo evita que "de" case dentro de "dele".
  /^(?:carro|veiculo|veículo|auto|autom[oó]vel|moto)\b(?:\s+(?:dele|dela|deles|delas|do|da|de)\b(?:\s+cliente)?)?\s*/i,
  // possessivo solto / "do cliente"
  /^(?:dele|dela|deles|delas|do\s+cliente|da\s+cliente)\s+/i,
  // artigos / determinantes
  /^(?:o|a|os|as|um|uma|esse|essa|este|esta|aquele|aquela|meu|minha|seu|sua)\s+/i,
  // cópula / rótulo de modelo
  /^(?:é|eh|seria|do\s+modelo|modelo(?:\s+é)?)\s+/i,
  // pontuação residual nas pontas
  /^[\s:,.\-]+/,
];

// Modelos têm caixa idiossincrática (UP, HB20, T-Cross, S10, 208). Preservamos
// tokens que já tenham maiúscula ou dígito; só capitalizamos a inicial de
// tokens 100% minúsculos (gol → Gol, civic → Civic).
function capitalizeVehicleToken(word: string): string {
  if (!word) return word;
  if (/[A-ZÀ-Ý0-9]/.test(word)) return word;
  return word.replace(/^(\p{L})/u, (ch) => ch.toLocaleUpperCase("pt-BR"));
}

// Palavras do embrulho conversacional. Usadas só pra aparar as PONTAS do
// resultado (nunca o miolo, pra não quebrar "Gol G5 de Luxo"), cobrindo o que
// sobra quando o padrão exige espaço seguinte (ex.: "um" no fim da frase).
const VEICULO_STOPWORDS = new Set([
  "o", "a", "os", "as", "um", "uma", "é", "eh", "e",
  "de", "do", "da", "dele", "dela", "deles", "delas",
  "carro", "veiculo", "veículo", "modelo", "tem", "seria",
]);

export function normalizeVeiculo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.replace(/\s+/g, " ").trim();
  if (!value) return null;

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of VEICULO_STRIP_PATTERNS) {
      const next = value.replace(pattern, "");
      if (next !== value) {
        value = next.trim();
        changed = true;
      }
    }
  }

  value = value.replace(/[\s:,.\-]+$/g, "").trim();
  if (!value) return null;

  const tokens = value.split(/\s+/).filter(Boolean);
  const isStopword = (token: string) =>
    VEICULO_STOPWORDS.has(token.toLocaleLowerCase("pt-BR"));
  while (tokens.length && isStopword(tokens[0])) tokens.shift();
  while (tokens.length && isStopword(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return null;

  return tokens.map(capitalizeVehicleToken).join(" ");
}

// A oficina descreve o serviço falando ("ele acabou de trocar um amortecedor da
// Perfect"). Guardamos só a descrição curta ("amortecedor da Perfect"): esse
// texto vai para `servicos.tipo`/`descricao` e alimenta os relatórios do admin.
// Aparamos o embrulho de fala nas PONTAS, nunca o miolo — "troca de oleo" e
// "amortecedor dianteiro" ficam intactos.
const SERVICO_STRIP_PATTERNS: ReadonlyArray<RegExp> = [
  // sujeito de fala
  /^(?:eu|ele|ela|eles|elas|a\s+gente|n[oó]s)\s+/i,
  // aspecto verbal ("acabou de", "acabei de", "terminei de")
  /^(?:acab\w+|termin\w+)\s+(?:de\s+)?/i,
  // verbo conjugado de execução (o infinitivo e o substantivo "troca de" ficam:
  // são descrição legítima)
  /^(?:troquei|trocou|trocamos|trocaram|fiz|fez|fizemos|fizeram|coloquei|colocou|colocamos|instalei|instalou|instalamos|revisei|revisou)\s+/i,
  /^trocar\s+(?:o|a|os|as|um|uma)?\s*/i,
  // rótulo de serviço
  /^(?:servi[cç]os?)\b(?:\s+(?:de|foi))?\s*/i,
  // artigos / determinantes / preposições soltas
  /^(?:o|a|os|as|um|uma|uns|umas|no|na)\s+/i,
  // cópula / conector
  /^(?:é|eh|foi|seria)\s+/i,
  // pontuação residual nas pontas
  /^[\s:,.\-]+/,
];

export function normalizeServico(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.replace(/\s+/g, " ").trim();
  if (!value) return null;

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of SERVICO_STRIP_PATTERNS) {
      const next = value.replace(pattern, "");
      if (next !== value) {
        value = next.trim();
        changed = true;
      }
    }
  }

  value = value.replace(/[\s:,.\-]+$/g, "").trim();
  if (!value) return null;

  // Conector órfão nas pontas ("acabou de" → "de"): os padrões acima exigem
  // espaço seguinte, então sobra token solto no fim da frase.
  const tokens = value.split(/\s+/).filter(Boolean);
  const isConnector = (token: string) =>
    SERVICO_EDGE_STOPWORDS.has(token.toLocaleLowerCase("pt-BR"));
  while (tokens.length && isConnector(tokens[0])) tokens.shift();
  while (tokens.length && isConnector(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return null;

  return tokens.join(" ");
}

const SERVICO_EDGE_STOPWORDS = new Set([
  "de", "do", "da", "dos", "das", "e", "o", "a", "os", "as", "em", "no", "na",
  "um", "uma", "que", "com",
]);

// --- Guarda de sanidade determinística (QTR-35 P0-1) ------------------------
// Roda DEPOIS da extração (LLM ou parser) e ANTES de o rascunho ser aceito.
// Campo suspeito não é confirmado nem persistido: volta a contar como campo
// faltante e o bot pergunta. É a rede que faltava quando o áudio
// "Ó, o nome dele é Leonardo, ele acabou de trocar um amortecedor da Perfect,
// ele tem uma BMW e na data de hoje" gravou nome = "Ó",
// veiculo = "Nome Dele É Leonardo" e servico = a frase inteira.

// Muletas de fala que a transcrição joga no começo da frase e que o parser
// posicional captura como se fossem o nome do cliente.
const SUSPECT_FILLER_TOKENS = new Set([
  "o", "a", "e", "eh", "oi", "ola", "ah", "ahn", "han", "hein", "ne",
  "entao", "olha", "escuta", "ele", "ela", "eles", "elas", "esse", "essa",
  "isso", "aqui", "ali", "tipo", "assim", "bom", "cara", "chefe", "nome",
  "cliente", "senhor", "senhora",
]);

// Palavra que só aparece num nome/veículo quando um campo vazou para o outro
// ou quando a frase inteira entrou no campo.
const SUSPECT_CROSS_FIELD_PATTERN =
  /\b(nome|ele|ela|dele|dela|acabou|acabei|trocou|troquei|trocar|data|hoje|ontem|amanha|cliente)\b/;

// Verbo conjugado de fala sobrando: sinal de que ficou frase, não descrição.
const SUSPECT_SERVICE_VERB_PATTERN =
  /\b(acabou|acabei|troquei|trocou|trocamos|trocaram|fiz|fez|fizemos|tem|tinha|veio|chegou|estava|era)\b/;

const SERVICO_MAX_LENGTH = 60;
const VEICULO_MAX_LENGTH = 40;
const VEICULO_MAX_TOKENS = 6;
// Janela de sanidade da data. Larga de propósito: o parser determinístico é a
// autoridade e, quando a mensagem não traz o ano, ele assume o ano corrente —
// então uma data legítima pode cair a até ~364 dias de distância ("31/12" dito
// em janeiro, "05/05" dito em dezembro). O alvo aqui é o erro de ORDEM DE
// GRANDEZA que só um extrator não-determinístico comete (devolver 2028 para
// "na data de hoje"), que é o que faria o lembrete ser agendado anos à frente.
const DATA_SERVICO_MAX_DIAS_PASSADO = 366;
const DATA_SERVICO_MAX_DIAS_FUTURO = 366;

function isSaneServiceDate(iso: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const value = Date.parse(`${iso}T00:00:00Z`);
  const reference = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(value) || Number.isNaN(reference)) return false;
  const dias = (value - reference) / 86_400_000;
  return dias >= -DATA_SERVICO_MAX_DIAS_PASSADO && dias <= DATA_SERVICO_MAX_DIAS_FUTURO;
}

// Campos do rascunho que não passam a guarda. Exportada para teste e para o
// log de qualidade da extração.
export function suspectDraftFields(
  draft: ServiceDraft,
  today: string,
): MissingField[] {
  const suspect: MissingField[] = [];

  if (draft.nome_cliente !== undefined) {
    const value = draft.nome_cliente.trim();
    const normalized = normalizeText(value);
    const tokens = normalized.split(" ").filter(Boolean);
    if (
      value.length < 2 ||
      tokens.length === 0 ||
      tokens.every((token) => SUSPECT_FILLER_TOKENS.has(token)) ||
      SUSPECT_CROSS_FIELD_PATTERN.test(normalized)
    ) {
      suspect.push("nome_cliente");
    }
  }

  if (draft.veiculo !== undefined) {
    const value = draft.veiculo.trim();
    const tokens = value.split(/\s+/).filter(Boolean);
    if (
      value.length < 2 ||
      value.length > VEICULO_MAX_LENGTH ||
      tokens.length > VEICULO_MAX_TOKENS ||
      SUSPECT_CROSS_FIELD_PATTERN.test(normalizeText(value))
    ) {
      suspect.push("veiculo");
    }
  }

  if (draft.servico !== undefined) {
    const value = draft.servico.trim();
    if (
      value.length < 3 ||
      value.length > SERVICO_MAX_LENGTH ||
      SUSPECT_SERVICE_VERB_PATTERN.test(normalizeText(value))
    ) {
      suspect.push("servico");
    }
  }

  if (draft.data_servico !== undefined && !isSaneServiceDate(draft.data_servico, today)) {
    suspect.push("data_servico");
  }

  return suspect;
}

// Remove do rascunho os campos que a guarda reprovou, para que
// `missingFieldForDraft` volte a pedi-los.
function pruneSuspectFields(
  draft: ServiceDraft,
  today: string,
): { draft: ServiceDraft; suspectFields: MissingField[] } {
  const suspectFields = suspectDraftFields(draft, today);
  if (suspectFields.length === 0) return { draft, suspectFields };

  const next: ServiceDraft = { ...draft };
  for (const field of suspectFields) {
    delete next[field];
  }
  // Sem serviço confiável, o tipo derivado dele também cai — senão um
  // `tipo_servico = amortecedor` alucinado sobreviveria a um serviço corrigido
  // para "troca de oleo" e agendaria o lembrete com a cadência errada.
  // `marca_peca` fica: veio da mensagem original e só é usada se o tipo voltar
  // a ser amortecedor.
  if (suspectFields.includes("servico")) {
    delete next.tipo_servico;
  }

  return { draft: next, suspectFields };
}

// Campos que NÃO dependem da posição na frase: telefone, data, marca da peça e
// consentimento. São seguros em texto falado, ao contrário do split por vírgula
// — e a DATA em especial só é resolvível aqui, porque o LLM não tem referência
// temporal confiável para "na data de hoje" (QTR-35 P0-1).
function parseNonPositional(message: string, today: string): ServiceDraft {
  const draft: ServiceDraft = {
    valor: null,
    consentimento_whatsapp: !hasNegativeConsent(message),
  };

  const phone = extractPhone(message);
  if (phone) draft.whatsapp_cliente = normalizeWhatsappPhone(phone);

  const parsedDate = extractDate(message, today);
  if (parsedDate.date) draft.data_servico = parsedDate.date;

  const marca = extractMarcaFromMessage(message);
  if (marca) draft.marca_peca = marca;

  return draft;
}

// Parser posicional por vírgula (`Nome, Carro, Servico, Data, Telefone`). Só
// funciona para quem digita seguindo o exemplo do bot — em fala natural a
// posição da vírgula é aleatória. Desde o QTR-35 é FALLBACK do LLM e nunca roda
// em transcrição de áudio.
function parseDeterministic(message: string, today: string): ServiceDraft {
  const phone = extractPhone(message);
  const withoutPhone = removePhone(message, phone);
  const parts = withoutPhone
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const serviceSource = parts.slice(2).join(", ") || parts[2] || "";
  const parsedDate = extractDate(message, today);
  const service = normalizeServico(
    cleanServiceText(serviceSource, parsedDate.matchedText),
  );
  const draft: ServiceDraft = parseNonPositional(message, today);

  if (parts[0]) {
    const nome = normalizeNomeCliente(parts[0]);
    if (nome) draft.nome_cliente = nome;
  }
  if (parts[1]) {
    const veiculo = normalizeVeiculo(parts[1]);
    if (veiculo) draft.veiculo = veiculo;
  }
  if (service) draft.servico = service;

  if (service) {
    draft.tipo_servico = detectTipoServico(service);
  }

  return draft;
}

// Mescla `override` sobre `base` SEM apagar campo bom. Spread cru não serve:
// `{ ...base, ...{ veiculo: undefined } }` zera `veiculo`, e
// `parseOpenAIExtraction` devolve `undefined` para todo campo que o modelo não
// encontrou — ou seja, uma extração parcial apagava o que o parser tinha
// acertado (QTR-35 P0-1).
function mergeDrafts(base: ServiceDraft, override: ServiceDraft | null): ServiceDraft {
  const merged: ServiceDraft = { ...base };
  if (!override) return merged;

  if (override.nome_cliente) merged.nome_cliente = override.nome_cliente;
  if (override.whatsapp_cliente) merged.whatsapp_cliente = override.whatsapp_cliente;
  if (override.veiculo) merged.veiculo = override.veiculo;
  if (override.servico) merged.servico = override.servico;
  if (override.data_servico) merged.data_servico = override.data_servico;
  if (override.tipo_servico) merged.tipo_servico = override.tipo_servico;
  if (override.marca_peca) merged.marca_peca = override.marca_peca;
  if (override.valor !== undefined && override.valor !== null) {
    merged.valor = override.valor;
  }
  // Consentimento só se move na direção segura: se qualquer extrator entendeu
  // que o cliente não autorizou, não manda template (regras §7.1).
  if (override.consentimento_whatsapp === false) {
    merged.consentimento_whatsapp = false;
  }

  return merged;
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
      const veiculo = normalizeVeiculo(message);
      if (veiculo) draft.veiculo = veiculo;
    }
  }

  if (context.missing_field === "servico") {
    const service = normalizeServico(cleanServiceText(message));
    if (
      !isNeutralMessage(message) &&
      !isQuestionLike(message) &&
      service &&
      service.length >= 3
    ) {
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

function missingFieldReply(
  draft: ServiceDraft,
  missingField: MissingField,
  feedback?: { changedFields?: ServiceDraftField[]; suspectFields?: ServiceDraftField[] },
): OnboardingAgentReply {
  const warning = feedback?.suspectFields?.length
    ? `${feedback.suspectFields.map(sanityWarning).join("\n")}\n\n`
    : "";
  return {
    body: `${warning}${questionForMissingField(missingField)}`,
    context: draftContext(draft, missingField, feedback),
    registerServiceInput: null,
    nextAgentMode: null,
    toolCalls: [],
  };
}

function draftToRegisterInput(
  draft: ServiceDraft,
): Omit<RegisterServiceInput, "oficinaId"> {
  const tipoServico = draft.tipo_servico ?? detectTipoServico(draft.servico);
  const marcaPeca = tipoServico === "amortecedor" ? draft.marca_peca ?? null : null;
  return {
    nomeCliente: draft.nome_cliente!,
    whatsappCliente: draft.whatsapp_cliente!,
    // Guard final antes de persistir: garante veículo limpo mesmo se algum
    // caminho de captura tiver escapado da normalização.
    veiculo: normalizeVeiculo(draft.veiculo) ?? draft.veiculo!,
    servico: draft.servico!,
    dataServico: draft.data_servico!,
    valor: draft.valor ?? null,
    consentimentoWhatsapp: draft.consentimento_whatsapp ?? true,
    tipoServico,
    marcaPeca,
  };
}

function draftContext(
  draft: ServiceDraft,
  missingField: MissingField,
  feedback?: {
    changedFields?: ServiceDraftField[];
    suspectFields?: ServiceDraftField[];
  },
): ConversationContext {
  return {
    pending_action: "registrar_primeira_troca",
    missing_field: missingField,
    service_draft: draft,
    service_draft_feedback:
      feedback && (feedback.changedFields?.length || feedback.suspectFields?.length)
        ? {
            changed_fields: feedback.changedFields,
            suspect_fields: feedback.suspectFields,
          }
        : undefined,
  };
}

// Prompt do extrator primário (QTR-35 P0-1). O contrato de dados aqui é o que
// precisamos preencher de fato — mesma lista de campos do schema `strict` e das
// colunas que o RPC grava. Espelhado em
// `.codex/prompts/whatsapp-onboarding-agent.md`.
function extractionSystemPrompt(options: {
  today: string;
  fromSpeech: boolean;
}): string {
  const lines = [
    "Você extrai dados de cadastro de troca de uma oficina mecânica brasileira a partir de uma mensagem de WhatsApp.",
    `Data de hoje: ${options.today} (America/Sao_Paulo).`,
    "Responda apenas o JSON do schema solicitado, sem comentário.",
    "",
    "Regras por campo:",
    "- nome_cliente: só o nome da pessoa. Sem muleta de fala (\"ó\", \"então\", \"olha\"), sem pronome, sem rótulo (\"o nome dele é\").",
    "- whatsapp_cliente: o telefone do cliente se a mensagem trouxer; senão null.",
    "- veiculo: SOMENTE marca/modelo (+ ano/cor se houver), nunca a frase. \"ele tem uma BMW\" → \"BMW\".",
    "- servico: descrição CURTA e normalizada do que foi feito, no máximo 5 palavras e sem verbo conjugado. \"ele acabou de trocar um amortecedor da Perfect\" → \"troca de amortecedor\".",
    "- data_servico: YYYY-MM-DD, resolvendo referência relativa contra a data de hoje; null se a mensagem não disser.",
    "- tipo_servico: um de troca_oleo | amortecedor | revisao | outro.",
    "- marca_peca: só quando tipo_servico = amortecedor; um de perfect | monroe | cofap | nakata | outra; senão null.",
    "- valor: número em reais se a mensagem disser; senão null.",
    "- consentimento_whatsapp: false só quando a mensagem disser que o cliente não autorizou receber mensagem; senão true.",
    "",
    "Campo que a mensagem não informa é null. Não invente e não reaproveite o valor de um campo em outro.",
  ];

  if (options.fromSpeech) {
    lines.push(
      "",
      "A mensagem é transcrição de áudio: espere muleta de fala, repetição, frase quebrada e vírgula fora de lugar. A posição das vírgulas não separa campos — entenda o sentido.",
    );
  }

  return lines.join("\n");
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
      veiculo: normalizeVeiculo(parsed.data.veiculo) ?? undefined,
      servico: normalizeServico(parsed.data.servico) ?? undefined,
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

// Tokens que, sozinhos ou combinados, significam "pode cadastrar". A
// confirmação só dispara o cadastro quando TODOS os tokens da mensagem estão
// nesta lista — assim "sim pode cadastrar" confirma, mas "sim mas o carro e
// Gol" cai no fluxo de correção (nunca grava dado errado por engano).
const CONFIRMATION_AFFIRMATIVE_TOKENS = new Set([
  "sim", "isso", "mesmo", "ai", "exato", "exatamente", "correto", "corretos",
  "esta", "ta", "tah", "certo", "certinho", "certos", "tudo", "perfeito",
  "confirmo", "confirmado", "confirma", "confirmar", "pode", "podem", "poder",
  "cadastrar", "cadastra", "registrar", "registra", "salvar", "salva", "ok",
  "okay", "blz", "beleza", "positivo", "com", "certeza", "senhor", "senhora",
  "aham", "uhum", "ja", "manda", "mandar", "bora", "vai", "vamos", "fechado",
  "show", "claro", "afirmativo",
]);

function isAffirmativeConfirmation(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((token) => CONFIRMATION_AFFIRMATIVE_TOKENS.has(token));
}

const MARCA_LABELS: Record<MarcaAmortecedor, string> = {
  perfect: "Perfect",
  monroe: "Monroe",
  cofap: "Cofap",
  nakata: "Nakata",
  outra: "outra",
};

function formatDateBR(iso: string | undefined | null): string {
  if (!iso) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function serviceSummaryLine(draft: ServiceDraft): string {
  const tipo = draft.tipo_servico ?? detectTipoServico(draft.servico);
  let label = draft.servico ?? "-";
  if (tipo === "amortecedor" && draft.marca_peca) {
    label += ` (${MARCA_LABELS[draft.marca_peca]})`;
  }
  return label;
}

const SERVICE_DRAFT_FIELD_LABELS: Record<ServiceDraftField, string> = {
  nome_cliente: "Cliente",
  whatsapp_cliente: "WhatsApp",
  veiculo: "Carro",
  servico: "Serviço",
  data_servico: "Data",
  marca_peca: "Marca da peça",
};

function fieldLabel(field: ServiceDraftField): string {
  return SERVICE_DRAFT_FIELD_LABELS[field];
}

function sanityWarning(field: ServiceDraftField): string {
  return `⚠️ Não consegui validar o campo *${fieldLabel(field)}*. Ele foi retirado do card para não cadastrar um dado incorreto.`;
}

function confirmationSummary(
  draft: ServiceDraft,
  feedback?: { changedFields?: ServiceDraftField[] },
): string {
  const changed = feedback?.changedFields?.filter(Boolean) ?? [];
  return [
    "Confere os dados antes de eu registrar:",
    ...(changed.length
      ? [
          `✅ Atualizado agora: ${changed
            .map((field) => `*${fieldLabel(field)}*`)
            .join(", ")}`,
        ]
      : []),
    "",
    `• Cliente: ${draft.nome_cliente ?? "-"}`,
    `• Carro: ${draft.veiculo ?? "-"}`,
    `• Servico: ${serviceSummaryLine(draft)}`,
    `• Data: ${formatDateBR(draft.data_servico)}`,
    `• WhatsApp: ${draft.whatsapp_cliente ?? "-"}`,
    "",
    'Esta correto? Responda *sim* pra confirmar, ou me diga o que corrigir (ex.: "o carro e Gol").',
  ].join("\n");
}

function confirmationContext(
  draft: ServiceDraft,
  feedback?: { changedFields?: ServiceDraftField[]; suspectFields?: ServiceDraftField[] },
): ConversationContext {
  return {
    pending_action: "registrar_primeira_troca",
    awaiting_confirmation: true,
    service_draft: draft,
    service_draft_feedback:
      feedback && (feedback.changedFields?.length || feedback.suspectFields?.length)
        ? {
            changed_fields: feedback.changedFields,
            suspect_fields: feedback.suspectFields,
          }
        : undefined,
  };
}

function confirmationReply(
  draft: ServiceDraft,
  sourceMediaType?: InboundMediaType | null,
  feedback?: { changedFields?: ServiceDraftField[]; suspectFields?: ServiceDraftField[] },
): OnboardingAgentReply {
  return {
    body: confirmationSummary(draft, feedback),
    context: confirmationContext(draft, feedback),
    registerServiceInput: null,
    nextAgentMode: null,
    toolCalls: [
      {
        toolName: "solicitou_confirmacao_cadastro",
        // `source_media_type` fecha o log de qualidade da extração: dá para
        // medir acerto por origem (digitado vs. transcrição de áudio).
        input: { source_media_type: sourceMediaType ?? "text" },
        output: { draft: draft as Record<string, unknown> },
      },
    ],
    // QTR-35 P1-8: o card oferece a decisão num toque. O id do botão vira a
    // mensagem canônica "confirmar"/"corrigir" (payload), tratada pelo mesmo
    // fluxo determinístico — estado idêntico com ou sem botões (ADR-0024).
    interactiveButtons: {
      bodyText: confirmationSummary(draft, feedback),
      buttons: ONBOARDING_CONFIRM_BUTTONS,
    },
  };
}

// QTR-35 P1-8: entrada determinística no fluxo de correção. O botão "Corrigir"
// (e um "nao"/"errado" seco) não precisa de LLM para cair na pergunta "o que
// corrigir?" — antes qualquer não-"sim" pagava uma chamada de extração.
const CORRECTION_ENTRY_PATTERN =
  /^(corrigir|corrige|nao|errado|ta errado|nao ta certo|nao esta certo|tem erro)$/;

function isCorrectionEntryMessage(message: string) {
  return CORRECTION_ENTRY_PATTERN.test(normalizeText(message));
}

function correctionPromptReply(
  draft: ServiceDraft,
  message: string,
  feedback?: { changedFields?: ServiceDraftField[]; suspectFields?: ServiceDraftField[] },
): OnboardingAgentReply {
  const warning = feedback?.suspectFields?.length
    ? `${feedback.suspectFields.map(sanityWarning).join("\n")}\n\n`
    : "";
  return {
    body: [
      warning,
      "Sem problema. Me diga o que corrigir.",
      'Por exemplo: "o carro e Gol" ou "o nome e Flaviane Marsili".',
      "Ou reenvie tudo: nome do cliente, carro, servico, data e WhatsApp.",
    ].join("\n"),
    context: confirmationContext(draft, feedback),
    registerServiceInput: null,
    nextAgentMode: null,
    toolCalls: [
      {
        toolName: "confirmou_cadastro",
        input: { message },
        output: { confirmed: false, parsed: false },
      },
    ],
  };
}

// Mescla uma correção parcial sobre o rascunho existente. Só sobrescreve campos
// que a correção realmente trouxe (não-vazios); valor/consentimento não mudam
// numa correção de campo. Recalcula tipo/marca quando o serviço muda.
function mergeDraftCorrection(base: ServiceDraft, update: ServiceDraft): ServiceDraft {
  const merged: ServiceDraft = { ...base };
  if (update.nome_cliente) merged.nome_cliente = update.nome_cliente;
  if (update.whatsapp_cliente) merged.whatsapp_cliente = update.whatsapp_cliente;
  if (update.veiculo) merged.veiculo = update.veiculo;
  if (update.data_servico) merged.data_servico = update.data_servico;
  if (update.servico) {
    merged.servico = update.servico;
    const tipo = update.tipo_servico ?? detectTipoServico(update.servico);
    merged.tipo_servico = tipo;
    merged.marca_peca =
      tipo === "amortecedor" ? update.marca_peca ?? base.marca_peca ?? null : null;
  }
  if (update.marca_peca && (merged.tipo_servico ?? detectTipoServico(merged.servico)) === "amortecedor") {
    merged.marca_peca = update.marca_peca;
  }
  return merged;
}

// --- Respostas neutras / conversacionais (não são cadastro) -----------------
// A oficina manda saudação, small-talk ("tudo bem?"), pergunta como funciona ou
// só um "ok". Antes isto caía em duas frases fixas repetidas ad nauseam (efeito
// "disco riscado", às 22h ainda dizia "Bom dia"). Agora classificamos a intenção
// social, cumprimentamos pelo horário e rotacionamos entre variações. Tudo
// determinístico — a camada CV1 (ADR-0020) só põe polimento por cima quando
// ligada (e só nestas respostas: as transacionais seguem enlatadas).

type NeutralKind =
  | "como_funciona"
  | "small_talk"
  | "saudacao"
  | "agradecimento"
  | "pergunta"
  | "generico";

const COMO_FUNCIONA_PATTERN =
  /\b(como funciona|como que funciona|como (eu )?faco|como (eu )?uso|como usa|o que e isso|pra que serve|nao entendi|nao intendi|me ajuda|como assim|manual|tutorial)\b/;
// Frases claramente sociais (multi-token): não confundem com cadastro nem ack.
const SMALL_TALK_PATTERN =
  /\b(tudo bem|tudo bom|td bem|td bom|tudo tranquilo|como vai|como voce esta|como voce ta|como ce ta|como tu ta|como estao|como anda|de boa|na paz)\b/;
// Tokens ambíguos: sociais só quando vêm em pergunta ("beleza?"); sem "?" são ack.
const AMBIGUOUS_SOCIAL_PATTERN = /\b(beleza|blz|suave|firmeza|tranquilo|bao)\b/;
const SAUDACAO_PATTERN =
  /\b(oi|ola|opa|eai|e ai|fala|salve|bom dia|boa tarde|boa noite|boas)\b/;
const AGRADECIMENTO_PATTERN =
  /\b(obrigad|obg|valeu|vlw|agradeco|show|otimo|perfeito|ok|okay|okey|certo|entendi|joia|massa|top|combinado|fechado)\b/;

function classifyNeutral(message: string): NeutralKind {
  const normalized = normalizeText(message);
  const question = isQuestionLike(message);

  if (COMO_FUNCIONA_PATTERN.test(normalized)) return "como_funciona";
  if (SMALL_TALK_PATTERN.test(normalized)) return "small_talk";
  if (question && AMBIGUOUS_SOCIAL_PATTERN.test(normalized)) return "small_talk";
  if (SAUDACAO_PATTERN.test(normalized)) return "saudacao";
  if (AGRADECIMENTO_PATTERN.test(normalized)) return "agradecimento";
  // Pergunta real fora do cadastro ("ja sou cliente?", "voces fazem
  // alinhamento?"): em vez de despejar o formulario, handoff + respond
  // grounded (ADR-0022). Checada por ultimo pra nao roubar das categorias
  // sociais acima.
  if (question) return "pergunta";
  return "generico";
}

// Preco/cobranca e trilho critico (ADR-0012): a pergunta recebe handoff
// deterministico e a geracao fica em rewrite (o LLM so pole o handoff —
// nunca "responde" preco). Testado sobre o texto normalizado (sem acentos).
const PRICE_QUESTION_PATTERN =
  /\b(preco|precos|custa|custo|valor|valores|mensalidade|plano|planos|assinatura|cobranca|pagar|pagamento)\b/;

function saudacaoTemporal(hour: number | undefined): string {
  if (hour === undefined || Number.isNaN(hour)) return "Ola";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function pickVariation<T>(pool: ReadonlyArray<T>, index: number): T {
  return pool[index % pool.length];
}

// Saudação de primeiro contato: cumprimento temporal + orientação + exemplo.
const SAUDACAO_INICIAL: ReadonlyArray<(saud: string) => string> = [
  (s) =>
    [
      `${s}. Posso registrar a troca por aqui.`,
      "Me envie em uma mensagem: nome do cliente, carro, servico, data e WhatsApp.",
      registrationExample(),
    ].join("\n"),
  (s) =>
    [
      `${s}, tudo bem? Pode registrar a troca comigo.`,
      "E so mandar: nome do cliente, carro, servico, data e WhatsApp do cliente.",
      registrationExample(),
    ].join("\n"),
  (s) =>
    [
      `${s}. Por aqui voce registra a troca rapidinho.`,
      "Manda em uma linha: nome, carro, servico, data e WhatsApp.",
      registrationExample(),
    ].join("\n"),
];

// Saudação subsequente (já cumprimentou antes): curta, sem repetir o exemplo.
const SAUDACAO_SUBSEQUENTE: ReadonlyArray<(saud: string) => string> = [
  (s) => `${s}. Quando tiver uma troca pra registrar, e so mandar os dados do cliente.`,
  (s) => `${s} de novo. Estou por aqui, manda a proxima troca quando quiser.`,
  (s) => `${s}. Seguimos: e so me passar nome, carro, servico, data e WhatsApp.`,
];

const SMALL_TALK: ReadonlyArray<string> = [
  "Tudo otimo por aqui. Quando tiver uma troca, e so mandar os dados do cliente.",
  "Tudo certo. Bora registrar? Me manda nome, carro, servico, data e WhatsApp.",
  "Tudo bem, obrigado! Quando quiser, e so me passar os dados da proxima troca.",
  "Tudo tranquilo. Estou aqui pra registrar as trocas, manda quando precisar.",
];

const COMO_FUNCIONA: ReadonlyArray<string> = [
  [
    "Funciona assim: voce me manda os dados da troca, eu registro e ainda lembro o cliente na proxima.",
    "Manda em uma mensagem: nome do cliente, carro, servico, data e WhatsApp.",
    registrationExample(),
  ].join("\n"),
  [
    "Simples: cada troca que voce registra aqui vira um lembrete automatico pro cliente voltar.",
    "E so mandar: nome, carro, servico, data e WhatsApp do cliente.",
    registrationExample(),
  ].join("\n"),
];

const AGRADECIMENTO: ReadonlyArray<string> = [
  "Disponha. Quando tiver uma troca, e so mandar.",
  "Estou por aqui. Manda a proxima troca quando quiser.",
  "Combinado. Qualquer troca nova, e so me passar os dados.",
];

// Enlatada da categoria `pergunta` (ADR-0022): resposta curta + handoff +
// convite a registrar. E o fallback obrigatorio quando o respond falha,
// estoura timeout, devolve dontKnow ou e vetado pelo validador — ou seja,
// "nao sei" vira encaminhamento pra humano, nunca chute.
const PERGUNTA_COM_LINK: ReadonlyArray<(link: string) => string> = [
  (link) =>
    `Boa pergunta! Essa parte quem resolve rapidinho e o comercial: ${link}. E quando tiver uma troca pra registrar, e so me mandar os dados do cliente.`,
  (link) =>
    `Essa eu deixo com o time comercial, chefe: ${link}. Por aqui eu registro suas trocas — manda os dados quando precisar.`,
  (link) =>
    `Pra te responder direitinho, melhor falar com o comercial: ${link}. E qualquer troca nova, e so mandar por aqui.`,
];

// Sem handoff configurado: mesma estrutura, sem link (nunca inventar numero
// nem usar o proprio numero do bot como "comercial").
const PERGUNTA_SEM_LINK: ReadonlyArray<string> = [
  "Boa pergunta! Vou deixar um humano te responder por aqui. Enquanto isso, se tiver uma troca pra registrar, e so mandar os dados do cliente.",
  "Essa eu passo pra um humano te responder por aqui. Por enquanto, qualquer troca nova e so me mandar os dados.",
];

const GENERICO: ReadonlyArray<string> = [
  [
    "Posso registrar por aqui.",
    "Me envie nome do cliente, carro, servico, data e WhatsApp.",
    registrationExample(),
  ].join("\n"),
  [
    "Pra registrar e rapidinho, manda em uma mensagem so:",
    "nome, carro, servico, data e WhatsApp do cliente.",
    registrationExample(),
  ].join("\n"),
  [
    "Nao peguei bem. Se for registrar uma troca, me manda:",
    "nome do cliente, carro, servico, data e WhatsApp.",
    registrationExample(),
  ].join("\n"),
];

function neutralReply(
  message: string,
  context: ConversationContext,
  hour: number | undefined,
  handoffComercial: string | null | undefined,
): OnboardingAgentReply {
  const kind = classifyNeutral(message);
  const turn = context.neutral_turn ?? 0;
  const saud = saudacaoTemporal(hour);

  let body: string;
  let greeted = context.greeted ?? false;
  // Como a camada de geração trata esta resposta (ADR-0022): rewrite só pole a
  // enlatada; respond responde a pergunta grounded em conhecimento fechado.
  let generationMode: ReplyGenerationMode = "rewrite";

  switch (kind) {
    case "saudacao":
      if (greeted) {
        body = pickVariation(SAUDACAO_SUBSEQUENTE, turn)(saud);
      } else {
        body = pickVariation(SAUDACAO_INICIAL, turn)(saud);
        greeted = true;
      }
      break;
    case "small_talk":
      body = pickVariation(SMALL_TALK, turn);
      break;
    case "como_funciona":
      body = pickVariation(COMO_FUNCIONA, turn);
      // Já explicou o produto: a próxima saudação pode ser a curta.
      greeted = true;
      break;
    case "agradecimento":
      body = pickVariation(AGRADECIMENTO, turn);
      break;
    case "pergunta": {
      // Preço força rewrite (trilho crítico, ADR-0012); o resto vai a respond.
      const isPriceQuestion = PRICE_QUESTION_PATTERN.test(normalizeText(message));
      generationMode = isPriceQuestion ? "rewrite" : "respond";
      const link = handoffComercial
        ? whatsappLink({ phone: handoffComercial })
        : null;
      body = link
        ? pickVariation(PERGUNTA_COM_LINK, turn)(link)
        : pickVariation(PERGUNTA_SEM_LINK, turn);
      break;
    }
    default:
      body = pickVariation(GENERICO, turn);
  }

  return {
    body,
    // Persiste rotação + flag de saudação para não repetir a mesma frase no
    // próximo turno. Este ramo só roda sem draft/missing_field, então o contexto
    // conversacional não colide com estado de cadastro.
    context: { neutral_turn: turn + 1, greeted },
    registerServiceInput: null,
    nextAgentMode: null,
    // Texto de conversa livre: a camada CV1/CV2 pode gerar (ADR-0020/0022).
    allowConversationalGeneration: true,
    conversationalGenerationMode: generationMode,
    toolCalls: [
      {
        toolName: "ignored_operational_message",
        input: { message },
        output: { reason: "no_registration_signal", neutral_kind: kind },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// CV6 — consultas read-only da operação. O agente só CLASSIFICA a intenção e
// (para cliente) extrai o termo de busca; a leitura de dados é feita pelo
// webhook-handler, sempre escopada por oficina_id. Leitura não muda estado
// (ADR-0001). Detecção 100% determinística e testável.
// ---------------------------------------------------------------------------
const REMINDER_WORD =
  /\b(lembrete|lembretes|avis(o|os|ei|amos|ar)|disparo|disparos)\b/;
const MESSAGE_WORD = /\b(mensagem|mensagens)\b/;
const MONTH_WORD =
  /\b(mes|do mes|esse mes|este mes|no mes|neste mes|nesse mes|por mes)\b/;
const COUNT_WORD = /\b(quant[oa]s?|quantidade|numero de|total de)\b/;
const UPCOMING_HINT =
  /\b(proxim[oa]s?|quais|quem|hoje|amanha|semana|agenda|pendente|pendentes|a vencer|pra voltar|pra vencer|vou avisar|vao vencer|vencendo)\b/;
const CLIENTE_LOOKUP_CONTEXT =
  /\b(dados|resumo|historico|info|informac(ao|oes)|ficha|status|ver|consultar|consulta|buscar|busca|procurar|quando|ultim[oa]|proximo lembrete)\b/;

// Extrai o nome/telefone alvo de uma consulta de cliente. Telefone (>= 8
// dígitos) tem prioridade; senão o texto após "cliente". Retorna null quando
// não dá pra identificar um alvo.
export function extractClienteTermo(message: string): string | null {
  const digits = message.match(/\+?\d[\d\s().-]{7,}\d/);
  if (digits) {
    const onlyDigits = digits[0].replace(/\D/g, "");
    if (onlyDigits.length >= 8) return onlyDigits;
  }
  // "cliente Joao", "cliente: Maria Silva", "do cliente Zé"
  const afterCliente = message.match(/\bcliente\s*:?\s+(.+)$/i);
  if (afterCliente) {
    const termo = afterCliente[1].trim().replace(/[?!.]+$/, "").trim();
    // Evita casar "cliente cadastrado", "cliente final", "clientes".
    if (termo.length >= 2 && !/^(cadastrad|final|novo|nova)/i.test(termo)) {
      return termo;
    }
  }
  return null;
}

export function classifyReadOnlyQuery(
  message: string,
): NonNullable<OnboardingAgentReply["readOnlyQuery"]> | null {
  const normalized = normalizeText(message);
  const mentionsReminder = REMINDER_WORD.test(normalized) || MESSAGE_WORD.test(normalized);

  // "quantos lembretes / quantas mensagens saíram esse mês"
  if (mentionsReminder && MONTH_WORD.test(normalized) && COUNT_WORD.test(normalized)) {
    return { kind: "consulta_lembretes", scope: "mes" };
  }
  // Próximos lembretes / quem vou avisar / agenda / quem tá pra voltar
  if (
    (REMINDER_WORD.test(normalized) && UPCOMING_HINT.test(normalized)) ||
    /\bquem\s+(vou|vamos|eu vou|voce vai)\s+(avisar|lembrar)\b/.test(normalized) ||
    /\bquem\s+(ta|esta)\s+pra\s+(voltar|trocar|vencer)\b/.test(normalized) ||
    /\bproxim[oa]s?\s+lembretes?\b/.test(normalized) ||
    /\bagenda\s+(de\s+)?(lembrete|troca)/.test(normalized)
  ) {
    return { kind: "consulta_lembretes", scope: "proximos" };
  }
  // Menção genérica a lembrete numa pergunta → assume próximos (a intenção
  // "quais lembretes?" é a mais comum).
  if (REMINDER_WORD.test(normalized) && isQuestionLike(message)) {
    return { kind: "consulta_lembretes", scope: "proximos" };
  }

  // Consulta de cliente: exige um alvo identificável. Com contexto de busca
  // explícito (dados/resumo/ver/quando...) aceita qualquer alvo; só com o "seco"
  // "cliente X", exige que X pareça nome próprio (maiúscula) ou telefone — assim
  // "cliente vai gostar disso" não vira consulta.
  const hasLookupContext = CLIENTE_LOOKUP_CONTEXT.test(normalized);
  if (hasLookupContext || /\bcliente\b/.test(normalized)) {
    const termo = extractClienteTermo(message);
    if (termo && (hasLookupContext || /^\+?\d/.test(termo) || /^[A-ZÀ-Ý]/.test(termo))) {
      return { kind: "consulta_cliente", termo };
    }
  }

  return null;
}

function readOnlyQueryReply(
  query: NonNullable<OnboardingAgentReply["readOnlyQuery"]>,
  message: string,
  context: ConversationContext,
): OnboardingAgentReply {
  return {
    // O body real é montado pelo webhook-handler com os dados LITERAIS. Este
    // texto é só a rede de segurança (ex.: sem contexto de oficina).
    body: "Deixa eu dar uma olhada nisso pra você...",
    context,
    registerServiceInput: null,
    nextAgentMode: null,
    readOnlyQuery: query,
    toolCalls: [
      {
        toolName: "operacao_read_only_query",
        input: { message },
        output: { ...query },
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
    hourSaoPaulo?: number;
    handoffComercial?: string | null;
    // Origem da mensagem. `audio` significa que `message` é transcrição: o
    // parser posicional por vírgula não pode rodar (QTR-35 P0-1).
    sourceMediaType?: InboundMediaType | null;
  }): Promise<OnboardingAgentReply> {
    if (isPromptInjectionAttempt(input.message)) {
      return blockedPromptInjectionReply(input.message);
    }

    // Rascunho completo aguardando o "sim" da oficina (ADR-0017). Tratado antes
    // do filtro de neutralidade pra não descartar um "ok"/"sim" como ruído.
    if (input.context.awaiting_confirmation && input.context.service_draft) {
      return this.handleConfirmation(input);
    }

    if (!input.context.missing_field && !hasRegistrationSignal(input.message)) {
      // CV6: consultas read-only (lembretes/cliente) só na operação — no
      // onboarding a oficina ainda está aprendendo a registrar. O webhook
      // resolve os dados escopados por oficina_id.
      if (input.mode === "operacao") {
        const query = classifyReadOnlyQuery(input.message);
        if (query) {
          return readOnlyQueryReply(query, input.message, input.context);
        }
      }
      return neutralReply(
        input.message,
        input.context,
        input.hourSaoPaulo,
        input.handoffComercial,
      );
    }

    const extracted =
      input.context.missing_field && input.context.service_draft
        ? applyFollowUp(input.context, input.message, input.today)
        : await this.extractDraft({
            message: input.message,
            today: input.today,
            fromSpeech: input.sourceMediaType === "audio",
          });

    // Guarda de sanidade: campo suspeito sai do rascunho e volta a ser
    // perguntado, em vez de ser confirmado e persistido (QTR-35 P0-1).
    const { draft, suspectFields } = pruneSuspectFields(extracted, input.today);
    const missingField = missingFieldForDraft(draft);

    if (missingField) {
      const previousChangedFields = input.context.service_draft_feedback?.changed_fields;
      const feedback = {
        changedFields: previousChangedFields,
        suspectFields,
      };
      const response = missingFieldReply(draft, missingField, feedback);
      return {
        ...response,
        toolCalls: suspectFields.length
          ? [
              {
                toolName: "extracao_suspeita",
                input: {
                  message: input.message,
                  source_media_type: input.sourceMediaType ?? "text",
                },
                output: {
                  campos_suspeitos: suspectFields,
                  descartados: suspectFields.map((field) => ({
                    campo: field,
                    valor: extracted[field] ?? null,
                  })),
                },
              },
            ]
          : [],
      };
    }

    // Todos os campos presentes: NÃO grava ainda. Mostra o resumo e espera a
    // oficina confirmar — é a rede de segurança que o ADR-0015 assumia mas que
    // não existia no fluxo (correção manual antes do template irreversível).
    return confirmationReply(draft, input.sourceMediaType, {
      changedFields: input.context.service_draft_feedback?.changed_fields,
    });
  }

  private async handleConfirmation(input: {
    message: string;
    mode: Extract<ConversationAgentMode, "onboarding" | "operacao">;
    context: ConversationContext;
    today: string;
    sourceMediaType?: InboundMediaType | null;
  }): Promise<OnboardingAgentReply> {
    const draft = input.context.service_draft as ServiceDraft;

    if (isAffirmativeConfirmation(input.message)) {
      // Revalida o card no instante do aceite. Contexto persistido pode ter
      // sido produzido antes de uma mudança de guarda; nenhum campo suspeito
      // pode atravessar esta última barreira até o RPC.
      const { draft: saneDraft, suspectFields } = pruneSuspectFields(
        draft,
        input.today,
      );
      const missingField = missingFieldForDraft(saneDraft);
      if (missingField) {
        return missingFieldReply(saneDraft, missingField, { suspectFields });
      }
      return {
        body: "",
        context: {},
        registerServiceInput: draftToRegisterInput(saneDraft),
        nextAgentMode: input.mode === "onboarding" ? "operacao" : null,
        toolCalls: [
          {
            toolName: "confirmou_cadastro",
            input: { message: input.message },
            output: { confirmed: true },
          },
        ],
      };
    }

    // QTR-35 P1-8: "corrigir"/"nao"/"errado" secos (inclusive o botão
    // "Corrigir" do card) entram no fluxo de correção sem gastar LLM.
    if (isCorrectionEntryMessage(input.message)) {
      return correctionPromptReply(draft, input.message, {
        changedFields: input.context.service_draft_feedback?.changed_fields,
        suspectFields: input.context.service_draft_feedback?.suspect_fields,
      });
    }

    // Não foi um "sim": tratamos como correção. Re-extrai apenas via OpenAI
    // (parser determinístico por vírgula é perigoso em respostas curtas tipo
    // "o carro e Gol") e mescla os campos informados sobre o rascunho.
    const correction = await this.extractCorrection(
      input.message,
      input.today,
      input.sourceMediaType === "audio",
    );
    // A correção passa pela mesma guarda de sanidade da extração: um "carro é
    // ele tem uma BMW" não pode entrar no rascunho por essa porta (QTR-35 P0-1).
    const prunedCorrectionResult = correction
      ? pruneSuspectFields(correction, input.today)
      : null;
    const prunedCorrection = prunedCorrectionResult?.draft ?? null;
    const merged = prunedCorrection
      ? mergeDraftCorrection(draft, prunedCorrection)
      : draft;

    const correctionFields: ServiceDraftField[] = [
      "nome_cliente",
      "whatsapp_cliente",
      "veiculo",
      "servico",
      "data_servico",
      "marca_peca",
    ];
    const changedFields = prunedCorrection
      ? correctionFields.filter(
          (field) =>
            prunedCorrection[field] !== undefined &&
            merged[field] !== draft[field],
        )
      : [];
    const changed = changedFields.length > 0;
    const suspectFields = prunedCorrectionResult?.suspectFields ?? [];

    if (!changed) {
      return correctionPromptReply(draft, input.message, { suspectFields });
    }

    const missingField = missingFieldForDraft(merged);
    if (suspectFields.length) {
      return correctionPromptReply(merged, input.message, {
        changedFields,
        suspectFields,
      });
    }
    if (missingField) {
      const fieldToAsk = missingField;
      const response = missingFieldReply(merged, fieldToAsk, {
        changedFields,
      });
      return {
        ...response,
        toolCalls: [
          {
            toolName: "confirmou_cadastro",
            input: { message: input.message },
            output: {
              confirmed: false,
              parsed: true,
              missing_field: fieldToAsk,
              campos_suspeitos: suspectFields,
            },
          },
        ],
      };
    }

    // Correção aplicada e rascunho ainda completo → reapresenta pra reconfirmar.
    return confirmationReply(merged, input.sourceMediaType, { changedFields });
  }

  private async extractCorrection(
    message: string,
    today: string,
    fromSpeech: boolean,
  ): Promise<ServiceDraft | null> {
    const ai = await this.extractWithOpenAI(message, { today, fromSpeech });
    if (ai) return ai;
    // Sem OpenAI (ou falha): tenta o parser determinístico só quando a mensagem
    // tem cara de cadastro completo reenviado (várias vírgulas / telefone), pra
    // não interpretar uma frase solta como nome/veículo errado. Nunca em fala.
    if (!fromSpeech && hasRegistrationSignal(message)) {
      return parseDeterministic(message, today);
    }
    return null;
  }

  // QTR-35 P0-1: o LLM é o extrator PRIMÁRIO. Antes o parser posicional rodava
  // primeiro e, quando os quatro campos "vinham preenchidos", retornava sem
  // nunca chamar o LLM. Transcrição de áudio é toda vírgula: o parser sempre
  // "tinha sucesso" e sempre curto-circuitava o LLM — exatamente no caso em que
  // ele era indispensável.
  private async extractDraft(input: {
    message: string;
    today: string;
    fromSpeech: boolean;
  }): Promise<ServiceDraft> {
    const { message, today, fromSpeech } = input;

    const ai = await this.extractWithOpenAI(message, { today, fromSpeech });

    // Fallback (sem OPENAI_API_KEY, erro de API, timeout): parser posicional,
    // e só em texto digitado — em fala natural o split por vírgula é ruído
    // ("Ó" viraria o nome do cliente). Em fala usamos apenas os campos
    // independentes de posição.
    const base = fromSpeech
      ? parseNonPositional(message, today)
      : parseDeterministic(message, today);

    const draft = mergeDrafts(base, ai);

    // Autoridade da data é determinística: `parseBrazilianDate` resolve "hoje",
    // "ontem", "quarta que vem" contra `today`; o LLM não tem como.
    const deterministicDate = extractDate(message, today).date;
    if (deterministicDate) draft.data_servico = deterministicDate;

    if (draft.servico && !draft.tipo_servico) {
      draft.tipo_servico = detectTipoServico(draft.servico);
    }

    return draft;
  }

  private async extractWithOpenAI(
    message: string,
    options: { today: string; fromSpeech: boolean },
  ): Promise<ServiceDraft | null> {
    if (!this.openai) return null;

    try {
      const response = await this.openai.responses.create({
        model: this.classifierModel,
        input: [
          {
            role: "system",
            content: extractionSystemPrompt(options),
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
