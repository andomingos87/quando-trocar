import type { FaqVendasRecord, ReplyGenerationKnowledge } from "./types";

// Fatos estaticos do produto para o modo respond (ADR-0022). Constante no
// codigo de proposito: versionavel junto do REPLY_GENERATOR_PROMPT_VERSION e
// testavel sem banco. A parte editavel sem deploy continua sendo a FAQ do
// banco (`faq_vendas`), que entra filtrada nos builders abaixo.
// NUNCA incluir preco/valor/condicao comercial aqui — preco na operacao e
// handoff comercial (ADR-0012).
export const PRODUCT_FACTS = [
  "O Quando Trocar registra os servicos/trocas que a oficina faz e lembra o",
  "cliente final automaticamente, pelo WhatsApp, quando chega a hora de voltar.",
  // Cadencias: padrao de fabrica do seed `tipos_servico_default` (migration
  // 20260522000000), editavel pelo admin — por isso a redacao aproximada
  // ("cerca de"). Manter em sincronia se o seed mudar.
  "A cadencia do lembrete depende do tipo de servico — de fabrica: troca de",
  "oleo cerca de 90 dias, revisao e outros servicos cerca de 180 dias,",
  "amortecedor cerca de 2 anos — e a oficina pode ajustar esses prazos no",
  "painel.",
  "Para registrar uma troca, a oficina manda em uma mensagem: nome do cliente,",
  "carro, servico, data e WhatsApp do cliente. Ex.: Joao Silva, Civic 2018,",
  "troca de oleo, hoje, 41999990000.",
  "Antes de gravar, o bot mostra um resumo e pede confirmacao ('sim'); para",
  "corrigir qualquer campo antes de confirmar, basta mandar o valor certo",
  "(ex.: 'o carro e Gol').",
  "Depois de confirmado, o servico fica registrado, o lembrete e agendado pela",
  "cadencia e o cliente final recebe um aviso do registro (quando autorizou",
  "receber mensagens). Para corrigir um cadastro ja confirmado, o caminho e o",
  "/suporte.",
  "Comandos: enviar /suporte fala com o suporte; /voltar retorna ao modo",
  "normal de registro.",
  "O bot nao agenda nem confirma horario — agendamento e direto entre oficina",
  "e cliente.",
].join(" ");

// Fatos exclusivos da conversa de VENDAS (lead ainda nao e cliente). Nao
// entram na operacao: oferecer teste gratis a quem ja paga e bug de conversa.
// Continua valendo a proibicao de preco/condicao comercial (ADR-0012) — quem
// fecha valores e o humano.
export const SALES_FACTS = [
  "Da para testar gratis por 14 dias, sem compromisso.",
  "A ativacao e feita direto por esta conversa de WhatsApp — nao precisa",
  "instalar aplicativo nem acessar site.",
  "Depois de ativar, o proprio bot guia o primeiro cadastro de servico.",
  "Valores e condicoes comerciais quem fecha e o atendimento humano (contato",
  "comercial).",
].join(" ");

// FAQ de vendas contem condicao comercial (preco, mensalidade etc.) que nunca
// deve entrar no conhecimento do respond — nem em vendas, onde preco e trilho
// deterministico proprio (intent pergunta_preco). Filtro fail-safe por regex
// sobre pergunta+resposta.
const PRICE_FAQ_PATTERN = /r\$|pre[cç]|custa|valor|mensalidade|plano|assinatura/i;

function filterPriceFaqs(
  faqs: FaqVendasRecord[],
): Array<{ pergunta: string; resposta: string }> {
  return faqs
    .filter((faq) => !PRICE_FAQ_PATTERN.test(`${faq.pergunta} ${faq.resposta}`))
    .map((faq) => ({ pergunta: faq.pergunta, resposta: faq.resposta }));
}

export function buildOperationKnowledge(input: {
  faqs: FaqVendasRecord[];
  handoffLink: string | null;
  workshopName: string | null;
}): ReplyGenerationKnowledge {
  return {
    productFacts: PRODUCT_FACTS,
    faqs: filterPriceFaqs(input.faqs),
    workshopName: input.workshopName,
    handoffLink: input.handoffLink,
  };
}

// Conhecimento do respond em vendas (ADR-0024): fatos do produto + fatos de
// vendas. Sem workshopName — o interlocutor e um lead, nao uma oficina.
export function buildSalesKnowledge(input: {
  faqs: FaqVendasRecord[];
  handoffLink: string | null;
}): ReplyGenerationKnowledge {
  return {
    productFacts: `${PRODUCT_FACTS} ${SALES_FACTS}`,
    faqs: filterPriceFaqs(input.faqs),
    workshopName: null,
    handoffLink: input.handoffLink,
  };
}
