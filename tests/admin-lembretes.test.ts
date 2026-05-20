import { describe, expect, it, vi } from "vitest";

import {
  cancelarLembrete,
  validateCancelarLembrete,
} from "@/lib/admin/lembretes";

describe("validateCancelarLembrete", () => {
  it("aceita motivo valido", () => {
    const r = validateCancelarLembrete({ motivo: "cliente pediu" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.motivo).toBe("cliente pediu");
  });
  it("rejeita motivo vazio", () => {
    const r = validateCancelarLembrete({ motivo: " " });
    expect(r.ok).toBe(false);
  });
  it("rejeita motivo > 500 chars", () => {
    const r = validateCancelarLembrete({ motivo: "a".repeat(501) });
    expect(r.ok).toBe(false);
  });
});

describe("cancelarLembrete — transicoes", () => {
  function makeSupabase(row: { id: string; status: string }) {
    const selectChain = () => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: row, error: null })),
      })),
    });
    const updateChain = () => ({ eq: vi.fn(async () => ({ error: null })) });
    const insertFn = vi.fn(async () => ({ error: null }));
    return {
      from: vi.fn((table: string) => {
        if (table === "lembretes") {
          return { select: selectChain, update: updateChain };
        }
        if (table === "admin_audit_log") return { insert: insertFn };
        throw new Error(`unexpected table ${table}`);
      }),
    } as never;
  }

  it("rejeita lembrete ja enviado com 409", async () => {
    const supabase = makeSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "enviado",
    });
    await expect(
      cancelarLembrete(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejeita lembrete cancelado com 409", async () => {
    const supabase = makeSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "cancelado",
    });
    await expect(
      cancelarLembrete(
        supabase,
        "11111111-1111-1111-1111-111111111111",
        { motivo: "x" },
        { adminId: "a", ip: null },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
