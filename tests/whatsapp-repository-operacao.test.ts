import { describe, expect, test } from "vitest";

import { SupabaseWhatsappRepository } from "@/lib/whatsapp/repository";

// Mock encadeável do supabase-js que registra os filtros .eq() aplicados, para
// provar que TODA consulta read-only da operação é escopada por oficina_id
// (CV6 — nunca vazar dados de outra oficina).
function makeSupabase(resultsByTable: Record<string, unknown>) {
  const eqCalls: Array<{ table: string; col: string; val: unknown }> = [];

  function builder(table: string) {
    const result = resultsByTable[table] ?? { data: [], error: null, count: 0 };
    const b: Record<string, unknown> = { _table: table };
    const chain = () => b;
    b.select = chain;
    b.eq = (col: string, val: unknown) => {
      eqCalls.push({ table, col, val });
      return b;
    };
    b.in = chain;
    b.gte = chain;
    b.lt = chain;
    b.ilike = chain;
    b.is = chain;
    b.order = chain;
    b.limit = chain;
    b.maybeSingle = () => Promise.resolve(result);
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onF, onR);
    return b;
  }

  return {
    supabase: { from: (t: string) => builder(t) } as never,
    eqCalls,
  };
}

const OFICINA = "oficina-abc";

describe("repositório operação — escopo por oficina_id (CV6)", () => {
  test("listUpcomingReminders filtra por oficina_id", async () => {
    const { supabase, eqCalls } = makeSupabase({
      lembretes: {
        data: [
          {
            scheduled_at: "2026-07-20T12:00:00Z",
            clientes_finais: { nome: "João" },
            veiculos: { descricao: "Civic" },
          },
        ],
        error: null,
      },
    });
    const repo = new SupabaseWhatsappRepository(supabase);
    const result = await repo.listUpcomingReminders({ oficinaId: OFICINA, days: 7 });

    expect(result).toEqual([
      { clienteNome: "João", veiculo: "Civic", scheduledAt: "2026-07-20T12:00:00Z" },
    ]);
    expect(eqCalls).toContainEqual({ table: "lembretes", col: "oficina_id", val: OFICINA });
  });

  test("countRemindersSentThisMonth filtra por oficina_id", async () => {
    const { supabase, eqCalls } = makeSupabase({
      lembretes: { data: null, error: null, count: 12 },
    });
    const repo = new SupabaseWhatsappRepository(supabase);
    const count = await repo.countRemindersSentThisMonth({ oficinaId: OFICINA });

    expect(count).toBe(12);
    expect(eqCalls).toContainEqual({ table: "lembretes", col: "oficina_id", val: OFICINA });
  });

  test("getClienteResumo escopa cliente, serviços e lembretes por oficina_id", async () => {
    const { supabase, eqCalls } = makeSupabase({
      clientes_finais: {
        data: { id: "cli-1", nome: "João", whatsapp: "+5541999998888", status: "ativo" },
        error: null,
      },
      servicos: {
        data: [
          { tipo_servico: "troca_oleo", data_servico: "2026-05-10", veiculos: { descricao: "Civic" } },
        ],
        error: null,
      },
      lembretes: { data: { scheduled_at: "2026-08-10T12:00:00Z" }, error: null },
    });
    const repo = new SupabaseWhatsappRepository(supabase);
    const resumo = await repo.getClienteResumo({ oficinaId: OFICINA, nomeOuTelefone: "João" });

    expect(resumo?.nome).toBe("João");
    expect(resumo?.totalServicos).toBe(1);
    expect(resumo?.ultimoServico?.tipo).toBe("troca_oleo");
    expect(resumo?.proximoLembreteAt).toBe("2026-08-10T12:00:00Z");

    // Todas as três tabelas foram filtradas por oficina_id.
    for (const table of ["clientes_finais", "servicos", "lembretes"]) {
      expect(eqCalls, table).toContainEqual({ table, col: "oficina_id", val: OFICINA });
    }
  });

  test("getClienteResumo devolve null quando não acha o cliente", async () => {
    const { supabase } = makeSupabase({
      clientes_finais: { data: null, error: null },
    });
    const repo = new SupabaseWhatsappRepository(supabase);
    const resumo = await repo.getClienteResumo({ oficinaId: OFICINA, nomeOuTelefone: "Ninguém" });
    expect(resumo).toBeNull();
  });
});
