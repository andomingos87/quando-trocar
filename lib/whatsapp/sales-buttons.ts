import type { SalesButton } from "./types";

// Registro ÚNICO dos reply buttons do bot (Cloud API: máx. 3 reply buttons,
// title ≤ 20 chars, id ≤ 256 chars). O clique vira um `button_reply.id`
// determinístico que o payload troca pela mensagem canônica — o intent resolve
// sem LLM (invariante da fase CV3/QTR-12, mantida no QTR-35 P1-8).

// Fallback nível 2 do agente de vendas (fase CV3, QTR-12). Substitui o menu de
// texto `FALLBACK_VARIATIONS[1]`. Racional de escolha (o menu antigo tinha 4
// opções; a API só permite 3): as três que mais movem o funil — entender o
// produto, o "quanto custa" (que cai no trilho de preço da ADR-0012) e ativar
// o teste. "Falar com o Anderson" fica de fora aqui: o pedido de humano já é
// detectado por texto (`quer_humano`) e o handoff automático em ≥7 fallbacks
// continua valendo.
export const SALES_FALLBACK_BUTTONS: ReadonlyArray<SalesButton> = [
  { id: "sales_fb_funcionamento", title: "Como funciona" },
  { id: "sales_fb_preco", title: "Quanto custa" },
  { id: "sales_fb_testar", title: "Quero testar" },
];

// Texto que acompanha os botões (corpo da mensagem interativa). Sem acento,
// no estilo das copies determinísticas do agente de vendas.
export const SALES_FALLBACK_BUTTONS_BODY =
  "Pra eu te ajudar melhor chefe, e so tocar numa opcao:";

// Degradação: quando o transporte não suporta botões (sender sem
// `sendInteractiveButtons`), o webhook envia este texto — espelha as opções.
export const SALES_FALLBACK_BUTTONS_TEXT =
  "Pra eu te ajudar melhor chefe, escolhe uma:\n- Como funciona\n- Quanto custa\n- Ja quero testar";

// QTR-35 P1-8: botões nos momentos de decisão do funil, não só como fallback
// de erro. Após o explicador, o próximo passo natural é testar ou perguntar o
// preço; após a resposta de preço, testar ou entender melhor. "Falar com o
// Anderson" entra nesses momentos porque é quando o lead decide. O corpo
// dessas mensagens é conteúdo CV1 — segue elegível à geração (decisão c do
// plano P1: `generationEligible` no AgentReply).
export const SALES_EXPLAINER_BUTTONS: ReadonlyArray<SalesButton> = [
  { id: "sales_fb_testar", title: "Quero testar" },
  { id: "sales_fb_preco", title: "Quanto custa" },
  { id: "sales_fb_humano", title: "Falar com o Anderson" },
];

export const SALES_PRICE_BUTTONS: ReadonlyArray<SalesButton> = [
  { id: "sales_fb_testar", title: "Quero testar" },
  { id: "sales_fb_funcionamento", title: "Como funciona" },
  { id: "sales_fb_humano", title: "Falar com o Anderson" },
];

// QTR-35 P1-8: card de confirmação de cadastro (ADR-0017) com botões — o toque
// vira "confirmar"/"corrigir", que o fluxo de confirmação do onboarding já
// trata deterministicamente (tokens afirmativos / entrada de correção).
export const ONBOARDING_CONFIRM_BUTTONS: ReadonlyArray<SalesButton> = [
  { id: "onb_confirmar", title: "Confirmar" },
  { id: "onb_corrigir", title: "Corrigir" },
];

// id do botão -> mensagem canônica. O texto retornado resolve de forma
// DETERMINÍSTICA (confidence ≥ 0.85 no classificador de vendas; tokens de
// confirmação/correção no onboarding) — nunca cai no classificador OpenAI:
// "como funciona" -> pergunta_funcionamento (0.86), "quanto custa" ->
// pergunta_preco (0.92), "quero testar" -> quer_testar (0.86), "quero falar
// com humano" -> quer_humano (0.92), "confirmar" -> token afirmativo do card,
// "corrigir" -> entrada determinística do fluxo de correção.
const BUTTON_ID_TO_CANONICAL_MESSAGE: Record<string, string> = {
  sales_fb_funcionamento: "como funciona",
  sales_fb_preco: "quanto custa",
  sales_fb_testar: "quero testar",
  sales_fb_humano: "quero falar com humano",
  onb_confirmar: "confirmar",
  onb_corrigir: "corrigir",
};

export function resolveButtonReplyId(id: string | null | undefined): string | null {
  if (!id) return null;
  return BUTTON_ID_TO_CANONICAL_MESSAGE[id] ?? null;
}
