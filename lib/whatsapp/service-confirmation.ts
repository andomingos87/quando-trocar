// Confirmação enviada ao cliente final quando a oficina registra um serviço.
// O cliente final é sempre um número "frio" (nunca iniciou conversa com o bot),
// então o envio cai fora da janela de 24h e tem que ser via template aprovado
// pela Meta (ADR-0005). O template `confirmacao_servico` precisa estar aprovado
// na Meta antes do uso — ver docs/runbooks/meta-whatsapp-setup.md.
//
// O template usa VARIÁVEIS NOMEADAS (não posicionais): {{nome}}, {{produto}},
// {{carro}}, {{oficina}}. A ordem de `buildServiceConfirmationParams` casa 1:1
// com `SERVICE_CONFIRMATION_PARAM_NAMES`.
//
// QTR-35 P0-2: esta é a ÚLTIMA barreira antes da mensagem que o cliente da
// oficina lê. Nenhum texto livre da oficina (fala transcrita, descrição de
// serviço) pode virar parâmetro de template — nem via `{{produto}}`, nem via
// `{{carro}}`/`{{nome}}`, que também saem do que a oficina ditou.

import type { TipoServico } from "./types";

export const SERVICE_CONFIRMATION_TEMPLATE = {
  name: process.env.WHATSAPP_CONFIRMACAO_TEMPLATE ?? "confirmacao_servico",
  language: process.env.WHATSAPP_CONFIRMACAO_TEMPLATE_LANGUAGE ?? "pt_BR",
};

// Nomes das variáveis do template, na ordem de `buildServiceConfirmationParams`.
export const SERVICE_CONFIRMATION_PARAM_NAMES = [
  "nome",
  "produto",
  "carro",
  "oficina",
] as const;

export type ServiceConfirmationParamName =
  (typeof SERVICE_CONFIRMATION_PARAM_NAMES)[number];

type ServiceConfirmationInput = {
  customerName: string;
  workshopName: string;
  vehicleDescription: string;
  productLabel: string;
};

// Substantivo do produto usado na frase "Registramos a troca de {{produto}}".
// Mapa EXAUSTIVO e fechado: um `tipo_servico` novo quebra o build (o `satisfies`
// abaixo) em vez de cair num `default` que vaza texto livre da oficina.
//
// O rótulo vive aqui, e não em `tipos_servico_default.label`, de propósito:
// aquele campo é editável no admin (hoje vale "Revisao", sem acento) e um
// parâmetro de template não pode depender de texto editável.
const PRODUCT_LABEL_BY_TIPO = {
  troca_oleo: "óleo",
  amortecedor: "amortecedor",
  revisao: "revisão",
  // "outro" descreve serviço, não peça trocável: rótulo genérico seguro.
  outro: "revisão",
} satisfies Record<TipoServico, string>;

export function productLabelForConfirmation(input: {
  tipoServico: TipoServico;
}): string {
  return PRODUCT_LABEL_BY_TIPO[input.tipoServico];
}

// Limite por parâmetro. Curto de propósito: estes valores entram numa frase
// pronta ("Registramos a troca de X do seu carro: Y"), então qualquer coisa
// longa é sinal de que uma frase inteira escapou da extração (QTR-35 P0-1).
const PARAM_MAX_LENGTH: Record<ServiceConfirmationParamName, number> = {
  nome: 60,
  produto: 40,
  carro: 40,
  oficina: 60,
};

// A Cloud API rejeita parâmetro com newline/tab e com 4+ espaços seguidos
// (erro 132000/131008). Normalizamos antes de sequer tentar enviar.
export function sanitizeTemplateParam(
  value: string | null | undefined,
  options: { maxLength: number },
): string | null {
  if (!value) return null;
  const collapsed = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!collapsed) return null;
  if (collapsed.length > options.maxLength) return null;
  return collapsed;
}

export type ServiceConfirmationParamsResult =
  | { ok: true; params: string[] }
  | { ok: false; invalidParam: ServiceConfirmationParamName };

// Valores do corpo, na ordem de SERVICE_CONFIRMATION_PARAM_NAMES. Devolve o
// campo culpado quando algum valor não sobrevive à sanitização — não mandar é
// sempre melhor que mandar texto sujo para o cliente da oficina.
export function buildServiceConfirmationParams(
  input: ServiceConfirmationInput,
): ServiceConfirmationParamsResult {
  const raw: Record<ServiceConfirmationParamName, string> = {
    nome: input.customerName,
    produto: input.productLabel,
    carro: input.vehicleDescription,
    oficina: input.workshopName,
  };

  const params: string[] = [];
  for (const name of SERVICE_CONFIRMATION_PARAM_NAMES) {
    const sanitized = sanitizeTemplateParam(raw[name], {
      maxLength: PARAM_MAX_LENGTH[name],
    });
    if (sanitized === null) {
      return { ok: false, invalidParam: name };
    }
    params.push(sanitized);
  }

  return { ok: true, params };
}

// Texto humano equivalente ao template, gravado em `outbound_messages.body`
// para auditoria/painel (o envio real usa o template aprovado).
export function renderServiceConfirmation(
  input: ServiceConfirmationInput,
): string {
  return [
    `Oi ${input.customerName}! Aqui é da Quando Trocar 😃`,
    "",
    `Registramos a troca de ${input.productLabel} do seu carro: ${input.vehicleDescription}`,
    `No local: ${input.workshopName}`,
    "",
    `Vamos te avisar quando estiver perto da próxima troca. Precisa falar com a ${input.workshopName}? É só tocar no botão abaixo. 👇`,
  ].join("\n");
}
