import { createHmac } from "node:crypto";

// OTP do representante (ADR-0025). Reaproveita os helpers PUROS do admin
// (geracao, expiracao, tentativas — independentes de secret) e adiciona o hash
// e o dev-bypass ligados ao REP_SESSION_SECRET, para que o codigo do rep nunca
// dependa do secret do admin.
export {
  generateOtpCode,
  otpExpiresAt,
  isOtpExpired,
  hasAttemptsLeft,
  OTP_CONSTANTS,
} from "@/lib/admin/otp";

export function hashRepOtpCode(code: string): string {
  const secret = process.env.REP_SESSION_SECRET;
  if (!secret) {
    throw new Error("REP_SESSION_SECRET is not configured");
  }
  return createHmac("sha256", secret).update(code).digest("hex");
}

export function isRepDevBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    !!process.env.REP_OTP_DEV_BYPASS_CODE
  );
}

export function getRepDevBypassCode(): string | null {
  if (!isRepDevBypassEnabled()) return null;
  return process.env.REP_OTP_DEV_BYPASS_CODE ?? null;
}
