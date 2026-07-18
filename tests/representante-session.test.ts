import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A sessao importa `next/headers` (cookies) no topo. Mockamos para permitir
// importar sign/verify sem um contexto de request — os testes so exercitam a
// assinatura/verificacao do JWT, nunca o cookie.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

import { SignJWT } from "jose";

import {
  signRepresentanteSession,
  verifyRepresentanteSession,
} from "@/lib/representante/session";

const REP_SECRET = "rep-session-secret-min-32-chars-aaaaaa";
const ORIGINAL_SECRET = process.env.REP_SESSION_SECRET;

describe("representante session", () => {
  beforeEach(() => {
    process.env.REP_SESSION_SECRET = REP_SECRET;
  });

  afterEach(() => {
    process.env.REP_SESSION_SECRET = ORIGINAL_SECRET;
  });

  it("sign -> verify roundtrip preserves claims", async () => {
    const token = await signRepresentanteSession({
      representanteId: "rep-1",
      whatsapp: "+5511999990000",
      codigo: "CARLOS-SP",
    });
    const claims = await verifyRepresentanteSession(token);
    expect(claims).toEqual({
      representanteId: "rep-1",
      whatsapp: "+5511999990000",
      codigo: "CARLOS-SP",
      isRepresentante: true,
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signRepresentanteSession({
      representanteId: "rep-1",
      whatsapp: "+5511999990000",
      codigo: "CARLOS-SP",
    });
    process.env.REP_SESSION_SECRET = "another-secret-min-32-chars-bbbbbbbb";
    expect(await verifyRepresentanteSession(token)).toBeNull();
  });

  it("rejects an admin-style token (issuer/audience isolation)", async () => {
    // Token com o MESMO secret mas issuer/audience do admin nao deve validar
    // como sessao de rep — garante o isolamento entre os dois publicos.
    const now = Math.floor(Date.now() / 1000);
    const adminLike = await new SignJWT({
      adminId: "admin-1",
      whatsapp: "+5511999990000",
      isAdmin: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("quando-trocar-admin")
      .setAudience("quando-trocar-admin")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(REP_SECRET));
    expect(await verifyRepresentanteSession(adminLike)).toBeNull();
  });

  it("rejects a token missing the isRepresentante claim", async () => {
    const now = Math.floor(Date.now() / 1000);
    const noClaim = await new SignJWT({
      representanteId: "rep-1",
      whatsapp: "+5511999990000",
      codigo: "CARLOS-SP",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("quando-trocar-representante")
      .setAudience("quando-trocar-representante")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(new TextEncoder().encode(REP_SECRET));
    expect(await verifyRepresentanteSession(noClaim)).toBeNull();
  });
});
