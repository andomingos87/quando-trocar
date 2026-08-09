// Parser dos arquivos de Dados Abertos do CNPJ (Receita Federal).
//
// Formato: CSV sem cabecalho, separador ";", campos entre aspas duplas,
// encoding latin-1 (ISO-8859-1), datas em AAAAMMDD e vazio representado por
// string vazia, "0" ou "00000000".
//
// Layout oficial: https://www.gov.br/receitafederal/dados/cnpj-metadados.pdf

import type {
  EmpresaRfb,
  EstabelecimentoRfb,
  MatrizFilial,
  PorteEmpresa,
  SituacaoCadastral,
} from "./types";

/** Colunas do arquivo Estabelecimentos, na ordem do layout da RFB. */
const COL = {
  CNPJ_BASICO: 0,
  CNPJ_ORDEM: 1,
  CNPJ_DV: 2,
  MATRIZ_FILIAL: 3,
  NOME_FANTASIA: 4,
  SITUACAO_CADASTRAL: 5,
  DATA_INICIO_ATIVIDADE: 10,
  CNAE_PRINCIPAL: 11,
  CNAE_SECUNDARIA: 12,
  TIPO_LOGRADOURO: 13,
  LOGRADOURO: 14,
  NUMERO: 15,
  COMPLEMENTO: 16,
  BAIRRO: 17,
  CEP: 18,
  UF: 19,
  MUNICIPIO: 20,
  DDD_1: 21,
  TELEFONE_1: 22,
  DDD_2: 23,
  TELEFONE_2: 24,
  EMAIL: 27,
} as const;

const COL_EMPRESA = {
  CNPJ_BASICO: 0,
  RAZAO_SOCIAL: 1,
  PORTE: 5,
} as const;

const SITUACOES: Record<string, SituacaoCadastral> = {
  "01": "nula",
  "02": "ativa",
  "03": "suspensa",
  "04": "inapta",
  "08": "baixada",
};

const PORTES: Record<string, PorteEmpresa> = {
  "00": "nao_informado",
  "01": "micro",
  "03": "pequeno",
  "05": "demais",
};

/**
 * Quebra uma linha no separador ";" respeitando aspas.
 *
 * Nao da para usar split(";"): razao social com ponto e virgula dentro existe
 * ("COMERCIO; SERVICOS LTDA") e quebraria o alinhamento de todas as colunas
 * seguintes — inclusive o municipio, que e justamente o filtro.
 */
export function dividirLinhaCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i += 1) {
    const char = linha[i];

    if (char === '"') {
      if (dentroDeAspas && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
      continue;
    }

    if (char === ";" && !dentroDeAspas) {
      campos.push(atual);
      atual = "";
      continue;
    }

    atual += char;
  }

  campos.push(atual);
  return campos;
}

function texto(campos: string[], indice: number): string | null {
  const valor = campos[indice]?.trim();
  if (!valor) return null;
  return valor;
}

/** AAAAMMDD -> AAAA-MM-DD. "0"/"00000000"/data invalida viram null. */
export function converterDataRfb(valor: string | null | undefined): string | null {
  const digitos = (valor ?? "").replace(/\D+/g, "");
  if (digitos.length !== 8) return null;

  const ano = Number(digitos.slice(0, 4));
  const mes = Number(digitos.slice(4, 6));
  const dia = Number(digitos.slice(6, 8));
  if (ano < 1900 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  return `${digitos.slice(0, 4)}-${digitos.slice(4, 6)}-${digitos.slice(6, 8)}`;
}

/** Digito verificador nao vem calculado: o CNPJ completo e a concatenacao das 3 partes. */
export function montarCnpj(basico: string, ordem: string, dv: string): string {
  return `${basico.padStart(8, "0")}${ordem.padStart(4, "0")}${dv.padStart(2, "0")}`;
}

export function parsearLinhaEstabelecimento(linha: string): EstabelecimentoRfb | null {
  const campos = dividirLinhaCsv(linha);
  // O layout tem 30 colunas. Linha mais curta e lixo (ou pre-filtro que pegou
  // uma linha partida) e nao da para confiar no alinhamento das colunas.
  if (campos.length < 28) return null;

  const cnpjBasico = texto(campos, COL.CNPJ_BASICO);
  const cnpjOrdem = texto(campos, COL.CNPJ_ORDEM);
  const cnpjDv = texto(campos, COL.CNPJ_DV);
  if (!cnpjBasico || !cnpjOrdem || !cnpjDv) return null;

  const matrizFilialRaw = texto(campos, COL.MATRIZ_FILIAL);
  const matrizFilial: MatrizFilial | null =
    matrizFilialRaw === "1" ? "matriz" : matrizFilialRaw === "2" ? "filial" : null;

  const secundariosRaw = texto(campos, COL.CNAE_SECUNDARIA) ?? "";
  const cnaesSecundarios = secundariosRaw
    .split(",")
    .map((c) => c.replace(/\D+/g, ""))
    .filter((c) => c.length === 7);

  return {
    cnpjBasico,
    cnpjOrdem,
    cnpjDv,
    cnpj: montarCnpj(cnpjBasico, cnpjOrdem, cnpjDv),
    matrizFilial,
    nomeFantasia: texto(campos, COL.NOME_FANTASIA),
    situacaoCadastral: SITUACOES[texto(campos, COL.SITUACAO_CADASTRAL) ?? ""] ?? null,
    dataInicioAtividade: converterDataRfb(texto(campos, COL.DATA_INICIO_ATIVIDADE)),
    cnaePrincipal: texto(campos, COL.CNAE_PRINCIPAL)?.replace(/\D+/g, "") || null,
    cnaesSecundarios,
    tipoLogradouro: texto(campos, COL.TIPO_LOGRADOURO),
    logradouro: texto(campos, COL.LOGRADOURO),
    numero: texto(campos, COL.NUMERO),
    complemento: texto(campos, COL.COMPLEMENTO),
    bairro: texto(campos, COL.BAIRRO),
    cep: texto(campos, COL.CEP),
    uf: texto(campos, COL.UF),
    codigoMunicipio: texto(campos, COL.MUNICIPIO)?.replace(/^0+/, "") || null,
    ddd1: texto(campos, COL.DDD_1),
    telefone1: texto(campos, COL.TELEFONE_1),
    ddd2: texto(campos, COL.DDD_2),
    telefone2: texto(campos, COL.TELEFONE_2),
    email: texto(campos, COL.EMAIL)?.toLowerCase() ?? null,
  };
}

export function parsearLinhaEmpresa(linha: string): EmpresaRfb | null {
  const campos = dividirLinhaCsv(linha);
  if (campos.length < 6) return null;

  const cnpjBasico = texto(campos, COL_EMPRESA.CNPJ_BASICO);
  if (!cnpjBasico) return null;

  return {
    cnpjBasico,
    razaoSocial: texto(campos, COL_EMPRESA.RAZAO_SOCIAL),
    porte: PORTES[texto(campos, COL_EMPRESA.PORTE) ?? ""] ?? null,
  };
}

/**
 * O codigo do municipio na RFB nao e o do IBGE, e vem com zeros a esquerda em
 * parte dos arquivos. Comparar sempre normalizado.
 */
export function mesmoMunicipio(
  codigoDoRegistro: string | null | undefined,
  codigoProcurado: string,
): boolean {
  if (!codigoDoRegistro) return false;
  return codigoDoRegistro.replace(/^0+/, "") === codigoProcurado.replace(/^0+/, "");
}
