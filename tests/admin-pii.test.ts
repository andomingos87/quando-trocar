import { describe, expect, it } from "vitest";

import { maskName, maskWhatsapp, truncateMessage } from "@/lib/admin/pii";

describe("pii.maskName", () => {
  it("returns first letter + ***", () => {
    expect(maskName("Joao")).toBe("J***");
    expect(maskName("ana")).toBe("A***");
  });
  it("returns em-dash for empty/null", () => {
    expect(maskName(null)).toBe("—");
    expect(maskName("")).toBe("—");
    expect(maskName("   ")).toBe("—");
  });
});

describe("pii.maskWhatsapp", () => {
  it("masks BR number keeping last 4 and DDD", () => {
    expect(maskWhatsapp("+5511945207618")).toBe("+55 11 ****-7618");
  });
  it("falls back to generic mask for non-BR", () => {
    expect(maskWhatsapp("+14155551234")).toBe("+14 ****-1234");
  });
  it("em-dash when too short or empty", () => {
    expect(maskWhatsapp(null)).toBe("—");
    expect(maskWhatsapp("123")).toBe("—");
  });
});

describe("pii.truncateMessage", () => {
  it("preserves short text", () => {
    expect(truncateMessage("oi")).toBe("oi");
  });
  it("truncates to max with ...", () => {
    const long = "a".repeat(200);
    const out = truncateMessage(long, 20);
    expect(out.length).toBe(20);
    expect(out.endsWith("...")).toBe(true);
  });
  it("collapses whitespace", () => {
    expect(truncateMessage("a\n\n  b")).toBe("a b");
  });
});
