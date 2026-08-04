import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Link de indicacao do representante no site (estende ADR-0019).
//
// O representante compartilha `https://<site>/r/<CODIGO>`. A rota /r valida o
// codigo, registra o clique e grava este cookie. Quando o visitante clica em
// qualquer CTA da landing, o codigo entra no texto do wa.me como
// "#REP-<CODIGO>.<CLICK_TOKEN>" — dai em diante a atribuicao segue o caminho
// ja existente (extractRepresentanteCodigo -> upsertLead), sem motor novo.
//
// Invariante central (o que o dono pediu): dentro da janela, o lead e daquele
// representante. Um clique em link de OUTRO rep nao sobrescreve o cookie
// (first-touch sticky) — apenas registra o clique como nao atribuido.
export const INDICACAO_COOKIE = "qt_ref";
export const INDICACAO_JANELA_DIAS = 30;
export const INDICACAO_JANELA_SEGUNDOS = INDICACAO_JANELA_DIAS * 24 * 60 * 60;

// Mesmo formato aceito no cadastro (lib/admin/representantes.ts) — o codigo e
// publico, mas so entra no cookie depois de resolver para um rep ativo.
const CODIGO_REGEX = /^[A-Z0-9][A-Z0-9-]{1,29}$/;
const CLICK_TOKEN_REGEX = /^[A-Z0-9]{4,16}$/;
const CLICK_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I/O/0/1
const CLICK_TOKEN_LENGTH = 6;

export type Indicacao = {
  codigo: string;
  clickToken: string | null;
  /** Epoch em segundos do clique que originou a indicacao. */
  ts: number;
};

// Diferente da sessao do rep (que DEVE falhar sem segredo), aqui a ausencia do
// segredo NAO pode derrubar a landing publica: a indicacao simplesmente nao
// funciona naquele ambiente. `readIndicacao` roda em toda visita a home.
function getSecret(): string | null {
  const secret = process.env.REP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    console.error("indicacao_representante_sem_segredo: REP_SESSION_SECRET ausente ou curto");
    return null;
  }
  return secret;
}

export function normalizeCodigoIndicacao(value: string | null | undefined): string | null {
  if (!value) return null;
  const codigo = value.trim().toUpperCase();
  return CODIGO_REGEX.test(codigo) ? codigo : null;
}

export function gerarClickToken(): string {
  const bytes = randomBytes(CLICK_TOKEN_LENGTH);
  let token = "";
  for (const byte of bytes) {
    token += CLICK_TOKEN_ALPHABET[byte % CLICK_TOKEN_ALPHABET.length];
  }
  return token;
}

function assinar(payload: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// Cookie assinado (HMAC-SHA256) para que ninguem forje uma indicacao no
// navegador. O codigo em si e publico — a assinatura garante que o valor veio
// da nossa rota /r, que ja validou rep ativo e registrou o clique.
export function signIndicacaoValue(indicacao: Indicacao): string | null {
  const payload = [
    "v1",
    indicacao.codigo,
    indicacao.clickToken ?? "",
    String(indicacao.ts),
  ].join(":");
  const assinatura = assinar(payload);
  return assinatura ? `${payload}:${assinatura}` : null;
}

export function parseIndicacaoValue(
  value: string | null | undefined,
  options: { now?: Date } = {},
): Indicacao | null {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 5) return null;

  const [version, rawCodigo, rawToken, rawTs, signature] = parts;
  if (version !== "v1") return null;

  const payload = [version, rawCodigo, rawToken, rawTs].join(":");
  const expected = assinar(payload);
  if (!expected) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const codigo = normalizeCodigoIndicacao(rawCodigo);
  if (!codigo) return null;

  const ts = Number(rawTs);
  if (!Number.isFinite(ts) || ts <= 0) return null;

  // Janela: mesmo que o navegador devolva um cookie vencido, a assinatura
  // carrega o timestamp — a validade nao depende so do Max-Age.
  const nowSeconds = Math.floor((options.now?.getTime() ?? Date.now()) / 1000);
  if (nowSeconds - ts > INDICACAO_JANELA_SEGUNDOS) return null;

  const clickToken = CLICK_TOKEN_REGEX.test(rawToken) ? rawToken : null;
  return { codigo, clickToken, ts };
}

/** Sufixo que vai no texto do wa.me e e lido por extractRepresentanteCodigo. */
export function formatRepSufixo(indicacao: Pick<Indicacao, "codigo" | "clickToken">): string {
  return indicacao.clickToken
    ? `#REP-${indicacao.codigo}.${indicacao.clickToken}`
    : `#REP-${indicacao.codigo}`;
}

export async function readIndicacao(options: { now?: Date } = {}): Promise<Indicacao | null> {
  const store = await cookies();
  return parseIndicacaoValue(store.get(INDICACAO_COOKIE)?.value, options);
}

export async function setIndicacaoCookie(indicacao: Indicacao): Promise<void> {
  const value = signIndicacaoValue(indicacao);
  // Sem segredo no ambiente, o clique fica registrado mas nao vira indicacao —
  // melhor perder a atribuicao do que quebrar a navegacao do visitante.
  if (!value) return;
  const store = await cookies();
  store.set(INDICACAO_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INDICACAO_JANELA_SEGUNDOS,
  });
}
