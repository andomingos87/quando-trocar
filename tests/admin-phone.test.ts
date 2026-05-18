import { describe, expect, it } from "vitest";
import { normalizePhoneToE164 } from "@/lib/admin/phone";

describe("normalizePhoneToE164", () => {
  it("preserves already E.164 number", () => {
    expect(normalizePhoneToE164("+5511945207618")).toEqual({
      ok: true,
      e164: "+5511945207618",
    });
  });

  it("prepends +55 for 11-digit BR mobile", () => {
    expect(normalizePhoneToE164("11945207618")).toEqual({
      ok: true,
      e164: "+5511945207618",
    });
  });

  it("prepends +55 for 10-digit BR fixed line", () => {
    expect(normalizePhoneToE164("1133334444")).toEqual({
      ok: true,
      e164: "+551133334444",
    });
  });

  it("prepends + when 55XXXXXXXXXXX without plus", () => {
    expect(normalizePhoneToE164("5511945207618")).toEqual({
      ok: true,
      e164: "+5511945207618",
    });
  });

  it("strips parentheses, spaces and hyphens", () => {
    expect(normalizePhoneToE164("(11) 94520-7618")).toEqual({
      ok: true,
      e164: "+5511945207618",
    });
  });

  it("rejects empty input", () => {
    expect(normalizePhoneToE164("")).toEqual({ ok: false, reason: "empty" });
    expect(normalizePhoneToE164("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects too short", () => {
    expect(normalizePhoneToE164("12345")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects too long", () => {
    expect(normalizePhoneToE164("+9999999999999999")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("rejects when first digit after + is zero", () => {
    expect(normalizePhoneToE164("+0123456789")).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });
});
