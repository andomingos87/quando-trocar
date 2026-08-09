import { describe, expect, it } from "vitest";

import {
  converterDataRfb,
  dividirLinhaCsv,
  mesmoMunicipio,
  montarCnpj,
  parsearLinhaEmpresa,
  parsearLinhaEstabelecimento,
} from "@/lib/prospeccao/rfb-parser";

/** Linha real do layout de Estabelecimentos: 30 colunas, aspas em tudo. */
function linhaEstabelecimento(sobrescritas: Partial<Record<number, string>> = {}): string {
  const campos = [
    "12345678", // 0  cnpj basico
    "0001", // 1  ordem
    "95", // 2  dv
    "1", // 3  matriz
    "AUTO CENTER SAO JOAO", // 4  nome fantasia
    "02", // 5  situacao (ativa)
    "20200115", // 6  data situacao
    "0", // 7  motivo
    "", // 8  cidade exterior
    "", // 9  pais
    "20100310", // 10 inicio atividade
    "4520001", // 11 cnae principal
    "4520004,4520005", // 12 cnaes secundarios
    "RUA", // 13 tipo logradouro
    "DAS FLORES", // 14 logradouro
    "1500", // 15 numero
    "GALPAO 2", // 16 complemento
    "VILA AUGUSTA", // 17 bairro
    "07025000", // 18 cep
    "SP", // 19 uf
    "6477", // 20 municipio
    "11", // 21 ddd 1
    "988887777", // 22 telefone 1
    "11", // 23 ddd 2
    "24445555", // 24 telefone 2
    "", // 25 ddd fax
    "", // 26 fax
    "CONTATO@AUTOCENTER.COM.BR", // 27 email
    "", // 28 situacao especial
    "", // 29 data situacao especial
  ];
  for (const [indice, valor] of Object.entries(sobrescritas)) {
    campos[Number(indice)] = valor as string;
  }
  return campos.map((c) => `"${c}"`).join(";");
}

describe("dividirLinhaCsv", () => {
  it("divide campos simples entre aspas", () => {
    expect(dividirLinhaCsv('"a";"b";"c"')).toEqual(["a", "b", "c"]);
  });

  it("preserva ponto e virgula dentro de aspas", () => {
    // Sem isso, uma razao social com ";" desalinha TODAS as colunas seguintes,
    // inclusive o municipio — que e o filtro da ingestao.
    expect(dividirLinhaCsv('"COMERCIO; SERVICOS LTDA";"SP"')).toEqual([
      "COMERCIO; SERVICOS LTDA",
      "SP",
    ]);
  });

  it("trata aspas escapadas", () => {
    expect(dividirLinhaCsv('"OFICINA ""DO ZE""";"SP"')).toEqual(['OFICINA "DO ZE"', "SP"]);
  });

  it("mantem campos vazios", () => {
    expect(dividirLinhaCsv('"a";"";"c"')).toEqual(["a", "", "c"]);
  });
});

describe("converterDataRfb", () => {
  it("converte AAAAMMDD para ISO", () => {
    expect(converterDataRfb("20100310")).toBe("2010-03-10");
  });

  it.each(["0", "00000000", "", null, undefined, "2010"])("devolve null para %s", (valor) => {
    expect(converterDataRfb(valor as string | null)).toBeNull();
  });

  it("rejeita mes invalido", () => {
    expect(converterDataRfb("20101310")).toBeNull();
  });
});

describe("montarCnpj", () => {
  it("concatena as tres partes com padding", () => {
    expect(montarCnpj("12345678", "1", "5")).toBe("12345678000105");
  });
});

describe("parsearLinhaEstabelecimento", () => {
  it("extrai os campos do layout", () => {
    const resultado = parsearLinhaEstabelecimento(linhaEstabelecimento());

    expect(resultado).not.toBeNull();
    expect(resultado?.cnpj).toBe("12345678000195");
    expect(resultado?.nomeFantasia).toBe("AUTO CENTER SAO JOAO");
    expect(resultado?.situacaoCadastral).toBe("ativa");
    expect(resultado?.matrizFilial).toBe("matriz");
    expect(resultado?.cnaePrincipal).toBe("4520001");
    expect(resultado?.cnaesSecundarios).toEqual(["4520004", "4520005"]);
    expect(resultado?.codigoMunicipio).toBe("6477");
    expect(resultado?.dataInicioAtividade).toBe("2010-03-10");
    expect(resultado?.email).toBe("contato@autocenter.com.br");
  });

  it("mapeia os codigos de situacao cadastral", () => {
    const baixada = parsearLinhaEstabelecimento(linhaEstabelecimento({ 5: "08" }));
    expect(baixada?.situacaoCadastral).toBe("baixada");

    const suspensa = parsearLinhaEstabelecimento(linhaEstabelecimento({ 5: "03" }));
    expect(suspensa?.situacaoCadastral).toBe("suspensa");
  });

  it("ignora secundarios malformados", () => {
    const resultado = parsearLinhaEstabelecimento(linhaEstabelecimento({ 12: "4520004,,abc,45" }));
    expect(resultado?.cnaesSecundarios).toEqual(["4520004"]);
  });

  it("rejeita linha curta em vez de ler coluna errada", () => {
    expect(parsearLinhaEstabelecimento('"1";"2";"3"')).toBeNull();
  });

  it("rejeita linha sem as partes do CNPJ", () => {
    expect(parsearLinhaEstabelecimento(linhaEstabelecimento({ 0: "" }))).toBeNull();
  });
});

describe("parsearLinhaEmpresa", () => {
  it("extrai razao social e porte", () => {
    const linha = '"12345678";"JOAO DA SILVA AUTOMOTIVA LTDA";"2062";"49";"50000,00";"01";""';
    const resultado = parsearLinhaEmpresa(linha);

    expect(resultado?.cnpjBasico).toBe("12345678");
    expect(resultado?.razaoSocial).toBe("JOAO DA SILVA AUTOMOTIVA LTDA");
    expect(resultado?.porte).toBe("micro");
  });
});

describe("mesmoMunicipio", () => {
  it("ignora zeros a esquerda dos dois lados", () => {
    expect(mesmoMunicipio("06477", "6477")).toBe(true);
    expect(mesmoMunicipio("6477", "06477")).toBe(true);
  });

  it("nao confunde municipios distintos", () => {
    expect(mesmoMunicipio("7107", "6477")).toBe(false);
  });

  it("devolve false para vazio", () => {
    expect(mesmoMunicipio(null, "6477")).toBe(false);
  });
});
