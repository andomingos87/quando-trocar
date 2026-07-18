import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A rota chama setAdminSessionCookie -> cookies() de next/headers. Mockamos para
// um store em memoria e contamos os set() para provar quantas sessoes de admin
// foram efetivamente emitidas.
const cookieState = vi.hoisted(() => ({ sets: 0 }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {
      cookieState.sets += 1;
    },
  }),
}));

// A rota instancia o client via createSupabaseAdminClient(); injetamos um stub
// por teste atraves deste holder.
const supabaseHolder = vi.hoisted(
  () => ({ client: null as unknown }),
);
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => supabaseHolder.client,
}));

import { POST } from "@/app/api/admin/auth/verify-otp/route";
import { hashOtpCode, otpExpiresAt } from "@/lib/admin/otp";

const ORIGINAL_SECRET = process.env.ADMIN_SESSION_SECRET;
const SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
const WHATSAPP = "+5541999990000";
const CODE = "123456";

type Result = { data: unknown; error: unknown };

// Encadeamento de leitura (select ... maybeSingle): todos os metodos de filtro
// retornam o proprio no e maybeSingle() resolve o resultado configurado.
function selectChain(result: Result) {
  const node: Record<string, unknown> = {};
  node.select = () => node;
  node.eq = () => node;
  node.is = () => node;
  node.order = () => node;
  node.limit = () => node;
  node.maybeSingle = async () => result;
  return node;
}

// Stub minimo do supabase para o verify-otp do admin. `consume` e chamado a cada
// consumo atomico do OTP (.update().eq().is().select().maybeSingle()) e decide
// se aquela requisicao venceu a corrida (data != null) ou perdeu (data == null).
function makeSupabase(opts: {
  admin: Record<string, unknown> | null;
  otp: Record<string, unknown> | null;
  consume: () => Result;
}) {
  const auditInserts: unknown[] = [];
  const client = {
    auditInserts,
    from(table: string) {
      if (table === "admin_users") {
        return {
          select: () => selectChain({ data: opts.admin, error: null }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === "auth_otps") {
        return {
          select: () => selectChain({ data: opts.otp, error: null }),
          update: () => ({
            eq: () => ({
              // Caminho do consumo atomico (codigo correto).
              is: () => ({
                select: () => ({ maybeSingle: async () => opts.consume() }),
              }),
              // Caminho de codigo errado: .eq() aguardado direto.
              then: (resolve: (r: Result) => void) =>
                resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "admin_audit_log") {
        return {
          insert: async (row: unknown) => {
            auditInserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return client;
}

function makeRequest() {
  return new Request("https://example.com/api/admin/auth/verify-otp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ whatsapp: WHATSAPP, code: CODE }),
  });
}

describe("admin verify-otp — corrida de consumo do OTP", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = SECRET;
    cookieState.sets = 0;
  });

  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET = ORIGINAL_SECRET;
    supabaseHolder.client = null;
  });

  it("duas requisicoes simultaneas com o codigo certo emitem UMA unica sessao", async () => {
    const admin = { id: "admin-1", whatsapp: WHATSAPP, ativo: true };
    const otp = {
      id: "otp-1",
      code_hash: hashOtpCode(CODE),
      attempts: 0,
      used_at: null,
      expires_at: otpExpiresAt().toISOString(),
    };

    // Apenas o primeiro consumo acerta uma linha; os seguintes perdem a corrida
    // (used_at ja nao e mais null), simulando o UPDATE condicional do Postgres.
    let consumes = 0;
    const consume = (): Result => {
      consumes += 1;
      return consumes === 1
        ? { data: { id: "otp-1" }, error: null }
        : { data: null, error: null };
    };

    const supabase = makeSupabase({ admin, otp, consume });
    supabaseHolder.client = supabase;

    const [resA, resB] = await Promise.all([
      POST(makeRequest()),
      POST(makeRequest()),
    ]);

    const bodies = [await resA.json(), await resB.json()];
    const oks = bodies.filter((b) => b.ok === true);
    const fails = bodies.filter((b) => b.ok === false);

    expect(oks).toHaveLength(1);
    expect(fails).toHaveLength(1);
    expect(fails[0].message).toBe("Codigo invalido ou expirado.");

    // Um 200 (vencedor) e um 400 (perdedor).
    expect([resA.status, resB.status].sort()).toEqual([200, 400]);

    // So a corrida vencedora assina cookie e grava auditoria de login.
    expect(cookieState.sets).toBe(1);
    expect(supabase.auditInserts).toHaveLength(1);
  });

  it("codigo correto sem corrida segue o caminho feliz (200 + sessao + audit)", async () => {
    const admin = { id: "admin-1", whatsapp: WHATSAPP, ativo: true };
    const otp = {
      id: "otp-1",
      code_hash: hashOtpCode(CODE),
      attempts: 0,
      used_at: null,
      expires_at: otpExpiresAt().toISOString(),
    };

    const supabase = makeSupabase({
      admin,
      otp,
      consume: () => ({ data: { id: "otp-1" }, error: null }),
    });
    supabaseHolder.client = supabase;

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(cookieState.sets).toBe(1);
    expect(supabase.auditInserts).toHaveLength(1);
  });
});
