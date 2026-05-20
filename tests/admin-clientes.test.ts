import { describe, expect, it, vi } from "vitest";

import {
  marcarClienteOptOut,
  marcarNumeroCorreto,
  marcarNumeroErrado,
  reactivateCliente,
  softDeleteCliente,
  updateCliente,
  validateChangeClienteWhatsapp,
  validateMarcarClienteOptOut,
  validateMarcarNumeroErrado,
  validateReactivateCliente,
  validateSoftDeleteCliente,
  validateUpdateCliente,
} from "@/lib/admin/clientes";

describe("validateMarcarClienteOptOut", () => {
  it("aceita motivo valido", () => {
    const r = validateMarcarClienteOptOut({ motivo: "pediu para parar" });
    expect(r.ok).toBe(true);
  });
  it("rejeita motivo vazio", () => {
    expect(validateMarcarClienteOptOut({ motivo: "" }).ok).toBe(false);
  });
  it("rejeita motivo muito longo", () => {
    expect(
      validateMarcarClienteOptOut({ motivo: "a".repeat(501) }).ok,
    ).toBe(false);
  });
});

describe("validateReactivateCliente", () => {
  it("aceita origem valida", () => {
    const r = validateReactivateCliente({ origem_consentimento: "pedido_verbal" });
    expect(r.ok).toBe(true);
  });
  it("rejeita origem vazia", () => {
    expect(validateReactivateCliente({ origem_consentimento: "" }).ok).toBe(false);
  });
  it("rejeita origem > 200", () => {
    expect(
      validateReactivateCliente({ origem_consentimento: "a".repeat(201) }).ok,
    ).toBe(false);
  });
});

describe("validateMarcarNumeroErrado", () => {
  it("aceita motivo valido", () => {
    expect(validateMarcarNumeroErrado({ motivo: "outra pessoa" }).ok).toBe(true);
  });
  it("rejeita motivo vazio", () => {
    expect(validateMarcarNumeroErrado({ motivo: "  " }).ok).toBe(false);
  });
});

describe("validateUpdateCliente", () => {
  it("aceita nome trimado", () => {
    const r = validateUpdateCliente({ nome: "  Maria  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nome).toBe("Maria");
  });
  it("aceita null para limpar nome", () => {
    const r = validateUpdateCliente({ nome: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nome).toBeNull();
  });
  it("rejeita nome > 200", () => {
    expect(validateUpdateCliente({ nome: "a".repeat(201) }).ok).toBe(false);
  });
  it("rejeita payload sem nome", () => {
    expect(validateUpdateCliente({}).ok).toBe(false);
  });
});

describe("validateChangeClienteWhatsapp", () => {
  it("aceita numeros que normalizam para mesmo E164", () => {
    const r = validateChangeClienteWhatsapp({
      whatsapp: "11999998888",
      confirmacao_whatsapp: "+5511999998888",
    });
    expect(r.ok).toBe(true);
  });
  it("rejeita quando confirmacao difere", () => {
    expect(
      validateChangeClienteWhatsapp({
        whatsapp: "+5511999998888",
        confirmacao_whatsapp: "+5511999998877",
      }).ok,
    ).toBe(false);
  });
});

describe("validateSoftDeleteCliente", () => {
  it("aceita motivo valido", () => {
    expect(validateSoftDeleteCliente({ motivo: "duplicata" }).ok).toBe(true);
  });
  it("rejeita motivo vazio", () => {
    expect(validateSoftDeleteCliente({ motivo: "" }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mutacoes — stubs minimos
// ---------------------------------------------------------------------------

type Row = { id: string; status: string; oficina_id?: string | null; whatsapp?: string };

function makeClienteSupabase(row: Row) {
  const lembretesUpdated: string[] = [];
  const selectChain = () => {
    const tail = { maybeSingle: vi.fn(async () => ({ data: row, error: null })) };
    const eqWithIs = {
      is: vi.fn(() => tail),
      maybeSingle: tail.maybeSingle,
    };
    return { eq: vi.fn(() => eqWithIs) };
  };
  const updateChain = () => ({ eq: vi.fn(async () => ({ error: null })) });
  const insertFn = vi.fn(async () => ({ error: null }));

  // Lembretes UPDATE retorna select(...) → array
  const lembretesUpdateChain = () => ({
    eq: vi.fn(() => ({
      in: vi.fn(() => ({
        select: vi.fn(async () => ({
          data: lembretesUpdated.map((id) => ({ id })),
          error: null,
        })),
      })),
    })),
  });

  return {
    __addLembrete(id: string) {
      lembretesUpdated.push(id);
    },
    from: vi.fn((table: string) => {
      if (table === "clientes_finais") return { select: selectChain, update: updateChain };
      if (table === "admin_audit_log") return { insert: insertFn };
      if (table === "lembretes") return { update: lembretesUpdateChain };
      throw new Error(`unexpected table ${table}`);
    }),
  } as never;
}

describe("marcarClienteOptOut — transicoes", () => {
  it("rejeita cliente ja opt_out com 409", async () => {
    const supabase = makeClienteSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "opt_out",
    });
    await expect(
      marcarClienteOptOut(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejeita cliente numero_errado com 409", async () => {
    const supabase = makeClienteSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "numero_errado",
    });
    await expect(
      marcarClienteOptOut(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("reactivateCliente — transicoes", () => {
  it("rejeita cliente ativo com 409", async () => {
    const supabase = makeClienteSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "ativo",
    });
    await expect(
      reactivateCliente(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { origem_consentimento: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("marcarNumeroErrado — transicoes", () => {
  it("rejeita cliente nao-ativo com 409", async () => {
    const supabase = makeClienteSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "opt_out",
    });
    await expect(
      marcarNumeroErrado(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("marcarNumeroCorreto — transicoes", () => {
  it("rejeita cliente ja ativo com 409", async () => {
    const supabase = makeClienteSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "ativo",
    });
    await expect(
      marcarNumeroCorreto(supabase, "11111111-1111-1111-1111-111111111111", {
        adminId: "a",
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("updateCliente — basico", () => {
  it("nao falha em cliente existente", async () => {
    const supabase = makeClienteSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "ativo",
    });
    const r = await updateCliente(
      supabase,
      "11111111-1111-1111-1111-111111111111",
      { nome: "Novo Nome" },
      { adminId: "a", ip: null },
    );
    expect(r.ok).toBe(true);
  });
});

describe("softDeleteCliente — basico", () => {
  it("retorna ok e id", async () => {
    const supabase = makeClienteSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "ativo",
    });
    const r = await softDeleteCliente(
      supabase,
      "11111111-1111-1111-1111-111111111111",
      { motivo: "duplicata" },
      { adminId: "a", ip: null },
    );
    expect(r.ok).toBe(true);
    expect(r.id).toBe("11111111-1111-1111-1111-111111111111");
  });
});
