import { describe, expect, it, vi } from "vitest";

import {
  patchOficina,
  softDeleteOficina,
  validateOficinaCreate,
} from "@/lib/admin/oficinas";

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

describe("validateOficinaCreate — cadastro/fiscal", () => {
  it("normaliza cpf_cnpj valido para digitos", () => {
    const r = validateOficinaCreate({ ...validBase, cpf_cnpj: "529.982.247-25" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.cpf_cnpj).toBe("52998224725");
  });

  it("rejeita cpf_cnpj invalido", () => {
    const r = validateOficinaCreate({ ...validBase, cpf_cnpj: "111.111.111-11" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("cpf_cnpj");
  });

  it("rejeita email invalido", () => {
    const r = validateOficinaCreate({ ...validBase, email: "x@y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("email");
  });

  it("rejeita UF invalida", () => {
    const r = validateOficinaCreate({ ...validBase, estado: "XX" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("estado");
  });

  it("normaliza cep (digitos) e uf (maiuscula)", () => {
    const r = validateOficinaCreate({ ...validBase, cep: "01001-000", estado: "sp" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.cep).toBe("01001000");
      expect(r.data.estado).toBe("SP");
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
  const update = vi.fn(() => updateChain);
  // update().eq().is() — thenable resolving to { error: null }
  const updateChain: Record<string, unknown> = {
    eq: vi.fn(() => updateChain),
    is: vi.fn(() => updateChain),
    then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
  };

  const oficinasChain = () => {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data: row, error: null })),
      update,
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
    _update: update,
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
    expect((supabase as unknown as { _update: { mock: { calls: unknown[] } } })._update.mock.calls.length).toBe(0);
  });

  it("rejeita cpf_cnpj invalido com 400", async () => {
    const supabase = makeOficinaSupabase({ row: baseRow });
    await expect(
      patchOficina(supabase, OFICINA_ID, { cpf_cnpj: "123" }, { adminId: "a", ip: null }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("grava cpf_cnpj normalizado e audita oficina.update_fiscal", async () => {
    const supabase = makeOficinaSupabase({ row: baseRow });
    const result = await patchOficina(
      supabase,
      OFICINA_ID,
      { cpf_cnpj: "529.982.247-25" },
      { adminId: "a", ip: null },
    );
    expect(result.actions).toContain("oficina.update_fiscal");
    const update = (supabase as unknown as { _update: { mock: { calls: unknown[][] } } })._update;
    expect(update.mock.calls[0][0]).toMatchObject({ cpf_cnpj: "52998224725" });
  });

  it("rejeita janela de envio invertida (fim <= inicio) com 400", async () => {
    const supabase = makeOficinaSupabase({ row: baseRow });
    await expect(
      patchOficina(
        supabase,
        OFICINA_ID,
        { horario_envio_inicio: "18:00", horario_envio_fim: "08:00" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("softDeleteOficina", () => {
  it("rejeita quando o nome de confirmacao nao bate (400)", async () => {
    const supabase = makeOficinaSupabase({ row: baseRow });
    await expect(
      softDeleteOficina(
        supabase,
        OFICINA_ID,
        { confirmationName: "Nome Errado" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect((supabase as unknown as { _update: { mock: { calls: unknown[] } } })._update.mock.calls.length).toBe(0);
  });

  it("rejeita oficina inexistente/ja excluida (404)", async () => {
    const supabase = makeOficinaSupabase({ row: null as never });
    await expect(
      softDeleteOficina(
        supabase,
        OFICINA_ID,
        { confirmationName: "Oficina X" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("grava deleted_at quando o nome confere", async () => {
    const supabase = makeOficinaSupabase({ row: baseRow });
    const result = await softDeleteOficina(
      supabase,
      OFICINA_ID,
      { confirmationName: "Oficina X" },
      { adminId: "a", ip: null },
    );
    expect(result).toMatchObject({ ok: true, id: OFICINA_ID });
    const update = (supabase as unknown as { _update: { mock: { calls: unknown[][] } } })._update;
    expect(update.mock.calls.length).toBe(1);
    expect(update.mock.calls[0][0]).toHaveProperty("deleted_at");
  });
});
