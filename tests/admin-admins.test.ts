import { describe, expect, it } from "vitest";

import { validateAdminInvite } from "@/lib/admin/admins";

describe("validateAdminInvite", () => {
  it("normalizes whatsapp to E.164", () => {
    const r = validateAdminInvite({ nome: "Ana", whatsapp: "11999999999" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.whatsapp).toBe("+5511999999999");
  });

  it("rejects empty nome", () => {
    const r = validateAdminInvite({ nome: "", whatsapp: "+5511999999999" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("nome");
  });

  it("rejects invalid whatsapp", () => {
    const r = validateAdminInvite({ nome: "Ana", whatsapp: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("whatsapp");
  });

  it("trims nome", () => {
    const r = validateAdminInvite({ nome: "  Ana  ", whatsapp: "+5511999999999" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nome).toBe("Ana");
  });
});
