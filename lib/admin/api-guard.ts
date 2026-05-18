import "server-only";

import { NextResponse } from "next/server";

import { type AdminSessionClaims, getAdminFromCookie } from "./session";

export type RequireAdminResult =
  | { ok: true; admin: AdminSessionClaims }
  | { ok: false; response: NextResponse };

// Helper para route handlers: garante que ha sessao admin ativa.
// Diferente de requireAdmin() (server component), aqui retornamos uma
// NextResponse 401 em vez de redirecionar — chamador devolve direto.
export async function requireAdminApi(): Promise<RequireAdminResult> {
  const admin = await getAdminFromCookie();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "Nao autenticado." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, admin };
}
