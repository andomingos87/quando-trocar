import { describe, expect, it } from "vitest";

import { digitsOnly, formatPhoneBR } from "@/lib/admin/format-phone-br";

describe("formatPhoneBR", () => {
  it("returns empty for empty input", () => {
    expect(formatPhoneBR("")).toBe("");
  });

  it("opens area-code parenthesis after first 2 digits", () => {
    expect(formatPhoneBR("1")).toBe("(1");
    expect(formatPhoneBR("11")).toBe("(11");
  });

  it("formats partial numbers (after area code)", () => {
    expect(formatPhoneBR("119")).toBe("(11) 9");
    expect(formatPhoneBR("119000")).toBe("(11) 9000");
  });

  it("formats full Brazilian cellular number", () => {
    expect(formatPhoneBR("11900000000")).toBe("(11) 90000-0000");
  });

  it("formats Brazilian landline (10 digits)", () => {
    expect(formatPhoneBR("1130000000")).toBe("(11) 3000-0000");
  });

  it("strips non-digits", () => {
    expect(formatPhoneBR("(11) 90000-0000")).toBe("(11) 90000-0000");
    expect(formatPhoneBR("11 abc 9 - 0")).toBe("(11) 90");
  });

  it("strips country code when present (+55, 55)", () => {
    expect(formatPhoneBR("+5511900000000")).toBe("(11) 90000-0000");
    expect(formatPhoneBR("5511900000000")).toBe("(11) 90000-0000");
  });

  it("caps at 11 digits", () => {
    expect(formatPhoneBR("119000000001234")).toBe("(11) 90000-0000");
  });
});

describe("digitsOnly", () => {
  it("removes all non-digit chars", () => {
    expect(digitsOnly("(11) 90000-0000")).toBe("11900000000");
    expect(digitsOnly("+55 11 9 0000-0000")).toBe("5511900000000");
  });
});
