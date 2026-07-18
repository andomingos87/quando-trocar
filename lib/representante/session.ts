import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Sessao do portal do representante (ADR-0025). ISOLADA do admin: cookie e
// secret proprios, claim `isRepresentante`. Um cookie de admin nunca acessa
// `/representante` e vice-versa. TTL 14 dias (rep e externo — menor que os 30 d
// do admin).
export const REP_SESSION_COOKIE = "qt_rep_session";
const REP_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const REP_SESSION_ISSUER = "quando-trocar-representante";
const REP_SESSION_AUDIENCE = "quando-trocar-representante";

export type RepresentanteSessionClaims = {
  representanteId: string;
  whatsapp: string;
  codigo: string;
  isRepresentante: true;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.REP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "REP_SESSION_SECRET must be defined and at least 32 characters",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signRepresentanteSession(claims: {
  representanteId: string;
  whatsapp: string;
  codigo: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    representanteId: claims.representanteId,
    whatsapp: claims.whatsapp,
    codigo: claims.codigo,
    isRepresentante: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(REP_SESSION_ISSUER)
    .setAudience(REP_SESSION_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + REP_SESSION_TTL_SECONDS)
    .sign(getSessionSecret());
}

export async function verifyRepresentanteSession(
  token: string,
): Promise<RepresentanteSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      issuer: REP_SESSION_ISSUER,
      audience: REP_SESSION_AUDIENCE,
    });
    if (
      typeof payload.representanteId !== "string" ||
      typeof payload.whatsapp !== "string" ||
      typeof payload.codigo !== "string" ||
      payload.isRepresentante !== true
    ) {
      return null;
    }
    return {
      representanteId: payload.representanteId,
      whatsapp: payload.whatsapp,
      codigo: payload.codigo,
      isRepresentante: true,
    };
  } catch {
    return null;
  }
}

// Path="/" para o cookie chegar tanto em /representante/* (paginas) quanto em
// /api/representante/* (route handlers). O nome distinto (qt_rep_session) e o
// claim isRepresentante isolam da sessao de admin/oficina (ADR-0025).
export async function setRepresentanteSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(REP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REP_SESSION_TTL_SECONDS,
  });
}

export async function clearRepresentanteSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(REP_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getRepresentanteFromCookie(): Promise<RepresentanteSessionClaims | null> {
  const store = await cookies();
  const token = store.get(REP_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyRepresentanteSession(token);
}
