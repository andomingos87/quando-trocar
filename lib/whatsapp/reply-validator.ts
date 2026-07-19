import type { ReplyValidationResult } from "./types";

// Validador deterministico de saida da camada de geracao conversacional
// (ADR-0020, invariante 2 — poder de veto). Funcoes puras, sem dependencias:
// recebem a string gerada + o contexto permitido e devolvem ok/reason.
// Regra de ouro: reprovado -> o caller envia a enlatada. Em caso de duvida,
// preferimos reprovar (fail-safe): o pior cenario e o bot atual.

const DEFAULT_MAX_LENGTH = 800;

// Remove acentos e baixa a caixa — usado nas deteccoes textuais.
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// 1. Preco (ADR-0012): o bot so pode citar `precoPartida`. Qualquer outro
//    valor monetario reprova. Cobre "R$ 199", "R$199,90", "59 reais",
//    "R$ 1.200,00". Igualdade e feita sobre a parte inteira em reais (o preco
//    de partida e um inteiro de reais; centavos citados ja sao suspeitos).
// ---------------------------------------------------------------------------
// Converte um numero-token pt-BR em Number distinguindo separador de milhar de
// separador decimal. Era o bug de corretude do bloqueio: o strip incondicional
// de pontos (`replace(/\./g, "")`) fazia "R$ 5.9" virar 59 e ser aprovado como
// o preco de partida.
function parseMonetaryToken(raw: string): number {
  if (raw.includes(",")) {
    // Forma canonica pt-BR: ponto = milhar, virgula = decimal.
    return Number(raw.replace(/\./g, "").replace(",", "."));
  }
  // So digitos e pontos. Ponto seguido de grupos de exatamente 3 digitos e
  // separador de milhar ("1.200", "5.900"); qualquer outro uso do ponto e
  // decimal ("5.9", "59.90").
  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    return Number(raw.replace(/\./g, ""));
  }
  return Number(raw);
}

function extractMonetaryValues(text: string): number[] {
  const values: number[] = [];
  // "R$ 199", "R$199,90", "R$ 1.200,00"
  const rsRegex = /r\$\s*([\d.]+(?:,\d{1,2})?)/gi;
  // "59 reais", "1200 reais", "59,90 reais"
  const reaisRegex = /(\d[\d.]*(?:,\d{1,2})?)\s*reais/gi;

  for (const regex of [rsRegex, reaisRegex]) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // NaN (token malformado, ex.: "1.2.3") entra de proposito — checkPrice
      // reprova em NaN (fail-safe).
      values.push(parseMonetaryToken(match[1]));
    }
  }
  return values;
}

// Numeros por extenso (pt-BR, ja sem acento apos `normalize`) colados a uma
// ancora monetaria. Fecha o bloqueio de seguranca "preco escrito por extenso
// passa": "custa cento e noventa reais" nao tem digito, entao escapava do
// extrator numerico. Fail-safe: qualquer valor-por-extenso reprova (a enlatada
// usa digitos; reescrita que soletra preco cai na enlatada).
const NUMBER_WORDS = [
  "zero", "um", "uma", "dois", "duas", "tres", "quatro", "cinco", "seis",
  "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze",
  "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
  "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
  "oitenta", "noventa", "cem", "cento", "duzentos", "duzentas", "trezentos",
  "trezentas", "quatrocentos", "quatrocentas", "quinhentos", "quinhentas",
  "seiscentos", "seiscentas", "setecentos", "setecentas", "oitocentos",
  "oitocentas", "novecentos", "novecentas", "mil", "milhao", "milhoes",
  "bilhao", "bilhoes",
].join("|");
// numero(s) por extenso -> conectores/numeros -> ancora monetaria. Exige a
// ancora colada a cadeia de numeros, entao "um cliente real" nao dispara.
const SPELLED_PRICE_REGEX = new RegExp(
  `\\b(?:${NUMBER_WORDS})(?:\\s+(?:e|de|do|da|${NUMBER_WORDS}))*` +
    `\\s+(?:reais|real|conto|contos|pila|pilas|mango|mangos)\\b`,
);

function hasSpelledOutPrice(generated: string): boolean {
  return SPELLED_PRICE_REGEX.test(normalize(generated));
}

