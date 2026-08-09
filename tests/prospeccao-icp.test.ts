import { describe, expect, it } from "vitest";

import { classificarCnae, ehCandidatoIcp } from "@/lib/prospeccao/cnaes";
import {
  avaliarDuplicata,
  colapsarLote,
  similaridadeTrigrama,
} from "@/lib/prospeccao/dedupe";

describe("classificarCnae", () => {
  it("reconhece o nucleo do ICP", () => {
    expect(classificarCnae("4520001")).toBe("nucleo"); // mecanica
    expect(classificarCnae("4520005")).toBe("nucleo"); // lubrificacao (troca de oleo)
  });

  it("exclui comercio de veiculos", () => {
    expect(classificarCnae("4511101")).toBe("excluir");
  });

  it("aceita codigo com mascara", () => {
    expect(classificarCnae("4520-0/01")).toBe("nucleo");
  });

  it("trata desconhecido como neutro", () => {
    expect(classificarCnae("5611201")).toBe("neutro");
    expect(classificarCnae(null)).toBe("neutro");
  });
});

describe("ehCandidatoIcp", () => {
  it("aceita mecanica e troca de oleo", () => {
    expect(ehCandidatoIcp("4520001")).toBe(true);
    expect(ehCandidatoIcp("4520005")).toBe(true);
  });

  it("recusa concessionaria mesmo com mecanica no secundario", () => {
    // Quem vende carro nao e ICP: a oficina e do pos-venda da marca.
    expect(ehCandidatoIcp("4511101", ["4520001"])).toBe(false);
  });

  it("aceita auto pecas que tambem faz servico", () => {
    expect(ehCandidatoIcp("4530703")).toBe(true);
  });

  it("recusa borracharia pura mas aceita borracharia com alinhamento", () => {
    expect(ehCandidatoIcp("4520006")).toBe(false);
    expect(ehCandidatoIcp("4520006", ["4520004"])).toBe(true);
  });

  it("aceita posto de combustivel que faz troca de oleo", () => {
    expect(ehCandidatoIcp("4731800", ["4520005"])).toBe(true);
  });

  it("recusa quem so mantem a propria frota", () => {
    // Transportadora, estacionamento e despachante com mecanica no secundario cuidam
    // dos proprios veiculos: nao ha cliente final para lembrar, logo nao ha produto.
    expect(ehCandidatoIcp("4930201", ["4520001"])).toBe(false); // transporte de carga
    expect(ehCandidatoIcp("5223100", ["4520001"])).toBe(false); // estacionamento
    expect(ehCandidatoIcp("4923002", ["4520001"])).toBe(false); // taxi
    expect(ehCandidatoIcp("4321500", ["4520003"])).toBe(false); // instalacao eletrica predial
  });

  it("recusa CNAE fora do dominio sem secundario relevante", () => {
    expect(ehCandidatoIcp("5611201", ["5620104"])).toBe(false);
  });
});

describe("similaridadeTrigrama", () => {
  it("da 1 para identicos", () => {
    expect(similaridadeTrigrama("auto center sao joao", "auto center sao joao")).toBe(1);
  });

  it("pontua alto para variacoes do mesmo nome", () => {
    expect(similaridadeTrigrama("auto center sao joao", "auto center sao joao ii")).toBeGreaterThan(
      0.7,
    );
  });

  it("pontua baixo para nomes diferentes", () => {
    expect(similaridadeTrigrama("auto center sao joao", "mecanica do ze")).toBeLessThan(0.2);
  });

  it("devolve 0 quando falta um lado", () => {
    expect(similaridadeTrigrama(null, "auto center")).toBe(0);
  });
});

describe("avaliarDuplicata", () => {
  const existentes = [
    {
      id: "a",
      cnpj: "11111111000191",
      telefoneE164: "+5511988887777",
      nomeCanonico: "auto center sao joao",
      cep: "07025-000",
    },
  ];

  it("identifica duplicata por CNPJ", () => {
    const resultado = avaliarDuplicata({ id: "b", cnpj: "11111111000191" }, existentes);
    expect(resultado).toEqual({ tipo: "duplicado", de: "a", motivo: "cnpj" });
  });

  it("identifica duplicata por telefone", () => {
    const resultado = avaliarDuplicata(
      { id: "b", cnpj: "22222222000191", telefoneE164: "+5511988887777" },
      existentes,
    );
    expect(resultado).toEqual({ tipo: "duplicado", de: "a", motivo: "telefone" });
  });

  it("marca suspeita — nunca duplicata — para nome parecido no mesmo CEP", () => {
    // Dois "Auto Center Sao Joao" na mesma rua existem. Quem decide e humano.
    const resultado = avaliarDuplicata(
      {
        id: "b",
        cnpj: "22222222000191",
        nomeCanonico: "auto center sao joao ii",
        cep: "07025-000",
      },
      existentes,
    );
    expect(resultado.tipo).toBe("suspeita");
  });

  it("nao levanta suspeita em CEP diferente", () => {
    const resultado = avaliarDuplicata(
      { id: "b", nomeCanonico: "auto center sao joao", cep: "01000-000" },
      existentes,
    );
    expect(resultado).toEqual({ tipo: "novo" });
  });

  it("ignora o proprio registro", () => {
    expect(avaliarDuplicata(existentes[0], existentes)).toEqual({ tipo: "novo" });
  });

  it("devolve novo quando nada casa", () => {
    expect(avaliarDuplicata({ id: "b", cnpj: "33333333000191" }, existentes)).toEqual({
      tipo: "novo",
    });
  });
});

describe("colapsarLote", () => {
  it("colapsa filiais que repetem o telefone da matriz", () => {
    const { unicos, duplicados } = colapsarLote([
      { id: "1", cnpj: "11111111000191", telefoneE164: "+5511988887777" },
      { id: "2", cnpj: "11111111000272", telefoneE164: "+5511988887777" },
      { id: "3", cnpj: "22222222000191", telefoneE164: "+5511977776666" },
    ]);

    expect(unicos.map((u) => u.id)).toEqual(["1", "3"]);
    expect(duplicados).toHaveLength(1);
    expect(duplicados[0]).toMatchObject({ de: "1", motivo: "telefone" });
  });

  it("colapsa CNPJ repetido", () => {
    const { unicos, duplicados } = colapsarLote([
      { id: "1", cnpj: "11111111000191" },
      { id: "2", cnpj: "11111111000191" },
    ]);

    expect(unicos).toHaveLength(1);
    expect(duplicados[0]).toMatchObject({ motivo: "cnpj" });
  });

  it("nao colapsa registros sem chave em comum", () => {
    const { unicos } = colapsarLote([
      { id: "1", cnpj: null, telefoneE164: null },
      { id: "2", cnpj: null, telefoneE164: null },
    ]);

    expect(unicos).toHaveLength(2);
  });

  it("preserva a ordem de entrada", () => {
    const { unicos } = colapsarLote([
      { id: "1", cnpj: "11111111000191" },
      { id: "2", cnpj: "22222222000191" },
      { id: "3", cnpj: "33333333000191" },
    ]);

    expect(unicos.map((u) => u.id)).toEqual(["1", "2", "3"]);
  });
});
