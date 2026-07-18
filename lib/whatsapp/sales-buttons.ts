import type { SalesButton } from "./types";

// Botões interativos (reply buttons) do fallback nível 2 do agente de vendas
// (fase CV3, QTR-12). Substituem o menu de texto `FALLBACK_VARIATIONS[1]`: o
// clique vira um `button_reply.id` determinístico, eliminando erro de
// classificação de texto livre. A Cloud API aceita no máximo 3 reply buttons
// (title ≤ 20 chars, id ≤ 256 chars) — mantenha esta lista em 3.
//
// Racional de escolha (menu antigo tinha 4 opções; a API só permite 3): as três
// que mais movem o funil — entender o produto, o "quanto custa" (que cai no
// trilho de preço da ADR-0012) e ativar o teste. "Falar com o Anderson" fica de
// fora do botão: o pedido de humano já é detectado por texto (`quer_humano`) e
// o handoff automático em ≥7 fallbacks continua valendo.
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

// id do botão -> mensagem canônica. O texto retornado classifica de forma
// DETERMINÍSTICA com confidence ≥ 0.85 em `classifySalesMessage` (nunca cai no
// classificador OpenAI): "como funciona" -> pergunta_funcionamento (0.86),
// "quanto custa" -> pergunta_preco (0.92), "quero testar" -> quer_testar (0.86).
// Assim "id determinístico -> intent direto, sem LLM" (plano CV3) é satisfeito
// reaproveitando o classificador existente, sem um canal paralelo de intent.
const BUTTON_ID_TO_CANONICAL_MESSAGE: Record<string, string> = {
  sales_fb_funcionamento: "como funciona",
  sales_fb_preco: "quanto custa",
  sales_fb_testar: "quero testar",
};

export function resolveSalesButtonReplyId(id: string | null | undefined): string | null {
  if (!id) return null;
  return BUTTON_ID_TO_CANONICAL_MESSAGE[id] ?? null;
}
