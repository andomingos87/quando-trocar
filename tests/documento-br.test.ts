import { describe, expect, it } from "vitest";

import {
  formatCep,
  formatCpfCnpj,
  isValidCep,
  isValidCpfCnpj,
  isValidEmail,
  isValidUf,
  onlyDigits,
} from "@/lib/admin/documento-br";

describe("isValidCpfCnpj", () => {
  it("aceita CPF valido (com e sem mascara)", () => {
    expect(isValidCpfCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfCnpj("52998224725")).toBe(true);
  });

  it("rejeita CPF com digito verificador errado", () => {
    expect(isValidCpfCnpj("529.982.247-24")).toBe(false);
  });

  it("rejeita CPF de digitos repetidos", () => {
    expect(isValidCpfCnpj("11111111111")).toBe(false);
  });

  it("aceita CNPJ valido", () => {
    expect(isValidCpfCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita CNPJ invalido", () => {
    expect(isValidCpfCnpj("11.222.333/0001-80")).toBe(false);
  });

  it("rejeita tamanho fora de 11/14", () => {
    expect(isValidCpfCnpj("123")).toBe(false);
  });
});

describe("formatCpfCnpj", () => {
  it("mascara CPF", () => {
    expect(formatCpfCnpj("52998224725")).toBe("529.982.247-25");
  });
  it("mascara CNPJ", () => {
    expect(formatCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("nao passa de 14 digitos", () => {
    expect(onlyDigits(formatCpfCnpj("112223330001810000"))).toHaveLength(14);
  });
});

describe("CEP", () => {
  it("mascara e valida", () => {
    expect(formatCep("01001000")).toBe("01001-000");
    expect(isValidCep("01001-000")).toBe(true);
    expect(isValidCep("0100100")).toBe(false);
  });
});

describe("UF", () => {
  it("aceita UF valida (case-insensitive)", () => {
    expect(isValidUf("sp")).toBe(true);
    expect(isValidUf("SP")).toBe(true);
  });
  it("rejeita UF invalida", () => {
    expect(isValidUf("XX")).toBe(false);
  });
});

describe("e-mail", () => {
  it("aceita e-mail simples", () => {
    expect(isValidEmail("contato@oficina.com.br")).toBe(true);
  });
  it("rejeita sem dominio", () => {
    expect(isValidEmail("contato@oficina")).toBe(false);
    expect(isValidEmail("sem-arroba")).toBe(false);
  });
});
