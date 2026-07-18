import { describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listOficinasDoRepresentante } from "@/lib/representante/carteira";
import { listLeadsDoRepresentante } from "@/lib/representante/leads";
import { getRepresentanteDashboard } from "@/lib/representante/dashboard";

// ----------------------------------------------------------------------------
// Mock encadeavel do Supabase que REGISTRA cada chamada (table/method/args),
// para podermos afirmar escopo (eq representante_id) e ausencia de PII (colunas
// selecionadas). Cada from(table) consome a proxima resposta da fila da tabela.
// ----------------------------------------------------------------------------

type MockResponse = { data?: unknown; error?: unknown; count?: number | null };
type Call = { table: string; method: string; args: unknown[] };

function makeSupabase(queues: Record<string, MockResponse[]>) {
  const calls: Call[] = [];
  const supabase = {
    from(table: string) {
      const queue = queues[table] ?? [];
      const response = queue.length > 0 ? queue.shift()! : { data: [], error: null };
      const builder: Record<string, unknown> = {};
      const record = (method: string) =>
        vi.fn((...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        });
      for (const m of ["select", "eq", "neq", "is", "gte", "lt", "in", "order", "range", "limit"]) {
        builder[m] = record(m);
      }
      builder.maybeSingle = async () => response;
      builder.single = async () => response;
      builder.then = (resolve: (r: MockResponse) => unknown) => resolve(response);
      return builder;
    },
  };
  return { supabase: supabase as unknown as SupabaseClient, calls };
}

function eqArgsFor(calls: Call[], table: string): Array<[string, unknown]> {
  return calls
    .filter((c) => c.table === table && c.method === "eq")
    .map((c) => c.args as [string, unknown]);
}

function selectArgsFor(calls: Call[], table: string): string[] {
  return calls
    .filter((c) => c.table === table && c.method === "select")
    .map((c) => String(c.args[0] ?? ""));
}

describe("representante carteira", () => {
  it("escopa por representante_id da sessao e nao vaza rep de outro", async () => {
    const { supabase, calls } = makeSupabase({
      oficinas: [
        {
          data: [
            {
              id: "of-1",
              nome: "Oficina A",
              cidade: "Curitiba",
              status: "ativa",
              responsavel: "Ana",
              whatsapp_principal: "+5541999990000",
              preco_negociado: 79.9,
              created_at: "2026-06-01T00:00:00Z",
              proximo_vencimento: "2026-08-01",
              planos: { nome: "Mensal", preco_base: 99.9 },
            },
          ],
          error: null,
        },
      ],
      clientes_finais: [{ data: [{ oficina_id: "of-1" }, { oficina_id: "of-1" }], error: null }],
      lembretes: [
        {
          data: [
            { oficina_id: "of-1", status: "enviado" },
            { oficina_id: "of-1", status: "respondido" },
            { oficina_id: "of-1", status: "pendente" },
          ],
          error: null,
        },
      ],
    });

    const rows = await listOficinasDoRepresentante(supabase, "rep-A");

    // Escopo: a query de oficinas filtra por representante_id = rep-A.
    expect(eqArgsFor(calls, "oficinas")).toContainEqual(["representante_id", "rep-A"]);

    // Agregados corretos: 2 clientes, 2 lembretes enviados (enviado+respondido,
    // 'pendente' nao conta), 1 respondido. preco_negociado vence preco_base.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "of-1",
      clientesFinaisCount: 2,
      lembretesEnviados: 2,
      lembretesRespondidos: 1,
      precoMensal: 79.9,
      planoNome: "Mensal",
    });
  });

  it("nao seleciona PII de cliente final (LGPD): so contagens", async () => {
    const { supabase, calls } = makeSupabase({
      oficinas: [{ data: [{ id: "of-1", nome: "A", status: "ativa", whatsapp_principal: "+5541999990000", created_at: "2026-06-01T00:00:00Z", planos: null, preco_negociado: null }], error: null }],
      clientes_finais: [{ data: [], error: null }],
      lembretes: [{ data: [], error: null }],
    });

    await listOficinasDoRepresentante(supabase, "rep-A");

    const clientesSelects = selectArgsFor(calls, "clientes_finais");
    expect(clientesSelects.length).toBeGreaterThan(0);
    for (const sel of clientesSelects) {
      expect(sel).not.toMatch(/nome/i);
      expect(sel).not.toMatch(/whatsapp/i);
      expect(sel).toBe("oficina_id");
    }
    // O tipo de retorno nao possui nenhum campo de PII de cliente final.
    const returnedKeys = Object.keys(
      (await listOficinasDoRepresentante(
        (makeSupabase({
          oficinas: [{ data: [{ id: "of-1", nome: "A", status: "ativa", whatsapp_principal: "+55419", created_at: "2026-06-01T00:00:00Z", planos: null, preco_negociado: null }], error: null }],
          clientes_finais: [{ data: [], error: null }],
          lembretes: [{ data: [], error: null }],
        }).supabase),
        "rep-A",
      ))[0],
    );
    expect(returnedKeys).not.toContain("clienteNome");
    expect(returnedKeys).not.toContain("clienteWhatsapp");
  });
});

