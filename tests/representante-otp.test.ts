import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateOtpCode,
  getRepDevBypassCode,
  hasAttemptsLeft,
  hashRepOtpCode,
  isOtpExpired,
  isRepDevBypassEnabled,
  otpExpiresAt,
  OTP_CONSTANTS,
} from "@/lib/representante/otp";

const ORIGINAL_SECRET = process.env.REP_SESSION_SECRET;

describe("representante otp", () => {
  beforeEach(() => {
    process.env.REP_SESSION_SECRET = "rep-test-secret-min-32-chars-aaaaaa";
  });

  afterEach(() => {
    process.env.REP_SESSION_SECRET = ORIGINAL_SECRET;
    vi.unstubAllEnvs();
  });

  it("generateOtpCode produces 6 digits", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it("hashRepOtpCode is deterministic and depends on REP_SESSION_SECRET", () => {
    const a = hashRepOtpCode("123456");
    expect(hashRepOtpCode("123456")).toBe(a);
    process.env.REP_SESSION_SECRET = "rep-different-secret-32-chars-bbbb";
    expect(hashRepOtpCode("123456")).not.toBe(a);
  });

  it("hashRepOtpCode is isolated from the admin secret", () => {
    // Mesmo codigo, secrets diferentes -> hashes diferentes. Garante que o OTP
    // do rep nao valida com o hash do admin e vice-versa.
    process.env.REP_SESSION_SECRET = "rep-secret-32-chars-xxxxxxxxxxxxxx";
    const repHash = hashRepOtpCode("654321");
    process.env.REP_SESSION_SECRET = "admin-secret-32-chars-yyyyyyyyyyyy";
    expect(hashRepOtpCode("654321")).not.toBe(repHash);
  });

  it("hashRepOtpCode throws without REP_SESSION_SECRET", () => {
    delete process.env.REP_SESSION_SECRET;
    expect(() => hashRepOtpCode("000000")).toThrow();
  });

  it("reuses the pure expiry/attempts helpers", () => {
    const now = new Date("2026-07-18T10:00:00Z");
    expect(otpExpiresAt(now).getTime() - now.getTime()).toBe(OTP_CONSTANTS.TTL_MS);
    expect(isOtpExpired(new Date(now.getTime() - 1000), now)).toBe(true);
    expect(isOtpExpired(new Date(now.getTime() + 1000), now)).toBe(false);
    expect(hasAttemptsLeft(OTP_CONSTANTS.MAX_ATTEMPTS - 1)).toBe(true);
    expect(hasAttemptsLeft(OTP_CONSTANTS.MAX_ATTEMPTS)).toBe(false);
  });

  it("dev bypass only in non-production with code set", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REP_OTP_DEV_BYPASS_CODE", "111111");
    expect(isRepDevBypassEnabled()).toBe(true);
    expect(getRepDevBypassCode()).toBe("111111");

    vi.stubEnv("NODE_ENV", "production");
    expect(isRepDevBypassEnabled()).toBe(false);
    expect(getRepDevBypassCode()).toBeNull();

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REP_OTP_DEV_BYPASS_CODE", "");
    expect(isRepDevBypassEnabled()).toBe(false);
    expect(getRepDevBypassCode()).toBeNull();
  });
});
