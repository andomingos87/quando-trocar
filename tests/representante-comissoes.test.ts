import { describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

// Espia o listComissoes do admin para provar que o wrapper INJETA o
// representante_id da sessao (o rep nunca escolhe de quem ve as comissoes).
const listComissoesMock = vi.fn(async () => ({
  rows: [],
  total: 0,
  page: 1,
  pageSize: 50,
  totalPrevisto: 0,
  totalPago: 0,
}));

vi.mock("@/lib/admin/comissoes", () => ({
  listComissoes: (...args: unknown[]) => listComissoesMock(...(args as [])),
}));

import { listComissoesDoRepresentante } from "@/lib/representante/comissoes";

const fakeSupabase = {} as unknown as SupabaseClient;

describe("representante comissoes wrapper", () => {
  it("injeta o representante_id da sessao em listComissoes", async () => {
    listComissoesMock.mockClear();
    await listComissoesDoRepresentante(fakeSupabase, "rep-A", { status: "prevista", mes: "2026-07" });

    expect(listComissoesMock).toHaveBeenCalledTimes(1);
    const [, filters] = listComissoesMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>];
    expect(filters.representante_id).toBe("rep-A");
    expect(filters.status).toBe("prevista");
    expect(filters.mes).toBe("2026-07");
  });

  it("ignora qualquer representante_id vindo do filtro (nao ha como sobrescrever)", async () => {
    listComissoesMock.mockClear();
    // O tipo do filtro nao expoe representante_id; ainda assim, se alguem forcar
    // via cast, o wrapper sobrescreve com o da sessao.
    await listComissoesDoRepresentante(
      fakeSupabase,
      "rep-A",
      { representante_id: "rep-B" } as unknown as { status?: undefined },
    );

    const [, filters] = listComissoesMock.mock.calls[0] as unknown as [unknown, Record<string, unknown>];
    expect(filters.representante_id).toBe("rep-A");
  });
});
