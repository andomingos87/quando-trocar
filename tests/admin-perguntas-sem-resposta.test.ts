import { describe, expect, test, vi } from "vitest";

import { listPerguntasAbertas } from "@/lib/admin/perguntas-sem-resposta";

type Row = {
  pergunta: string;
  agent_mode: string;
  resposta_enviada: string;
  created_at: string;
};

// Mock encadeável do supabase-js: from().select().eq().order().limit() resolve
// para { data, error }.
function mockSupabase(rows: Row[]) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(async () => ({ data: rows, error: null }));
  return { from: vi.fn(() => builder) } as never;
}

describe("listPerguntasAbertas — agregação por frequência", () => {
  test("agrupa perguntas iguais (case/espaço-insensível) e conta ocorrências", async () => {
    const supabase = mockSupabase([
      { pergunta: "Funciona pra moto?", agent_mode: "vendas", resposta_enviada: "x", created_at: "2026-07-18T10:00:00Z" },
      { pergunta: "funciona pra  moto?", agent_mode: "vendas", resposta_enviada: "x", created_at: "2026-07-17T10:00:00Z" },
      { pergunta: "Precisa instalar app?", agent_mode: "vendas", resposta_enviada: "y", created_at: "2026-07-18T09:00:00Z" },
    ]);

    const result = await listPerguntasAbertas(supabase);

    expect(result).toHaveLength(2);
    // A mais frequente vem primeiro.
    expect(result[0].pergunta).toBe("Funciona pra moto?");
    expect(result[0].ocorrencias).toBe(2);
    expect(result[1].ocorrencias).toBe(1);
  });

  test("desempata por mais recente quando a frequência é igual", async () => {
    const supabase = mockSupabase([
      { pergunta: "Pergunta A", agent_mode: "vendas", resposta_enviada: "x", created_at: "2026-07-18T10:00:00Z" },
      { pergunta: "Pergunta B", agent_mode: "vendas", resposta_enviada: "x", created_at: "2026-07-18T08:00:00Z" },
    ]);

    const result = await listPerguntasAbertas(supabase);
    expect(result.map((p) => p.pergunta)).toEqual(["Pergunta A", "Pergunta B"]);
  });

  test("lista vazia devolve []", async () => {
    const supabase = mockSupabase([]);
    expect(await listPerguntasAbertas(supabase)).toEqual([]);
  });
});
