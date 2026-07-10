import { describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calcularValorComissao,
  gerarComissaoParaPagamento,
  resolverRegraComissao,
  validateConfiguracoesComissaoInput,
} from "@/lib/admin/comissoes";

// ----------------------------------------------------------------------------
// Mock encadeavel do Supabase: cada from(table) consome a proxima resposta da
// fila daquela tabela. O builder e thenable (para queries de count aguardadas
// direto) e expoe maybeSingle/single.
// ----------------------------------------------------------------------------

type MockResponse = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

function makeSupabase(queues: Record<string, MockResponse[]>) {
  const inserts: Record<string, unknown[]> = {};
  const supabase = {
    from(table: string) {
      const queue = queues[table] ?? [];
      const response = queue.length > 0 ? queue.shift()! : { data: null, error: null };
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const m of [
        "select",
        "eq",
        "neq",
        "is",
        "gte",
        "lt",
        "in",
        "order",
        "range",
        "limit",
        "ilike",
        "update",
      ]) {
        builder[m] = vi.fn(chain);
      }
      builder.insert = vi.fn((payload: unknown) => {
        (inserts[table] ??= []).push(payload);
        return builder;
      });
      builder.maybeSingle = async () => response;
      builder.single = async () => response;
      builder.then = (resolve: (r: MockResponse) => unknown) => resolve(response);
      return builder;
    },
  };
  return { supabase: supabase as unknown as SupabaseClient, inserts };
}

const CONFIG_PADRAO = {
  data: {
    id: "config-id",
    comissao_tipo: "percentual",
    comissao_valor: 20,
    comissao_duracao_meses: null,
    comissao_base: "valor_pago",
    updated_at: "2026-07-09T00:00:00Z",
  },
  error: null,
};

const PAGAMENTO_PAGO = {
  data: {
    id: "pag-1",
    oficina_id: "of-1",
    valor: 59,
    status: "pago",
    paid_at: "2026-07-09T12:00:00Z",
  },
  error: null,
};

const OFICINA_COM_REP = {
  data: {
    id: "of-1",
    representante_id: "rep-1",
    preco_negociado: null,
    plano_id: "plano-1",
    planos: { preco_base: 59 },
  },
  error: null,
};

const REP_ATIVO_SEM_OVERRIDE = {
  data: {
    id: "rep-1",
    ativo: true,
    deleted_at: null,
    comissao_tipo: null,
    comissao_valor: null,
    comissao_duracao_meses: null,
  },
  error: null,
};

describe("resolverRegraComissao", () => {
  const config = {
    comissao_tipo: "percentual" as const,
    comissao_valor: 20,
    comissao_duracao_meses: null,
    comissao_base: "valor_pago" as const,
  };

  it("usa o default global quando o representante nao tem override", () => {
    expect(
      resolverRegraComissao(config, {
        comissao_tipo: null,
        comissao_valor: null,
        comissao_duracao_meses: null,
      }),
    ).toEqual({ tipo: "percentual", valor: 20, duracaoMeses: null, base: "valor_pago" });
  });

  it("override do representante vence o global (tipo+valor atomicos)", () => {
    expect(
      resolverRegraComissao(config, {
        comissao_tipo: "fixo",
        comissao_valor: 15,
        comissao_duracao_meses: 12,
      }),
    ).toEqual({ tipo: "fixo", valor: 15, duracaoMeses: 12, base: "valor_pago" });
  });

  it("duracao do representante herda a global quando null", () => {
    expect(
      resolverRegraComissao(
        { ...config, comissao_duracao_meses: 6 },
        { comissao_tipo: null, comissao_valor: null, comissao_duracao_meses: null },
      ).duracaoMeses,
    ).toBe(6);
  });
});

describe("calcularValorComissao", () => {
  it("percentual sobre a base, arredondado a 2 casas", () => {
    expect(
      calcularValorComissao(
        { tipo: "percentual", valor: 20, duracaoMeses: null, base: "valor_pago" },
        59,
      ),
    ).toBe(11.8);
  });

  it("fixo ignora a base", () => {
    expect(
      calcularValorComissao(
        { tipo: "fixo", valor: 15, duracaoMeses: null, base: "valor_pago" },
        59,
      ),
    ).toBe(15);
  });
});

