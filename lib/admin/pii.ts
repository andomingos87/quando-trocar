// Helpers de mascaramento PII para o painel admin (PRD §9.2).
// Sao usados quando admin visualiza dados de cliente final.

export function maskName(name: string | null | undefined): string {
  if (!name) return "—";
  const trimmed = name.trim();
  if (!trimmed) return "—";
  return `${trimmed[0]?.toUpperCase() ?? "?"}***`;
}

export function maskWhatsapp(whatsapp: string | null | undefined): string {
  if (!whatsapp) return "—";
  const digits = whatsapp.replace(/\D+/g, "");
  if (digits.length < 6) return "—";
  const last4 = digits.slice(-4);
  // Padrao "+55 11 ****-1234". Quando o numero nao for BR (55), mantemos
  // mascara generica para nao adivinhar formato.
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    return `+55 ${ddd} ****-${last4}`;
  }
  return `+${digits.slice(0, 2)} ****-${last4}`;
}

export function truncateMessage(
  body: string | null | undefined,
  max = 80,
): string {
  if (!body) return "";
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 3)}...`;
}
