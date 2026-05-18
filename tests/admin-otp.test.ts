import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateOtpCode,
  hashOtpCode,
  hasAttemptsLeft,
  isOtpExpired,
  otpExpiresAt,
  OTP_CONSTANTS,
} from "@/lib/admin/otp";

const ORIGINAL_SECRET = process.env.ADMIN_SESSION_SECRET;

describe("otp", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaa";
  });

  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET = ORIGINAL_SECRET;
  });

  it("generateOtpCode produces 6 digits", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("hashOtpCode is deterministic and depends on secret", () => {
    const a = hashOtpCode("123456");
    const b = hashOtpCode("123456");
    expect(a).toBe(b);
    process.env.ADMIN_SESSION_SECRET = "different-secret-32-chars-bbbbb";
    expect(hashOtpCode("123456")).not.toBe(a);
  });

  it("hashOtpCode produces different hashes for different codes", () => {
    expect(hashOtpCode("000000")).not.toBe(hashOtpCode("000001"));
  });

  it("otpExpiresAt returns 5 minutes from now", () => {
    const now = new Date("2026-05-17T10:00:00Z");
    const exp = otpExpiresAt(now);
    expect(exp.getTime() - now.getTime()).toBe(OTP_CONSTANTS.TTL_MS);
  });

  it("isOtpExpired flags past timestamps", () => {
    const now = new Date("2026-05-17T10:00:00Z");
    const past = new Date(now.getTime() - 1000);
    const future = new Date(now.getTime() + 1000);
    expect(isOtpExpired(past, now)).toBe(true);
    expect(isOtpExpired(future, now)).toBe(false);
  });

  it("hasAttemptsLeft uses MAX_ATTEMPTS bound", () => {
    expect(hasAttemptsLeft(0)).toBe(true);
    expect(hasAttemptsLeft(OTP_CONSTANTS.MAX_ATTEMPTS - 1)).toBe(true);
    expect(hasAttemptsLeft(OTP_CONSTANTS.MAX_ATTEMPTS)).toBe(false);
  });
});