function checkPrice(generated: string, precoPartida: number): ReplyValidationResult {
  for (const value of extractMonetaryValues(generated)) {
    // So o preco de partida exato pode aparecer. Qualquer outro valor
    // monetario (preco inventado, negociado, com centavos, ou token malformado
    // => NaN) reprova (ADR-0012).
    if (Number.isNaN(value) || value !== precoPartida) {
      return { ok: false, reason: "preco_invalido" };
    }
  }
  // Preco escrito por extenso (sem digito) tambem reprova.
  if (hasSpelledOutPrice(generated)) {
    return { ok: false, reason: "preco_invalido" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 2. Promessa / agenda (ADR-0009): garantia de resultado, percentual fora de
//    framing de tendencia, ou marcacao de horario/data de atendimento.
// ---------------------------------------------------------------------------
const PROMISE_PATTERNS: RegExp[] = [
  // Garantia explicita de resultado.
  /\bgarant(o|e|ir|ido|ia|imos)\b/,
  /\bprometo\b/,
  /\bcom certeza (vai|voce vai|seu cliente)\b/,
  // Percentual de retorno prometido (ex.: "30% de retorno", "20% a mais de
  // clientes"). O framing de tendencia ("em media", "costuma", "ate") e mais
  // permissivo, mas garantia dura de % reprova.
  /\d+\s*%\s*(de\s*)?(retorno|lucro|clientes|vendas|a mais|garantid)/,
  /\bvai\s+recuperar\s+\d+/,
];

const AGENDA_PATTERNS: RegExp[] = [
  // Horario de atendimento: "as 14h", "as 9 horas", "14:30".
  /\bas\s*\d{1,2}\s*(h|horas|:\d{2})\b/,
  /\bagendado?\s+para\b/,
  /\bte\s+encaixo\b/,
  /\bmarco\s+(pra|para|voce|seu)\b/,
  /\bmarcado?\s+(pra|para)\s+(amanha|hoje|segunda|terca|quarta|quinta|sexta|sabado|domingo|dia\s*\d)/,
  /\bamanha\s+as\b/,
  /\bhoje\s+as\b/,
  /\b(segunda|terca|quarta|quinta|sexta|sabado|domingo)\s+as\s*\d/,
];

function checkPromiseOrAgenda(generated: string): ReplyValidationResult {
  const normalized = normalize(generated);
  for (const pattern of [...PROMISE_PATTERNS, ...AGENDA_PATTERNS]) {
    if (pattern.test(normalized)) {
      return { ok: false, reason: "promessa_ou_agenda" };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 3. Links: qualquer URL / wa.me fora da allowlist reprova. Comparamos por
//    host+path normalizados; querystring e ignorada (o texto do wa.me varia).
//
//    Bloqueio de seguranca "link com caractere Unicode burla a allowlist": um
//    link com ponto/barra Unicode (ex.: "evil。com", U+3002) nao era reconhecido
//    pela regex ASCII e passava SEM checagem. `normalizeForLinks` colapsa esses
//    confusaveis para ASCII (NFKC + mapa explicito para o que o NFKC nao cobre)
//    e remove caracteres de largura zero antes da extracao. Alem disso, um host
//    com letra non-ASCII (homoglifo, ex.: "е" cirilico) seguido de TLD comum e
//    reprovado direto — nenhum dominio da allowlist e non-ASCII.
// ---------------------------------------------------------------------------
const ZERO_WIDTH_CHARS = /[​‌‍⁠﻿]/g;
// Pontos que clientes de chat costumam tratar como separador de dominio.
const CONFUSABLE_DOTS = /[。｡．․﹒]/g;
// Barras confusaveis.
const CONFUSABLE_SLASHES = /[⁄∕／]/g;

function normalizeForLinks(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ZERO_WIDTH_CHARS, "")
    .replace(CONFUSABLE_DOTS, ".")
    .replace(CONFUSABLE_SLASHES, "/");
}

const COMMON_TLDS =
  "com|net|org|br|io|me|app|xyz|info|link|site|online|shop|store|co|dev|gov|edu";
// Host com ao menos uma letra non-ASCII seguido de um TLD comum. A extracao
// ASCII abaixo nao reconhece o host inteiro nesses casos; aqui reprovamos direto.
const HOMOGLYPH_HOST_REGEX = new RegExp(
  `(?:https?:\\/\\/)?[^\\s]*[^\\x00-\\x7F][^\\s]*\\.(?:${COMMON_TLDS})\\b`,
  "i",
);

function extractLinks(text: string): string[] {
  const links: string[] = [];
  // URLs http(s) e formas curtas de dominio comum (wa.me/..., bit.ly/...).
  const urlRegex =
    /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    links.push(match[1]);
  }
  return links;
}

// Reduz uma URL a "host/path" minusculo sem protocolo, sem querystring, sem
// barra final — para comparar link gerado x allowlist de forma estavel.
function canonicalLink(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.split("?")[0];
  value = value.split("#")[0];
  value = value.replace(/\/+$/, "");
  return value;
}

function checkLinks(generated: string, allowedLinks: string[]): ReplyValidationResult {
  const normalized = normalizeForLinks(generated);
  // Host com homoglifo (letra non-ASCII) + TLD comum = evasao.
  if (HOMOGLYPH_HOST_REGEX.test(normalized)) {
    return { ok: false, reason: "link_nao_permitido" };
  }
  const allowed = new Set(allowedLinks.map(canonicalLink));
  for (const link of extractLinks(normalized)) {
    const canonical = canonicalLink(link);
    // Ignora "dominios" que sao na verdade nomes de arquivo/abreviacoes sem
    // TLD real ja filtradas pela regex; aqui todo match tem TLD.
    if (!allowed.has(canonical)) {
      return { ok: false, reason: "link_nao_permitido" };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 4. Cross-tenant: nomes de oficina/cliente presentes no texto que NAO estao
//    na allowlist de nomes permitidos (contexto resolvido) reprovam.
//
//    LIMITACAO CONHECIDA (documentada de proposito): detectar "nome de oficina
//    de outro tenant" em texto livre e ambiguo — qualquer palavra capitalizada
//    poderia ser um nome. Uma heuristica agressiva (reprovar toda palavra
//    capitalizada fora da allowlist) geraria falso positivo em texto generico
//    ("Voce", "Ola", inicio de frase, "WhatsApp", "R$"). Por isso a checagem e
//    CONSERVADORA: so reprova quando o texto contem o gatilho explicito
//    "oficina <Nome>" / "loja <Nome>" e esse <Nome> nao esta na allowlist.
//    O grosso da protecao cross-tenant vem do grounding (o gerador so recebe o
//    contexto do proprio tenant) + do fato de o esqueleto ja vir pronto; o
//    validador aqui e a ultima barreira para o caso obvio.
// ---------------------------------------------------------------------------
function checkCrossTenant(
  generated: string,
  allowedNames: string[],
): ReplyValidationResult {
  const allowed = allowedNames
    .map((n) => normalize(n).trim())
    .filter((n) => n.length > 0);

  // Captura o gatilho ("oficina"/"loja"/...) seguido de uma sequencia de ate 4
  // tokens que sejam OU conectores pt-BR (do/da/de/dos/das/e) OU palavras
  // iniciadas em maiuscula (nome proprio). Isso reconhece "Oficina do Ze" sem
  // disparar em "oficina recupera clientes" (o token seguinte, minusculo e nao
  // conector, encerra a captura antes de exigir o {1,4}).
  // Gatilho case-insensitive (primeira letra maiuscula ou minuscula) mantendo o
  // trailing case-SENSITIVE — precisamos da maiuscula para detectar nome proprio.
  const phraseRegex =
    /\b([Oo]ficina|[Ll]oja|[Mm]ecanica|[Aa]utopecas|[Aa]uto [Pp]ecas)((?:\s+(?:do|da|de|dos|das|e|[A-ZÀ-Ý][\wÀ-ÿ'-]*)){1,4})/g;

  let match: RegExpExecArray | null;
  while ((match = phraseRegex.exec(generated)) !== null) {
    const trailing = match[2];
    // So e nome proprio se houver ao menos uma palavra capitalizada no trecho.
    if (!/[A-ZÀ-Ý]/.test(trailing)) continue;
    const candidate = normalize(`${match[1]}${trailing}`)
      .replace(/\s+/g, " ")
      .trim();
    // Aprova se o candidato coincide com (ou esta contido em / contem) algum
    // nome permitido — tolera "Oficina do Ze" quando a allowlist tem so "Ze".
    const isAllowed = allowed.some(
      (name) => name.includes(candidate) || candidate.includes(name),
    );
    if (!isAllowed) {
      return { ok: false, reason: "cross_tenant" };
    }
  }
  return { ok: true };
}

// Regra extra do público cliente final (CV8, ADR-0026): a resposta gerada tem
// que conter a ponte wa.me da oficina (um link da allowlist). Garante que a
// naturalização nunca "engole" o caminho pra oficina — o valor do concierge.
function checkHandoffLinkPresent(
  generated: string,
  allowedLinks: string[],
): ReplyValidationResult {
  const normalized = normalizeForLinks(generated);
  const present = new Set(extractLinks(normalized).map(canonicalLink));
  const hasAllowed = allowedLinks
    .map(canonicalLink)
    .some((allowed) => allowed.length > 0 && present.has(allowed));
  return hasAllowed ? { ok: true } : { ok: false, reason: "sem_ponte_oficina" };
}

export function validateGeneratedReply(input: {
  generated: string;
  precoPartida: number;
  allowedLinks: string[];
  allowedNames: string[];
  maxLength?: number;
  // CV8: exige a presença da ponte wa.me da oficina (concierge do cliente final).
  requireHandoffLink?: boolean;
}): ReplyValidationResult {
  const generated = input.generated ?? "";
  const maxLength = input.maxLength ?? DEFAULT_MAX_LENGTH;

  // 0. Vazio / branco: nao pode virar resposta.
  if (generated.trim().length === 0) {
    return { ok: false, reason: "vazio" };
  }

  // 5. Tamanho (checado cedo — barato).
  if (generated.length > maxLength) {
    return { ok: false, reason: "muito_longo" };
  }

  const price = checkPrice(generated, input.precoPartida);
  if (!price.ok) return price;

  const promise = checkPromiseOrAgenda(generated);
  if (!promise.ok) return promise;

  const links = checkLinks(generated, input.allowedLinks);
  if (!links.ok) return links;

  const crossTenant = checkCrossTenant(generated, input.allowedNames);
  if (!crossTenant.ok) return crossTenant;

  if (input.requireHandoffLink) {
    const bridge = checkHandoffLinkPresent(generated, input.allowedLinks);
    if (!bridge.ok) return bridge;
  }

  return { ok: true };
}
