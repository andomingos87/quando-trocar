// Confirmação enviada ao cliente final quando a oficina registra um serviço.
// O cliente final é sempre um número "frio" (nunca iniciou conversa com o bot),
// então o envio cai fora da janela de 24h e tem que ser via template aprovado
// pela Meta (ADR-0005). O template `confirmacao_servico` precisa estar aprovado
// na Meta antes do uso — ver docs/runbooks/meta-whatsapp-setup.md.

export const SERVICE_CONFIRMATION_TEMPLATE = {
  name: process.env.WHATSAPP_CONFIRMACAO_TEMPLATE ?? "confirmacao_servico",
  language: process.env.WHATSAPP_CONFIRMACAO_TEMPLATE_LANGUAGE ?? "pt_BR",
};

type ServiceConfirmationInput = {
  customerName: string;
  workshopName: string;
  vehicleDescription: string;
};

// Parâmetros do corpo do template, na ordem {{1}} {{2}} {{3}}.
export function serviceConfirmationParams(
  input: ServiceConfirmationInput,
): string[] {
  return [input.customerName, input.workshopName, input.vehicleDescription];
}

// Texto humano equivalente ao template, gravado em `outbound_messages.body`
// para auditoria/painel (o envio real usa o template aprovado).
export function renderServiceConfirmation(
  input: ServiceConfirmationInput,
): string {
  return `Oi ${input.customerName}! Aqui e da ${input.workshopName}. Registramos o servico do seu ${input.vehicleDescription} e vamos te avisar quando estiver perto da proxima troca. Se precisar, e so responder por aqui.`;
}
