import { describe, expect, it } from "vitest";

import { validateRepresentanteInput } from "@/lib/admin/representantes";

describe("validateRepresentanteInput", () => {
  it("aceita cadastro completo valido e normaliza codigo/whatsapp", () => {
    const result = validateRepresentanteInput(
      {
        nome: " Carlos Silva ",
        whatsapp: "41999421180",
        codigo: "carlos-sp",
      },
      { partial: false },
    );
    expect(result).toEqual({
      ok: true,
      data: {
        nome: "Carlos Silva",
        whatsapp: "+5541999421180",
        codigo: "CARLOS-SP",
      },
    });
  });

  it("exige nome, whatsapp e codigo no cadastro completo", () => {
    expect(
      validateRepresentanteInput({ whatsapp: "41999421180", codigo: "AB" }, { partial: false }),
    ).toMatchObject({ ok: false, error: { field: "nome" } });
    expect(
      validateRepresentanteInput({ nome: "Carlos", codigo: "AB" }, { partial: false }),
    ).toMatchObject({ ok: false, error: { field: "whatsapp" } });
    expect(
      validateRepresentanteInput({ nome: "Carlos", whatsapp: "41999421180" }, { partial: false }),
    ).toMatchObject({ ok: false, error: { field: "codigo" } });
  });

  it("rejeita codigo fora do formato (curto demais, caracteres invalidos)", () => {
    expect(
      validateRepresentanteInput(
        { nome: "Carlos", whatsapp: "41999421180", codigo: "X" },
        { partial: false },
      ),
    ).toMatchObject({ ok: false, error: { field: "codigo" } });
    expect(
      validateRepresentanteInput(
        { nome: "Carlos", whatsapp: "41999421180", codigo: "AB CD" },
        { partial: false },
      ),
    ).toMatchObject({ ok: false, error: { field: "codigo" } });
  });

  it("patch parcial aceita campos isolados", () => {
    expect(validateRepresentanteInput({ ativo: false }, { partial: true })).toEqual({
      ok: true,
      data: { ativo: false },
    });
  });

  it("override de comissao e atomico: tipo sem valor (ou vice-versa) e rejeitado", () => {
    expect(
      validateRepresentanteInput({ comissao_tipo: "fixo" }, { partial: true }),
    ).toMatchObject({ ok: false, error: { field: "comissao_tipo" } });
    expect(
      validateRepresentanteInput({ comissao_valor: 15 }, { partial: true }),
    ).toMatchObject({ ok: false, error: { field: "comissao_tipo" } });
    expect(
      validateRepresentanteInput(
        { comissao_tipo: "fixo", comissao_valor: 15 },
        { partial: true },
      ),
    ).toEqual({ ok: true, data: { comissao_tipo: "fixo", comissao_valor: 15 } });
    // limpar o override (ambos null) tambem e valido
    expect(
      validateRepresentanteInput(
        { comissao_tipo: null, comissao_valor: null },
        { partial: true },
      ),
    ).toEqual({ ok: true, data: { comissao_tipo: null, comissao_valor: null } });
  });

  it("rejeita valores invalidos de comissao e duracao", () => {
    expect(
      validateRepresentanteInput(
        { comissao_tipo: "outro" as never, comissao_valor: 10 },
        { partial: true },
      ),
    ).toMatchObject({ ok: false, error: { field: "comissao_tipo" } });
    expect(
      validateRepresentanteInput(
        { comissao_tipo: "fixo", comissao_valor: -5 },
        { partial: true },
      ),
    ).toMatchObject({ ok: false, error: { field: "comissao_valor" } });
    expect(
      validateRepresentanteInput({ comissao_duracao_meses: 0 }, { partial: true }),
    ).toMatchObject({ ok: false, error: { field: "comissao_duracao_meses" } });
    expect(
      validateRepresentanteInput({ comissao_duracao_meses: null }, { partial: true }),
    ).toEqual({ ok: true, data: { comissao_duracao_meses: null } });
  });
});
