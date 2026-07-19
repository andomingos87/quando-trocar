// CV7 — quebra de mensagem longa. Regra no sender (não no LLM): resposta acima
// de ~350 chars vira até 2 mensagens sequenciais, cortando numa fronteira
// natural (parágrafo > linha > frase > espaço) para não partir palavra/frase no
// meio. Cap de 2 mensagens (o card pede "2 mensagens"); a 2ª pode passar do
// limite, o que é aceitável (WhatsApp aceita até 4096 chars).

export const DEFAULT_SPLIT_THRESHOLD = 350;

// Fronteiras em ordem de preferência. Cada uma inclui o tamanho do separador
// para o corte cair logo depois dele.
const BOUNDARIES: Array<{ sep: string; keep: number }> = [
  { sep: "\n\n", keep: 0 },
  { sep: "\n", keep: 0 },
  { sep: ". ", keep: 1 },
  { sep: "! ", keep: 1 },
  { sep: "? ", keep: 1 },
  { sep: " ", keep: 0 },
];

export function splitLongMessage(
  body: string,
  maxLen: number = DEFAULT_SPLIT_THRESHOLD,
): string[] {
  const text = body ?? "";
  if (text.length <= maxLen) return [text];

  // Melhor ponto de corte <= maxLen, na fronteira mais "forte" disponível.
  let cut = -1;
  for (const { sep, keep } of BOUNDARIES) {
    const idx = text.lastIndexOf(sep, maxLen);
    if (idx > 0) {
      cut = idx + keep;
      break;
    }
  }
  // Nenhuma fronteira encontrada (texto sem espaços) → corte duro no limite.
  if (cut <= 0) cut = maxLen;

  const first = text.slice(0, cut).trim();
  const second = text.slice(cut).trim();
  if (second.length === 0) return [first];
  return [first, second];
}
