import { describe, expect, it } from "vitest";

import {
  canonicalizarNome,
  limparRazaoSocial,
  montarLogradouro,
  normalizarCep,
  normalizarEstabelecimento,
  normalizarTelefoneRfb,
} from "@/lib/prospeccao/normalize";
import type { EstabelecimentoRfb } from "@/lib/prospeccao/types";

function bruto(sobrescritas: Partial<EstabelecimentoRfb> = {}): EstabelecimentoRfb {
  return {
    cnpjBasico: "12345678",
    cnpjOrdem: "0001",
    cnpjDv: "95",
    cnpj: "12345678000195",
    matrizFilial: "matriz",
    nomeFantasia: "AUTO CENTER SÃO JOÃO",
    situacaoCadastral: "ativa",
    dataInicioAtividade: "2010-03-10",
    cnaePrincipal: "4520001",
    cnaesSecundarios: ["4520004"],
    tipoLogradouro: "RUA",
    logradouro: "DAS FLORES",
    numero: "1500",
    complemento: null,
    bairro: "VILA AUGUSTA",
    cep: "07025000",
    uf: "SP",
    codigoMunicipio: "6477",
    ddd1: "11",
    telefone1: "988887777",
    ddd2: null,
    telefone2: null,
    email: "contato@autocenter.com.br",
    ...sobrescritas,
  };
}

describe("canonicalizarNome", () => {
  it("remove acento, caixa e sufixo societario", () => {
    expect(canonicalizarNome("AUTO CENTER SÃO JOÃO LTDA - ME")).toBe("auto center sao joao");
  });

  it("faz variacoes do mesmo nome convergirem", () => {
    expect(canonicalizarNome("Mecânica do Zé EIRELI")).toBe(
      canonicalizarNome("MECANICA DO ZE  eireli"),
    );
  });

  it("nao engole palavra que contem sufixo como substring", () => {
    // "Some" contem "me"; so a palavra inteira e sufixo societario.
    expect(canonicalizarNome("Somerset Autos")).toBe("somerset autos");
  });

  it("devolve null para vazio", () => {
    expect(canonicalizarNome("")).toBeNull();
    expect(canonicalizarNome(null)).toBeNull();
  });
});

describe("limparRazaoSocial", () => {
  it("remove o CNPJ que a RFB cola na frente do nome do MEI", () => {
    expect(limparRazaoSocial("67.932.818 LUAN VICTOR MARCONDES FARIA DE AZEVEDO")).toBe(
      "LUAN VICTOR MARCONDES FARIA DE AZEVEDO",
    );
  });

  it("aceita a variacao sem pontuacao", () => {
    expect(limparRazaoSocial("67932818 THIAGO GABRIEL AMARO SILVA")).toBe(
      "THIAGO GABRIEL AMARO SILVA",
    );
  });

  it("preserva nome que legitimamente comeca com numero", () => {
    // "24 HORAS" nao tem os 8 digitos com pontuacao de CNPJ — nao pode ser cortado.
    expect(limparRazaoSocial("24 HORAS AUTO CENTER LTDA")).toBe("24 HORAS AUTO CENTER LTDA");
  });

  it("nao esvazia razao social composta so pelo prefixo", () => {
    expect(limparRazaoSocial("67.932.818")).toBe("67.932.818");
  });

  it("devolve null para vazio", () => {
    expect(limparRazaoSocial(null)).toBeNull();
    expect(limparRazaoSocial("")).toBeNull();
  });
});

describe("normalizarTelefoneRfb", () => {
  it("monta E.164 a partir de DDD + numero", () => {
    expect(normalizarTelefoneRfb("11", "988887777")).toEqual({
      e164: "+5511988887777",
      movel: true,
      nonoDigitoInferido: false,
    });
  });

  it("marca fixo como nao-movel", () => {
    expect(normalizarTelefoneRfb("11", "24445555")).toEqual({
      e164: "+551124445555",
      movel: false,
      nonoDigitoInferido: false,
    });
  });

  it("restaura o nono digito de movel legado", () => {
    // A base da RFB e pre-2016: em Guarulhos, ZERO telefones tem 9 digitos. Sem
    // essa restauracao o numero gravado nao existe mais e nao tem WhatsApp.
    expect(normalizarTelefoneRfb("11", "98191216")).toEqual({
      e164: "+5511998191216",
      movel: true,
      nonoDigitoInferido: true,
    });
  });

  it.each(["61234567", "71234567", "81234567", "91234567"])(
    "trata 8 digitos iniciados em 6-9 como movel legado (%s)",
    (numero) => {
      const resultado = normalizarTelefoneRfb("11", numero);
      expect(resultado.movel).toBe(true);
      expect(resultado.nonoDigitoInferido).toBe(true);
      expect(resultado.e164).toBe(`+55119${numero}`);
    },
  );

  it.each(["21234567", "31234567", "41234567", "51234567"])(
    "mantem 8 digitos iniciados em 2-5 como fixo (%s)",
    (numero) => {
      const resultado = normalizarTelefoneRfb("11", numero);
      expect(resultado.movel).toBe(false);
      expect(resultado.nonoDigitoInferido).toBe(false);
      expect(resultado.e164).toBe(`+5511${numero}`);
    },
  );

  it("nao mexe em numero que ja tem 9 digitos", () => {
    const resultado = normalizarTelefoneRfb("11", "912345678");
    expect(resultado.e164).toBe("+5511912345678");
    expect(resultado.nonoDigitoInferido).toBe(false);
  });

  it.each([
    ["", "988887777"],
    ["11", ""],
    ["1", "988887777"],
    ["011", "988887777"],
    ["11", "12345"],
    ["11", "1234567890"],
  ])("rejeita DDD=%s numero=%s", (ddd, numero) => {
    expect(normalizarTelefoneRfb(ddd, numero).e164).toBeNull();
  });
});

