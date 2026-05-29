import { describe, expect, it, vi } from "vitest";

import { patchOficina, validateOficinaCreate } from "@/lib/admin/oficinas";

const validBase = {
  nome: "Oficina X",
  whatsapp: "+5511999999999",
  cidade: "Sao Paulo",
  plano_id: "00000000-0000-0000-0000-000000000000",
};

describe("validateOficinaCreate", () => {
  it("normalizes whatsapp", () => {
    const result = validateOficinaCreate({ ...validBase, whatsapp: "11999999999" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.whatsapp).toBe("+5511999999999");
  });

  it("rejects empty nome", () => {
    const result = validateOficinaCreate({ ...validBase, nome: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("nome");
  });

  it("rejects invalid whatsapp", () => {
    const result = validateOficinaCreate({ ...validBase, whatsapp: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("whatsapp");
  });

  it("rejects missing plano_id", () => {
    const result = validateOficinaCreate({ ...validBase, plano_id: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("plano_id");
  });

  it("rejects invalid status", () => {
    const result = validateOficinaCreate({
      ...validBase,
      status: "cancelada" as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("status");
  });

  it("defaults status to ativa and preco_negociado to null", () => {
    const result = validateOficinaCreate(validBase);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("ativa");
      expect(result.data.preco_negociado).toBe(null);
    }
  });
});

// ---------------------------------------------------------------------------
// patchOficina — edicao de cadastro (stubs minimos)
// ---------------------------------------------------------------------------

const OFICINA_ID = "11111111-1111-1111-1111-111111111111";

function makeOficinaSupabase(opts: {
  row: Record<string, unknown>;
  whatsappConflict?: Array<{ id: string }>;
}) {
  const { row, whatsappConflict = [] } = opts;
  const updateEq = vi.fn(async () => ({ error: null }));

  const oficinasChain = () => {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: row, error: null })),
      update: vi.fn(() => ({ eq: updateEq })),
      // thenable: resolves the whatsapp-uniqueness query result
      then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
        resolve({ data: whatsappConflict, error: null }),
    };
    return chain;
  };

  const mensagensChain = {
    select: () => ({
      eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
    }),
  };

  return {
    _updateEq: updateEq,
    from: vi.fn((table: string) => {
      if (table === "oficinas") return oficinasChain();
      if (table === "mensagens") return mensagensChain;
      if (table === "admin_audit_log") return { insert: vi.fn(async () => ({ error: null })) };
      throw new Error(`unexpected table ${table}`);
    }),
  } as never;
}

const baseRow = {
  id: OFICINA_ID,
  nome: "Oficina X",
  responsavel: null,
  whatsapp_principal: "+5511999999999",
  cidade: "Sao Paulo",
  status: "ativa",
  origem: "manual",
  motivo_pausa: null,
  plano_id: null,
  preco_negociado: null,
  proximo_vencimento: null,
  created_at: "2026-01-01T00:00:00Z",
  planos: null,
};

describe("patchOficina — edicao de cadastro", () => {
  it("rejeita nome vazio com 400", async () => {
    const supabase = makeOficinaSupabase({ row: baseRow });
    await expect(
      patchOficina(supabase, OFICINA_ID, { nome: "   " }, { adminId: "a", ip: null }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejeita whatsapp ja em uso por outra oficina com 409", async () => {
    const supabase = makeOficinaSupabase({
      row: baseRow,
      whatsappConflict: [{ id: "22222222-2222-2222-2222-222222222222" }],
    });
    await expect(
      patchOficina(
        supabase,
        OFICINA_ID,
        { whatsapp: "11888888888" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("nao grava quando cadastro nao muda (no-op)", async () => {
    const supabase = makeOficinaSupabase({ row: baseRow });
    const result = await patchOficina(
      supabase,
      OFICINA_ID,
      { nome: "Oficina X", cidade: "Sao Paulo", responsavel: null },
      { adminId: "a", ip: null },
    );
    expect(result.actions).toEqual([]);
    expect((supabase as unknown as { _updateEq: { mock: { calls: unknown[] } } })._updateEq.mock.calls.length).toBe(0);
  });
});
