// Contratos do modulo `prospeccao`.
// Plano tecnico: docs/architecture/prospeccao-icp-oficinas.md

/** Fonte de onde o estabelecimento veio. */
export type FonteProspeccao = "rfb" | "places";

/** Estados do pipeline (espelha o check em prospeccao_estabelecimentos.status). */
export type StatusEstabelecimento =
  | "descoberto"
  | "qualificado"
  | "descartado"
  | "aprovado"
  | "promovido"
  | "duplicado";

/** Situacao cadastral normalizada a partir do codigo da RFB. */
export type SituacaoCadastral = "nula" | "ativa" | "suspensa" | "inapta" | "baixada";

export type MatrizFilial = "matriz" | "filial";

/** Porte declarado na tabela Empresas da RFB. */
export type PorteEmpresa = "nao_informado" | "micro" | "pequeno" | "demais";

/**
 * Uma linha do arquivo de Estabelecimentos da RFB, ja tipada mas ainda crua:
 * codigos no formato original, telefone separado em DDD + numero.
 */
export type EstabelecimentoRfb = {
  cnpjBasico: string;
  cnpjOrdem: string;
  cnpjDv: string;
  cnpj: string;
  matrizFilial: MatrizFilial | null;
  nomeFantasia: string | null;
  situacaoCadastral: SituacaoCadastral | null;
  dataInicioAtividade: string | null; // ISO (AAAA-MM-DD)
  cnaePrincipal: string | null;
  cnaesSecundarios: string[];
  tipoLogradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string | null;
  codigoMunicipio: string | null;
  ddd1: string | null;
  telefone1: string | null;
  ddd2: string | null;
  telefone2: string | null;
  email: string | null;
};

/** Uma linha do arquivo de Empresas da RFB (enriquecimento por cnpjBasico). */
export type EmpresaRfb = {
  cnpjBasico: string;
  razaoSocial: string | null;
  porte: PorteEmpresa | null;
};

/**
 * Estabelecimento normalizado, pronto para persistir.
 * Espelha as colunas persistiveis de `prospeccao_estabelecimentos`.
 */
export type EstabelecimentoNormalizado = {
  cnpj: string;
  fontes: FonteProspeccao[];
  razaoSocial: string | null;
  nomeFantasia: string | null;
  nomeCanonico: string | null;
  cnaePrincipal: string | null;
  cnaesSecundarios: string[];
  situacaoCadastral: SituacaoCadastral | null;
  dataAbertura: string | null;
  porte: PorteEmpresa | null;
  matrizFilial: MatrizFilial | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string | null;
  email: string | null;
  telefoneE164: string | null;
  telefoneSecundarioE164: string | null;
  telefoneMovel: boolean | null;
};

export type AreaProspeccao = {
  id: string;
  cidade: string;
  uf: string;
  codigoMunicipioRfb: string | null;
};

/** Metricas de uma rodada de ingestao, gravadas em prospeccao_execucoes. */
export type MetricasIngestao = {
  linhasLidas: number;
  forteMunicipio: number;
  aptosPorCnae: number;
  semTelefone: number;
  descartadosSituacao: number;
  normalizados: number;
  duplicadosNoLote: number;
  inseridos: number;
  atualizados: number;
};
