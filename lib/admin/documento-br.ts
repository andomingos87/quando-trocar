/**
 * Documentos e contato brasileiros (CPF/CNPJ, CEP, e-mail).
 *
 * Usado tanto no cliente (mascaras ao digitar) quanto no servidor (validacao
 * antes de gravar). Puro, sem dependencias — pode rodar nos dois lados.
 */

export function onlyDigits(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

// ---------------------------------------------------------------------------
// CPF / CNPJ
// ---------------------------------------------------------------------------

/** Aplica a mascara conforme a quantidade de digitos (CPF ate 11, CNPJ ate 14). */
export function formatCpfCnpj(input: string): string {
  const d = onlyDigits(input).slice(0, 14);
  if (d.length <= 11) {
    // 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  // 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // todos iguais
  const nums = digits.split("").map(Number);
  const check = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += nums[i] * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === nums[9] && check(10) === nums[10];
}

function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const nums = digits.split("").map(Number);
  const check = (len: number): number => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += nums[i] * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === nums[12] && check(13) === nums[13];
}

/** Valida CPF (11) ou CNPJ (14) por digitos verificadores. */
export function isValidCpfCnpj(input: string): boolean {
  const d = onlyDigits(input);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

// ---------------------------------------------------------------------------
// CEP
// ---------------------------------------------------------------------------

/** Mascara 00000-000. */
export function formatCep(input: string): string {
  const d = onlyDigits(input).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function isValidCep(input: string): boolean {
  return onlyDigits(input).length === 8;
}

// ---------------------------------------------------------------------------
// UF
// ---------------------------------------------------------------------------

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

export type UF = (typeof UF_LIST)[number];

export function isValidUf(input: string): boolean {
  return (UF_LIST as readonly string[]).includes(input.trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// E-mail (validacao simples, suficiente para cadastro)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim());
}
