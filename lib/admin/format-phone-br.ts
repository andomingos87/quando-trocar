/**
 * Formats a Brazilian phone number for display.
 *
 * Accepts raw input (digits, masked text, or E.164) and returns:
 * - `(11) 90000-0000` for 11-digit numbers (cellular)
 * - `(11) 0000-0000` for 10-digit numbers (landline)
 * - partial mask while user is typing
 *
 * Always strips the country prefix (+55 / 55) before formatting — the +55 is
 * shown as a separate visual badge in the WhatsAppInput component.
 */
export function formatPhoneBR(input: string): string {
  if (!input) return "";

  let digits = input.replace(/\D+/g, "");

  // Strip country code if user pasted +55... or 55... (only when long enough)
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }

  // Cap at 11 digits (max for BR cellular: 2 area + 9 + 8)
  digits = digits.slice(0, 11);

  const len = digits.length;
  if (len === 0) return "";
  if (len <= 2) return `(${digits}`;
  if (len <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10) {
    // landline: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // cellular: (XX) XXXXX-XXXX
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Returns just the raw digits of a (possibly masked) phone string. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}
