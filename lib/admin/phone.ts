const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;

export type PhoneNormalizationResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "empty" | "invalid_format" };

export function normalizePhoneToE164(input: string): PhoneNormalizationResult {
  if (!input) return { ok: false, reason: "empty" };

  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return { ok: false, reason: "invalid_format" };

  let candidate: string;
  if (hasPlus) {
    candidate = `+${digits}`;
  } else if (digits.length === 10 || digits.length === 11) {
    candidate = `+55${digits}`;
  } else if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    candidate = `+${digits}`;
  } else {
    candidate = `+${digits}`;
  }

  if (!E164_REGEX.test(candidate)) {
    return { ok: false, reason: "invalid_format" };
  }

  return { ok: true, e164: candidate };
}

export function isValidE164(value: string): boolean {
  return E164_REGEX.test(value);
}
