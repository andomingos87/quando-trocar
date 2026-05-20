import { describe, expect, it } from "vitest";

import {
  isTipoServicoKey,
  validateTipoServicoUpdate,
} from "@/lib/admin/tipos-servico";

describe("isTipoServicoKey", () => {
  it("aceita as 4 chaves validas", () => {
    for (const key of ["troca_oleo", "amortecedor", "revisao", "outro"]) {
      expect(isTipoServicoKey(key)).toBe(true);
    }
  });

  it("rejeita chaves desconhecidas e tipos errados", () => {
    expect(isTipoServicoKey("troca-oleo")).toBe(false);
    expect(isTipoServicoKey("freio")).toBe(false);
    expect(isTipoServicoKey(null)).toBe(false);
    expect(isTipoServicoKey(123)).toBe(false);
  });
});

describe("validateTipoServicoUpdate", () => {
  it("aceita update vazio (sem nenhum campo)", () => {
    expect(validateTipoServicoUpdate({})).toBeNull();
  });

  it("aceita um update completo valido", () => {
    expect(
      validateTipoServicoUpdate({
        label: "Amortecedor",
        dias_lembrete: 730,
        template_name: "lembrete_amortecedor",
        template_language: "pt_BR",
        ativo: true,
      }),
    ).toBeNull();
  });

  it("rejeita label vazio", () => {
    expect(validateTipoServicoUpdate({ label: "  " })).toMatchObject({
      field: "label",
    });
  });

  it("rejeita label > 60 chars", () => {
    expect(validateTipoServicoUpdate({ label: "a".repeat(61) })).toMatchObject({
      field: "label",
    });
  });

  it("rejeita dias_lembrete <= 0 ou nao inteiro", () => {
    expect(validateTipoServicoUpdate({ dias_lembrete: 0 })).toMatchObject({
      field: "dias_lembrete",
    });
    expect(validateTipoServicoUpdate({ dias_lembrete: -10 })).toMatchObject({
      field: "dias_lembrete",
    });
    expect(validateTipoServicoUpdate({ dias_lembrete: 1.5 })).toMatchObject({
      field: "dias_lembrete",
    });
  });

  it("rejeita dias_lembrete > 3650", () => {
    expect(validateTipoServicoUpdate({ dias_lembrete: 4000 })).toMatchObject({
      field: "dias_lembrete",
    });
  });

  it("rejeita template_name com caracteres invalidos", () => {
    expect(
      validateTipoServicoUpdate({ template_name: "Template-Name" }),
    ).toMatchObject({ field: "template_name" });
    expect(validateTipoServicoUpdate({ template_name: "" })).toMatchObject({
      field: "template_name",
    });
  });

  it("rejeita template_language fora do formato bcp47 simples", () => {
    expect(
      validateTipoServicoUpdate({ template_language: "pt-br" }),
    ).toMatchObject({ field: "template_language" });
    expect(
      validateTipoServicoUpdate({ template_language: "portugues" }),
    ).toMatchObject({ field: "template_language" });
  });

  it("aceita template_language pt_BR e en", () => {
    expect(
      validateTipoServicoUpdate({ template_language: "pt_BR" }),
    ).toBeNull();
    expect(validateTipoServicoUpdate({ template_language: "en" })).toBeNull();
  });
});