describe("representante leads", () => {
  it("escopa por representante_id e marca em aberto / convertido", async () => {
    const { supabase, calls } = makeSupabase({
      leads_oficina: [
        {
          data: [
            {
              id: "l-1",
              nome: "Fulano",
              nome_oficina: "Oficina X",
              nome_responsavel: "Fulano",
              whatsapp: "+5541988887777",
              cidade: "Curitiba",
              status: "interessado",
              oficina_id: null,
              last_message_at: "2026-07-10T00:00:00Z",
              created_at: "2026-07-01T00:00:00Z",
            },
            {
              id: "l-2",
              nome: "Beltrano",
              nome_oficina: "Oficina Y",
              nome_responsavel: null,
              whatsapp: "+5541977776666",
              cidade: null,
              status: "convertido",
              oficina_id: "of-9",
              last_message_at: null,
              created_at: "2026-06-01T00:00:00Z",
            },
          ],
          error: null,
        },
      ],
    });

    const rows = await listLeadsDoRepresentante(supabase, "rep-B");
    expect(eqArgsFor(calls, "leads_oficina")).toContainEqual(["representante_id", "rep-B"]);
    expect(rows[0]).toMatchObject({ status: "interessado", emAberto: true, convertido: false });
    expect(rows[1]).toMatchObject({ status: "convertido", emAberto: false, convertido: true });
  });
});

describe("representante dashboard", () => {
  it("escopa todos os contadores por representante_id", async () => {
    const { supabase, calls } = makeSupabase({
      oficinas: [{ count: 3, error: null }],
      leads_oficina: [{ count: 5, error: null }],
      // comissoes: uma para o resumo do mes, outra para paga acumulada.
      comissoes: [
        { data: [{ valor: 20, status: "prevista" }, { valor: 10, status: "paga" }], error: null },
        { data: [{ valor: 10 }, { valor: 15 }], error: null },
      ],
    });

    const dash = await getRepresentanteDashboard(
      supabase,
      "rep-C",
      new Date("2026-07-18T00:00:00Z"),
    );

    expect(dash).toEqual({
      oficinasAtivas: 3,
      leadsEmAberto: 5,
      comissaoPrevistaMes: 20,
      comissaoPagaAcumulada: 25,
    });
    // Todo contador foi escopado ao rep da sessao.
    expect(eqArgsFor(calls, "oficinas")).toContainEqual(["representante_id", "rep-C"]);
    expect(eqArgsFor(calls, "leads_oficina")).toContainEqual(["representante_id", "rep-C"]);
    expect(eqArgsFor(calls, "comissoes")).toContainEqual(["representante_id", "rep-C"]);
  });
});