describe("validateConfiguracoesComissaoInput", () => {
  it("aceita patch valido", () => {
    expect(
      validateConfiguracoesComissaoInput({
        comissao_tipo: "fixo",
        comissao_valor: 10,
        comissao_duracao_meses: null,
        comissao_base: "preco_tabela",
      }),
    ).toBeNull();
  });

  it("rejeita tipo, valor, duracao e base invalidos", () => {
    expect(
      validateConfiguracoesComissaoInput({ comissao_tipo: "outro" as never }),
    ).toMatchObject({ field: "comissao_tipo" });
    expect(validateConfiguracoesComissaoInput({ comissao_valor: -1 })).toMatchObject({
      field: "comissao_valor",
    });
    expect(
      validateConfiguracoesComissaoInput({ comissao_duracao_meses: 0 }),
    ).toMatchObject({ field: "comissao_duracao_meses" });
    expect(
      validateConfiguracoesComissaoInput({ comissao_base: "outra" as never }),
    ).toMatchObject({ field: "comissao_base" });
  });
});

describe("gerarComissaoParaPagamento", () => {
  it("gera comissao percentual sobre o valor pago (regra global)", async () => {
    const { supabase, inserts } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO],
      comissoes: [
        { data: null, error: null }, // idempotencia: nenhuma existente
        { data: { id: "com-1" }, error: null }, // insert
      ],
      oficinas: [OFICINA_COM_REP],
      representantes: [REP_ATIVO_SEM_OVERRIDE],
      configuracoes_comissao: [CONFIG_PADRAO],
    });

    const result = await gerarComissaoParaPagamento(supabase, "pag-1");
    expect(result).toEqual({ ok: true, comissaoId: "com-1", valor: 11.8 });
    expect(inserts.comissoes?.[0]).toMatchObject({
      representante_id: "rep-1",
      oficina_id: "of-1",
      pagamento_id: "pag-1",
      base_valor: 59,
      tipo: "percentual",
      taxa_aplicada: 20,
      valor: 11.8,
      status: "prevista",
    });
  });

  it("override fixo do representante vence o default global", async () => {
    const { supabase, inserts } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO],
      comissoes: [
        { data: null, error: null },
        { data: { id: "com-2" }, error: null },
      ],
      oficinas: [OFICINA_COM_REP],
      representantes: [
        {
          data: {
            ...(REP_ATIVO_SEM_OVERRIDE.data as object),
            comissao_tipo: "fixo",
            comissao_valor: 15,
          },
          error: null,
        },
      ],
      configuracoes_comissao: [CONFIG_PADRAO],
    });

    const result = await gerarComissaoParaPagamento(supabase, "pag-1");
    expect(result).toEqual({ ok: true, comissaoId: "com-2", valor: 15 });
    expect(inserts.comissoes?.[0]).toMatchObject({ tipo: "fixo", taxa_aplicada: 15 });
  });

  it("base preco_tabela usa o preco_base do plano mesmo com valor pago menor", async () => {
    const { supabase, inserts } = makeSupabase({
      pagamentos: [
        { data: { ...(PAGAMENTO_PAGO.data as object), valor: 40 }, error: null },
      ],
      comissoes: [
        { data: null, error: null },
        { data: { id: "com-3" }, error: null },
      ],
      oficinas: [OFICINA_COM_REP],
      representantes: [REP_ATIVO_SEM_OVERRIDE],
      configuracoes_comissao: [
        {
          data: { ...(CONFIG_PADRAO.data as object), comissao_base: "preco_tabela" },
          error: null,
        },
      ],
    });

    const result = await gerarComissaoParaPagamento(supabase, "pag-1");
    expect(result).toMatchObject({ ok: true, valor: 11.8 });
    expect(inserts.comissoes?.[0]).toMatchObject({ base_valor: 59 });
  });

  it("e idempotente: comissao ja existente nao duplica (webhook repetido)", async () => {
    const { supabase, inserts } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO],
      comissoes: [{ data: { id: "com-1" }, error: null }],
      oficinas: [OFICINA_COM_REP],
      representantes: [REP_ATIVO_SEM_OVERRIDE],
      configuracoes_comissao: [CONFIG_PADRAO],
    });

    const result = await gerarComissaoParaPagamento(supabase, "pag-1");
    expect(result).toEqual({ ok: false, reason: "ja_existe" });
    expect(inserts.comissoes).toBeUndefined();
  });

  it("oficina sem representante nao gera comissao", async () => {
    const { supabase, inserts } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO],
      comissoes: [{ data: null, error: null }],
      oficinas: [
        {
          data: { ...(OFICINA_COM_REP.data as object), representante_id: null },
          error: null,
        },
      ],
    });

    const result = await gerarComissaoParaPagamento(supabase, "pag-1");
    expect(result).toEqual({ ok: false, reason: "sem_representante" });
    expect(inserts.comissoes).toBeUndefined();
  });

  it("representante inativo nao gera comissao", async () => {
    const { supabase } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO],
      comissoes: [{ data: null, error: null }],
      oficinas: [OFICINA_COM_REP],
      representantes: [
        { data: { ...(REP_ATIVO_SEM_OVERRIDE.data as object), ativo: false }, error: null },
      ],
    });

    expect(await gerarComissaoParaPagamento(supabase, "pag-1")).toEqual({
      ok: false,
      reason: "representante_inativo",
    });
  });

  it("pagamento nao-pago nao gera comissao", async () => {
    const { supabase } = makeSupabase({
      pagamentos: [
        { data: { ...(PAGAMENTO_PAGO.data as object), status: "pendente" }, error: null },
      ],
    });

    expect(await gerarComissaoParaPagamento(supabase, "pag-1")).toEqual({
      ok: false,
      reason: "pagamento_nao_pago",
    });
  });

  it("duracao expirada: N pagamentos pagos anteriores >= duracao nao gera", async () => {
    const { supabase, inserts } = makeSupabase({
      pagamentos: [
        PAGAMENTO_PAGO,
        { data: null, error: null, count: 2 }, // count de pagamentos pagos anteriores
      ],
      comissoes: [{ data: null, error: null }],
      oficinas: [OFICINA_COM_REP],
      representantes: [REP_ATIVO_SEM_OVERRIDE],
      configuracoes_comissao: [
        {
          data: { ...(CONFIG_PADRAO.data as object), comissao_duracao_meses: 2 },
          error: null,
        },
      ],
    });

    const result = await gerarComissaoParaPagamento(supabase, "pag-1");
    expect(result).toEqual({ ok: false, reason: "duracao_expirada" });
    expect(inserts.comissoes).toBeUndefined();
  });

  it("dentro da duracao ainda gera", async () => {
    const { supabase } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO, { data: null, error: null, count: 1 }],
      comissoes: [
        { data: null, error: null },
        { data: { id: "com-4" }, error: null },
      ],
      oficinas: [OFICINA_COM_REP],
      representantes: [REP_ATIVO_SEM_OVERRIDE],
      configuracoes_comissao: [
        {
          data: { ...(CONFIG_PADRAO.data as object), comissao_duracao_meses: 2 },
          error: null,
        },
      ],
    });

    expect(await gerarComissaoParaPagamento(supabase, "pag-1")).toMatchObject({ ok: true });
  });

  it("corrida no insert (unique violation) resolve como ja_existe", async () => {
    const { supabase } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO],
      comissoes: [
        { data: null, error: null },
        { data: null, error: { message: "duplicate key", code: "23505" } },
      ],
      oficinas: [OFICINA_COM_REP],
      representantes: [REP_ATIVO_SEM_OVERRIDE],
      configuracoes_comissao: [CONFIG_PADRAO],
    });

    expect(await gerarComissaoParaPagamento(supabase, "pag-1")).toEqual({
      ok: false,
      reason: "ja_existe",
    });
  });

  it("comissao de valor zero nao gera linha", async () => {
    const { supabase } = makeSupabase({
      pagamentos: [PAGAMENTO_PAGO],
      comissoes: [{ data: null, error: null }],
      oficinas: [OFICINA_COM_REP],
      representantes: [REP_ATIVO_SEM_OVERRIDE],
      configuracoes_comissao: [
        { data: { ...(CONFIG_PADRAO.data as object), comissao_valor: 0 }, error: null },
      ],
    });

    expect(await gerarComissaoParaPagamento(supabase, "pag-1")).toEqual({
      ok: false,
      reason: "valor_zero",
    });
  });
});
