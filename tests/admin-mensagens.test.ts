import { describe, expect, it, vi } from "vitest";

import { retryOutboundMessage } from "@/lib/admin/mensagens";

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
      if (table === "outbound_messages") {
        return { select: selectChain, update: updateChain };
      }
      if (table === "admin_audit_log") return { insert: insertFn };
      throw new Error(`unexpected table ${table}`);
    }),
  } as never;
}

describe("retryOutboundMessage — transicoes", () => {
  it("rejeita mensagem ja sent com 409", async () => {
    const supabase = makeSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "sent",
    });
    await expect(
      retryOutboundMessage(supabase, "11111111-1111-1111-1111-111111111111", {
        adminId: "a",
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejeita mensagem ja pending com 409", async () => {
    const supabase = makeSupabase({
      id: "11111111-1111-1111-1111-111111111111",
      status: "pending",
    });
    await expect(
      retryOutboundMessage(supabase, "11111111-1111-1111-1111-111111111111", {
        adminId: "a",
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("retorna 404 se nao existir", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        }),
      })),
    } as never;
    await expect(
      retryOutboundMessage(supabase, "11111111-1111-1111-1111-111111111111", {
        adminId: "a",
        ip: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
