import { createHmac, randomInt } from "node:crypto";

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
}

export function hashOtpCode(code: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return createHmac("sha256", secret).update(code).digest("hex");
}

export function otpExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_MS);
}

export function isOtpExpired(expiresAt: Date | string, now = new Date()): boolean {
  const ts = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return ts.getTime() <= now.getTime();
}

export function hasAttemptsLeft(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS;
}

export function isDevBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    !!process.env.ADMIN_OTP_DEV_BYPASS_CODE
  );
}

export function getDevBypassCode(): string | null {
  if (!isDevBypassEnabled()) return null;
  return process.env.ADMIN_OTP_DEV_BYPASS_CODE ?? null;
}

export const OTP_CONSTANTS = {
  LENGTH: OTP_LENGTH,
  TTL_MS: OTP_TTL_MS,
  MAX_ATTEMPTS,
};
