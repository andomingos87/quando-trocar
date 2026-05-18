import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_SESSION_COOKIE = "qt_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const ADMIN_SESSION_ISSUER = "quando-trocar-admin";
const ADMIN_SESSION_AUDIENCE = "quando-trocar-admin";

export type AdminSessionClaims = {
  adminId: string;
  whatsapp: string;
  isAdmin: true;
};

function getSessionSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET must be defined and at least 32 characters",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminSession(claims: {
  adminId: string;
  whatsapp: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    adminId: claims.adminId,
    whatsapp: claims.whatsapp,
    isAdmin: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ADMIN_SESSION_ISSUER)
    .setAudience(ADMIN_SESSION_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ADMIN_SESSION_TTL_SECONDS)
    .sign(getSessionSecret());
}

export async function verifyAdminSession(
  token: string,
): Promise<AdminSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
    });
    if (
      typeof payload.adminId !== "string" ||
      typeof payload.whatsapp !== "string" ||
      payload.isAdmin !== true
    ) {
      return null;
    }
    return {
      adminId: payload.adminId,
      whatsapp: payload.whatsapp,
      isAdmin: true,
    };
  } catch {
    return null;
  }
}

// Path="/" e nao "/admin": precisamos que o cookie seja enviado tanto para
// /admin/* (paginas) quanto para /api/admin/* (route handlers de logout, etc).
// A separacao da sessao da oficina e garantida pelo NOME distinto do cookie
// (qt_admin_session) e pelo claim isAdmin no JWT, conforme ADR-0013.
export async function setAdminSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminFromCookie(): Promise<AdminSessionClaims | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSession(token);
}

export async function requireAdmin(): Promise<AdminSessionClaims> {
  const admin = await getAdminFromCookie();
  if (!admin) {
    redirect("/admin/entrar");
  }
  return admin;
}