describe("normalizarCep", () => {
  it("formata 8 digitos", () => {
    expect(normalizarCep("07025000")).toBe("07025-000");
  });

  it("rejeita tamanho errado", () => {
    expect(normalizarCep("7025")).toBeNull();
    expect(normalizarCep(null)).toBeNull();
  });
});

describe("montarLogradouro", () => {
  it("junta tipo e nome", () => {
    expect(montarLogradouro("RUA", "DAS FLORES")).toBe("RUA DAS FLORES");
  });

  it("aceita so o nome", () => {
    expect(montarLogradouro(null, "DAS FLORES")).toBe("DAS FLORES");
  });

  it("devolve null quando nao ha nada", () => {
    expect(montarLogradouro(null, null)).toBeNull();
  });
});

describe("normalizarEstabelecimento", () => {
  it("monta o registro persistivel", () => {
    const item = normalizarEstabelecimento(bruto(), { cidade: "Guarulhos", uf: "SP" });

    expect(item.cnpj).toBe("12345678000195");
    expect(item.cidade).toBe("Guarulhos");
    expect(item.telefoneE164).toBe("+5511988887777");
    expect(item.telefoneMovel).toBe(true);
    expect(item.cep).toBe("07025-000");
    expect(item.logradouro).toBe("RUA DAS FLORES");
    expect(item.nomeCanonico).toBe("auto center sao joao");
    expect(item.fontes).toEqual(["rfb"]);
  });

  it("promove o celular a contato principal quando o primeiro e fixo", () => {
    // Quem tem celular e abordavel por WhatsApp; fixo, nao. A ordem importa.
    const item = normalizarEstabelecimento(
      bruto({ telefone1: "24445555", ddd2: "11", telefone2: "988887777" }),
      { cidade: "Guarulhos", uf: "SP" },
    );

    expect(item.telefoneE164).toBe("+5511988887777");
    expect(item.telefoneMovel).toBe(true);
    expect(item.telefoneSecundarioE164).toBe("+551124445555");
  });

  it("promove tambem o movel legado, ja com o nono digito", () => {
    // Caso dominante no dado real da RFB: fixo no campo 1, movel de 8 digitos no 2.
    const item = normalizarEstabelecimento(
      bruto({ telefone1: "24445555", ddd2: "11", telefone2: "98191216" }),
      { cidade: "Guarulhos", uf: "SP" },
    );

    expect(item.telefoneE164).toBe("+5511998191216");
    expect(item.telefoneMovel).toBe(true);
  });

  it("nao repete o mesmo numero no secundario", () => {
    const item = normalizarEstabelecimento(bruto({ ddd2: null, telefone2: null }), {
      cidade: "Guarulhos",
      uf: "SP",
    });

    expect(item.telefoneSecundarioE164).toBeNull();
  });

  it("usa razao social como nome canonico quando nao ha fantasia", () => {
    const item = normalizarEstabelecimento(bruto({ nomeFantasia: null }), {
      cidade: "Guarulhos",
      uf: "SP",
      empresa: { cnpjBasico: "12345678", razaoSocial: "JOAO DA SILVA AUTOMOTIVA LTDA", porte: "micro" },
    });

    expect(item.nomeCanonico).toBe("joao da silva automotiva");
    expect(item.porte).toBe("micro");
  });

  it("grava a razao social do MEI ja sem o CNPJ na frente", () => {
    const item = normalizarEstabelecimento(bruto({ nomeFantasia: null }), {
      cidade: "Guarulhos",
      uf: "SP",
      empresa: {
        cnpjBasico: "67932818",
        razaoSocial: "67.932.818 LUAN VICTOR MARCONDES",
        porte: "micro",
      },
    });

    expect(item.razaoSocial).toBe("LUAN VICTOR MARCONDES");
    expect(item.nomeCanonico).toBe("luan victor marcondes");
  });

  it("aceita estabelecimento sem telefone", () => {
    const item = normalizarEstabelecimento(bruto({ ddd1: null, telefone1: null }), {
      cidade: "Guarulhos",
      uf: "SP",
    });

    expect(item.telefoneE164).toBeNull();
    expect(item.telefoneMovel).toBeNull();
  });
});
