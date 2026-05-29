// Confirmação enviada ao cliente final quando a oficina registra um serviço.
// O cliente final é sempre um número "frio" (nunca iniciou conversa com o bot),
// então o envio cai fora da janela de 24h e tem que ser via template aprovado
// pela Meta (ADR-0005). O template `confirmacao_servico` precisa estar aprovado
// na Meta antes do uso — ver docs/runbooks/meta-whatsapp-setup.md.
//
// O template usa VARIÁVEIS NOMEADAS (não posicionais): {{nome}}, {{produto}},
// {{carro}}, {{oficina}}. A ordem de `serviceConfirmationParams` casa 1:1 com
// `SERVICE_CONFIRMATION_PARAM_NAMES`.

import type { TipoServico } from "./types";

export const SERVICE_CONFIRMATION_TEMPLATE = {
  name: process.env.WHATSAPP_CONFIRMACAO_TEMPLATE ?? "confirmacao_servico",
  language: process.env.WHATSAPP_CONFIRMACAO_TEMPLATE_LANGUAGE ?? "pt_BR",
};

// Nomes das variáveis do template, na mesma ordem de `serviceConfirmationParams`.
export const SERVICE_CONFIRMATION_PARAM_NAMES = [
  "nome",
  "produto",
  "carro",
  "oficina",
] as const;

type ServiceConfirmationInput = {
  customerName: string;
  workshopName: string;
  vehicleDescription: string;
  productLabel: string;
};

// Substantivo do produto usado na frase "Registramos a troca de {{produto}}".
// Tipos com substantivo natural usam o rótulo padronizado; revisão/outro caem
// no texto livre que a oficina digitou (a copy "troca de" é controlada — o
// admin sabe que esses tipos descrevem o serviço, não uma peça trocável).
export function productLabelForConfirmation(input: {
  tipoServico: TipoServico;
  servico: string;
}): string {
  switch (input.tipoServico) {
    case "troca_oleo":
      return "óleo";
    case "amortecedor":
      return "amortecedor";
    default:
      return input.servico;
  }
}

// Valores do corpo, na ordem de SERVICE_CONFIRMATION_PARAM_NAMES.
export function serviceConfirmationParams(
  input: ServiceConfirmationInput,
): string[] {
  return [
    input.customerName,
    input.productLabel,
    input.vehicleDescription,
    input.workshopName,
  ];
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
    "Vamos te avisar quando estiver perto da próxima troca. Se precisar de algo, é só responder por aqui.",
  ].join("\n");
}
