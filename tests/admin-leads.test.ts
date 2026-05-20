import { describe, expect, it, vi } from "vitest";

import {
  changeLeadStatus,
  convertLeadManual,
  marcarLeadPerdido,
  reopenLead,
  softDeleteLead,
  validateChangeLeadStatus,
  validateChangeLeadWhatsapp,
  validateConvertLeadManual,
  validateMarcarLeadPerdido,
  validateSoftDeleteLead,
  validateUpdateLead,
} from "@/lib/admin/leads";

describe("validateMarcarLeadPerdido", () => {
  it("aceita motivo valido", () => {
    const r = validateMarcarLeadPerdido({ motivo_perda: "ja contratou concorrente" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.motivo_perda).toBe("ja contratou concorrente");
  });

  it("rejeita motivo vazio", () => {
    const r = validateMarcarLeadPerdido({ motivo_perda: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("motivo_perda");
  });

  it("rejeita motivo ausente", () => {
    const r = validateMarcarLeadPerdido({});
    expect(r.ok).toBe(false);
  });

  it("rejeita motivo > 500 chars", () => {
    const r = validateMarcarLeadPerdido({ motivo_perda: "a".repeat(501) });
    expect(r.ok).toBe(false);
  });
});

describe("validateChangeLeadStatus", () => {
  it("aceita status nao terminal", () => {
    const r = validateChangeLeadStatus({ status: "qualificado" });
    expect(r.ok).toBe(true);
  });
  it("rejeita 'convertido' (rota dedicada)", () => {
    const r = validateChangeLeadStatus({ status: "convertido" as never });
    expect(r.ok).toBe(false);
  });
  it("rejeita 'perdido' (rota dedicada)", () => {
    const r = validateChangeLeadStatus({ status: "perdido" as never });
    expect(r.ok).toBe(false);
  });
  it("rejeita status ausente", () => {
    expect(validateChangeLeadStatus({}).ok).toBe(false);
  });
});

describe("validateUpdateLead", () => {
  it("aceita campos texto e numeros validos", () => {
    const r = validateUpdateLead({
      nome: "Auto Center X",
      cidade: "Sao Paulo",
      volume_trocas_mes: 50,
      ticket_medio: 350.5,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.nome).toBe("Auto Center X");
      expect(r.data.volume_trocas_mes).toBe(50);
    }
  });
  it("rejeita volume nao inteiro", () => {
    const r = validateUpdateLead({ volume_trocas_mes: 1.5 });
    expect(r.ok).toBe(false);
  });
  it("rejeita ticket negativo", () => {
    const r = validateUpdateLead({ ticket_medio: -1 });
    expect(r.ok).toBe(false);
  });
  it("rejeita texto > 500", () => {
    const r = validateUpdateLead({ principal_dor: "a".repeat(501) });
    expect(r.ok).toBe(false);
  });
  it("rejeita payload vazio", () => {
    const r = validateUpdateLead({});
    expect(r.ok).toBe(false);
  });
  it("converte string vazia em null para campos texto", () => {
    const r = validateUpdateLead({ cidade: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.cidade).toBeNull();
  });
});

describe("validateChangeLeadWhatsapp", () => {
  it("aceita numero igual em ambos os campos", () => {
    const r = validateChangeLeadWhatsapp({
      whatsapp: "+5511999998888",
      confirmacao_whatsapp: "+5511999998888",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.whatsapp).toBe("+5511999998888");
  });
  it("normaliza e aceita formatos diferentes que apontam para mesmo E164", () => {
    const r = validateChangeLeadWhatsapp({
      whatsapp: "11999998888",
      confirmacao_whatsapp: "+55 11 99999-8888",
    });
    expect(r.ok).toBe(true);
  });
  it("rejeita quando confirmacao difere", () => {
    const r = validateChangeLeadWhatsapp({
      whatsapp: "+5511999998888",
      confirmacao_whatsapp: "+5511999998877",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("confirmacao_whatsapp");
  });
  it("rejeita whatsapp invalido", () => {
    const r = validateChangeLeadWhatsapp({
      whatsapp: "abc",
      confirmacao_whatsapp: "abc",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateConvertLeadManual", () => {
  const uuid = "11111111-1111-1111-1111-111111111111";
  it("aceita payload valido", () => {
    const r = validateConvertLeadManual({
      plano_id: uuid,
      preco_negociado: 99.9,
      dias_lembrete: 90,
      status: "ativa",
    });
    expect(r.ok).toBe(true);
  });
  it("aceita preco_negociado null", () => {
    const r = validateConvertLeadManual({
      plano_id: uuid,
      preco_negociado: null,
      dias_lembrete: 60,
      status: "pausada",
    });
    expect(r.ok).toBe(true);
  });
  it("rejeita plano_id nao-uuid", () => {
    const r = validateConvertLeadManual({
      plano_id: "abc",
      dias_lembrete: 30,
      status: "ativa",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("plano_id");
  });
  it("rejeita dias_lembrete fora de [1,365]", () => {
    expect(
      validateConvertLeadManual({
        plano_id: uuid,
        dias_lembrete: 0,
        status: "ativa",
      }).ok,
    ).toBe(false);
    expect(
      validateConvertLeadManual({
        plano_id: uuid,
        dias_lembrete: 400,
        status: "ativa",
      }).ok,
    ).toBe(false);
  });
  it("rejeita status invalido", () => {
    const r = validateConvertLeadManual({
      plano_id: uuid,
      dias_lembrete: 90,
      status: "cancelada" as never,
    });
    expect(r.ok).toBe(false);
  });
  it("rejeita preco negativo", () => {
    const r = validateConvertLeadManual({
      plano_id: uuid,
      preco_negociado: -1,
      dias_lembrete: 90,
      status: "ativa",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateSoftDeleteLead", () => {
  it("aceita motivo valido", () => {
    expect(validateSoftDeleteLead({ motivo: "spam" }).ok).toBe(true);
  });
  it("rejeita motivo vazio", () => {
    expect(validateSoftDeleteLead({ motivo: "" }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mutacoes — stubs minimos
// ---------------------------------------------------------------------------

function makeLeadSupabase(leadRow: { id: string; status: string } & Record<string, unknown>) {
  const selectChain = () => {
    const tail = {
      maybeSingle: vi.fn(async () => ({ data: leadRow, error: null })),
    };
    const eqWithIs = {
      is: vi.fn(() => tail),
      maybeSingle: tail.maybeSingle,
    };
    return { eq: vi.fn(() => eqWithIs) };
  };
  const updateChain = () => ({ eq: vi.fn(async () => ({ error: null })) });
  const insertFn = vi.fn(async () => ({ error: null }));

  const rpcFn = vi.fn(async (_name: string, _args: unknown) => ({
    data: { oficina_id: "22222222-2222-2222-2222-222222222222", lead_id: leadRow.id, conversa_id: null },
    error: null,
  }));

  return {
    rpc: rpcFn,
    from: vi.fn((table: string) => {
      if (table === "leads_oficina") return { select: selectChain, update: updateChain };
      if (table === "admin_audit_log") return { insert: insertFn };
      throw new Error(`unexpected table ${table}`);
    }),
  } as never;
}

describe("marcarLeadPerdido — transicoes", () => {
  it("rejeita lead ja convertido com 409", async () => {
    const supabase = makeLeadSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "convertido",
    });
    await expect(
      marcarLeadPerdido(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo_perda: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejeita lead ja perdido com 409", async () => {
    const supabase = makeLeadSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "perdido",
    });
    await expect(
      marcarLeadPerdido(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo_perda: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("changeLeadStatus — transicoes", () => {
  it("rejeita partindo de status terminal com 409", async () => {
    const supabase = makeLeadSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "convertido",
    });
    await expect(
      changeLeadStatus(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { status: "em_conversa" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("reopenLead — transicoes", () => {
  it("rejeita lead nao-perdido com 409", async () => {
    const supabase = makeLeadSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "em_conversa",
    });
    await expect(
      reopenLead(supabase, "11111111-1111-1111-1111-111111111111", {
        adminId: "a",
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("convertLeadManual — guarda terminal", () => {
  it("rejeita lead ja perdido com 409 (sem chamar RPC)", async () => {
    const supabase = makeLeadSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "perdido",
    });
    await expect(
      convertLeadManual(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        {
          plano_id: "22222222-2222-2222-2222-222222222222",
          preco_negociado: null,
          dias_lembrete: 90,
          status: "ativa",
        },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect((supabase as { rpc: { mock: { calls: unknown[] } } }).rpc.mock.calls.length).toBe(0);
  });
});

describe("softDeleteLead — guarda convertido", () => {
  it("rejeita lead convertido com 409", async () => {
    const supabase = makeLeadSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "convertido",
    });
    await expect(
      softDeleteLead(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo: "duplicata" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
