// Normalizacao dos campos crus da RFB para o formato persistivel.

import { normalizePhoneToE164 } from "@/lib/admin/phone";
import type {
  EstabelecimentoNormalizado,
  EstabelecimentoRfb,
  EmpresaRfb,
} from "./types";

/** Sufixos societarios e ruido que nao ajudam a identificar o estabelecimento. */
const SUFIXOS_SOCIETARIOS =
  /\b(ltda|me|epp|eireli|s\/?a|sa|mei|cia|companhia|sociedade|unipessoal|em recuperacao judicial)\b/g;

/**
 * MEI e empresario individual nao tem razao social propria: a RFB monta uma
 * concatenando a raiz do CNPJ com o nome da pessoa — "67.932.818 LUAN VICTOR AZEVEDO".
 * O prefixo numerico e ruido na tela do vendedor e polui o dedupe por nome.
 *
 * O padrao exige os 8 digitos com a pontuacao de CNPJ, entao nome que legitimamente
 * comeca com numero ("24 HORAS AUTO CENTER") nao e afetado.
 */
const PREFIXO_CNPJ_EM_RAZAO_SOCIAL = /^\d{2}\.?\d{3}\.?\d{3}[\s/-]+/;

export function limparRazaoSocial(razao: string | null | undefined): string | null {
  if (!razao) return null;
  const limpa = razao.replace(PREFIXO_CNPJ_EM_RAZAO_SOCIAL, "").trim();
  return limpa || razao.trim() || null;
}

/**
 * Nome canonico: chave do dedupe fuzzy.
 * "AUTO CENTER SÃO JOÃO LTDA - ME" e "Auto Center Sao Joao" viram a mesma coisa.
 */
export function canonicalizarNome(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const canonico = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(SUFIXOS_SOCIETARIOS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return canonico || null;
}

/**
 * Junta DDD + numero da RFB em E.164, restaurando o nono digito quando falta.
 *
 * A base da RFB e anterior ao nono digito e nunca foi migrada: em Guarulhos, ZERO dos
 * telefones cadastrados tem 9 digitos. Gravar como veio produz numero que nao existe
 * mais — e sem o nono digito nao ha WhatsApp, que e o canal do produto.
 *
 * A regra do plano de numeracao brasileiro resolve sem ambiguidade: numero local de 8
 * digitos iniciado em 6-9 e movel da era pre-2016 e recebe o "9"; iniciado em 2-5 e
 * fixo e fica como esta.
 */
export function normalizarTelefoneRfb(
  ddd: string | null | undefined,
  numero: string | null | undefined,
): { e164: string | null; movel: boolean | null; nonoDigitoInferido: boolean } {
  const vazio = { e164: null, movel: null, nonoDigitoInferido: false };

  const dddLimpo = (ddd ?? "").replace(/\D+/g, "");
  const numeroLimpo = (numero ?? "").replace(/\D+/g, "");

  if (!dddLimpo || !numeroLimpo) return vazio;
  if (dddLimpo.length !== 2) return vazio;
  if (numeroLimpo.length < 8 || numeroLimpo.length > 9) return vazio;

  let local = numeroLimpo;
  let movel: boolean;
  let nonoDigitoInferido = false;

  if (local.length === 9) {
    // Com 9 digitos, movel sempre comeca em 9. Qualquer outra coisa e cadastro torto.
    movel = local.startsWith("9");
  } else if (/^[6-9]/.test(local)) {
    local = `9${local}`;
    movel = true;
    nonoDigitoInferido = true;
  } else {
    movel = false;
  }

  const resultado = normalizePhoneToE164(`${dddLimpo}${local}`);
  if (!resultado.ok) return vazio;

  return { e164: resultado.e164, movel, nonoDigitoInferido };
}

/** CEP da RFB vem com 8 digitos sem mascara; devolve 00000-000 ou null. */
export function normalizarCep(cep: string | null | undefined): string | null {
  const digitos = (cep ?? "").replace(/\D+/g, "");
  if (digitos.length !== 8) return null;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

/** "RUA" + "DAS FLORES" -> "Rua das Flores". */
export function montarLogradouro(
  tipo: string | null | undefined,
  nome: string | null | undefined,
): string | null {
  const partes = [tipo, nome].map((p) => (p ?? "").trim()).filter(Boolean);
  if (partes.length === 0) return null;
  return partes.join(" ");
}

/**
 * Monta o registro persistivel.
 *
 * `cidade` vem de fora (da area de prospeccao) porque a RFB guarda so o codigo do
 * municipio na linha do estabelecimento — o nome mora em outra tabela.
 */
export function normalizarEstabelecimento(
  bruto: EstabelecimentoRfb,
  contexto: { cidade: string; uf: string; empresa?: EmpresaRfb | null },
): EstabelecimentoNormalizado {
  const telefone1 = normalizarTelefoneRfb(bruto.ddd1, bruto.telefone1);
  const telefone2 = normalizarTelefoneRfb(bruto.ddd2, bruto.telefone2);

  // Celular na frente: e o que viabiliza WhatsApp. Se o secundario for movel e o
  // primario nao, vale mais como contato principal.
  const primario = telefone1.e164 && !telefone1.movel && telefone2.movel ? telefone2 : telefone1;
  const secundario = primario === telefone1 ? telefone2 : telefone1;

  const razaoSocial = limparRazaoSocial(contexto.empresa?.razaoSocial);
  const nomeFantasia = bruto.nomeFantasia;

  return {
    cnpj: bruto.cnpj,
    fontes: ["rfb"],
    razaoSocial,
    nomeFantasia,
    nomeCanonico: canonicalizarNome(nomeFantasia ?? razaoSocial),
    cnaePrincipal: bruto.cnaePrincipal,
    cnaesSecundarios: bruto.cnaesSecundarios,
    situacaoCadastral: bruto.situacaoCadastral,
    dataAbertura: bruto.dataInicioAtividade,
    porte: contexto.empresa?.porte ?? null,
    matrizFilial: bruto.matrizFilial,
    logradouro: montarLogradouro(bruto.tipoLogradouro, bruto.logradouro),
    numero: bruto.numero,
    complemento: bruto.complemento,
    bairro: bruto.bairro,
    cidade: contexto.cidade,
    uf: bruto.uf ?? contexto.uf,
    cep: normalizarCep(bruto.cep),
    email: bruto.email,
    telefoneE164: primario.e164,
    telefoneSecundarioE164: secundario.e164 === primario.e164 ? null : secundario.e164,
    telefoneMovel: primario.movel,
  };
}
