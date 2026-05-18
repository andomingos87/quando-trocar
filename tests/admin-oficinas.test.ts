import { describe, expect, it } from "vitest";

import { validateOficinaCreate } from "@/lib/admin/oficinas";

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
