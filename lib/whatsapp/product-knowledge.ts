import type { FaqVendasRecord, ReplyGenerationKnowledge } from "./types";

// Fatos estaticos do produto para o modo respond (ADR-0022). Constante no
// codigo de proposito: versionavel junto do REPLY_GENERATOR_PROMPT_VERSION e
// testavel sem banco. A parte editavel sem deploy continua sendo a FAQ do
// banco (`faq_vendas`), que entra filtrada em buildOperationKnowledge.
// NUNCA incluir preco/valor/condicao comercial aqui — preco na operacao e
// handoff comercial (ADR-0012).
export const PRODUCT_FACTS = [
  "O Quando Trocar registra os servicos/trocas que a oficina faz e lembra o",
  "cliente final automaticamente, pelo WhatsApp, quando chega a hora de voltar",
  "(a cadencia depende do tipo de servico; o padrao da oficina pode ser",
  "ajustado no painel).",
  "Para registrar uma troca, a oficina manda em uma mensagem: nome do cliente,",
  "carro, servico, data e WhatsApp do cliente. Ex.: Joao Silva, Civic 2018,",
  "troca de oleo, hoje, 41999990000.",
  "Antes de gravar, o bot mostra um resumo e pede confirmacao ('sim'); depois",
  "de confirmado, o cliente final recebe um aviso de que o servico foi",
  "registrado (quando autorizou receber mensagens).",
  "A oficina pode corrigir qualquer campo antes de confirmar (ex.: 'o carro e",
  "Gol').",
  "Comandos: enviar /suporte fala com o suporte; /voltar retorna ao modo",
  "normal de registro.",
  "O bot nao agenda nem confirma horario — agendamento e direto entre oficina",
  "e cliente.",
].join(" ");

// FAQ de vendas contem condicao comercial (preco, teste gratis etc.) que nao
// deve vazar para a conversa de operacao. Filtro fail-safe por regex sobre
// pergunta+resposta antes de entrar no conhecimento.
const PRICE_FAQ_PATTERN = /r\$|pre[cç]|custa|valor|mensalidade|plano|assinatura/i;

export function buildOperationKnowledge(input: {
  faqs: FaqVendasRecord[];
  handoffLink: string | null;
  workshopName: string | null;
}): ReplyGenerationKnowledge {
  return {
    productFacts: PRODUCT_FACTS,
    faqs: input.faqs
      .filter((faq) => !PRICE_FAQ_PATTERN.test(`${faq.pergunta} ${faq.resposta}`))
      .map((faq) => ({ pergunta: faq.pergunta, resposta: faq.resposta })),
    workshopName: input.workshopName,
    handoffLink: input.handoffLink,
  };
}
