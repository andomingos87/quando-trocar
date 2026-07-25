const SERVICE_PATTERN =
  /\b(troca|oleo|óleo|revisao|revisão|filtro|pastilha|freio|alinhamento|balanceamento|servico|serviço|amortecedor)\b/;

function normalizeForSignal(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractRegistrationPhone(message: string) {
  const matches = [...message.matchAll(/(?:\+?\d[\d\s().-]{8,}\d)/g)]
    .map((match) => match[0])
    .filter((value) => value.replace(/\D/g, "").length >= 10);

  return matches.at(-1) ?? null;
}

/**
 * Sinal determinístico de que a oficina já está tentando registrar uma troca.
 * Ele não extrai nem grava nenhum dado: só desvia o lead para a conversão
 * guiada, mantendo a confirmação humana da ADR-0017 como único gate de escrita.
 */
export function hasRegistrationSignal(message: string) {
  const normalized = normalizeForSignal(message);
  const commaCount = (message.match(/,/g) ?? []).length;
  const hasPhone = extractRegistrationPhone(message) !== null;
  const hasService = SERVICE_PATTERN.test(normalized);

  return (commaCount >= 2 && (hasPhone || hasService)) || (hasPhone && hasService);
}
