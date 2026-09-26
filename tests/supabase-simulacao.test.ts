import { afterEach, describe, expect, it, vi } from "vitest";

import { getDevBypassCode, isDevBypassEnabled } from "@/lib/admin/otp";
import { isRepDevBypassEnabled } from "@/lib/representante/otp";
import { SUPABASE_REF_SIMULACAO, isSupabaseSimulacao, refDoSupabaseUrl } from "@/lib/supabase/simulacao";

const URL_SIM = `https://${SUPABASE_REF_SIMULACAO}.supabase.co`;
const URL_PROD = "https://crxrdypnefgexifbrdij.supabase.co";

describe("projeto de simulação", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reconhece o ref só pelo host do Supabase", () => {
    expect(refDoSupabaseUrl(URL_SIM)).toBe(SUPABASE_REF_SIMULACAO);
    expect(refDoSupabaseUrl(URL_PROD)).toBe("crxrdypnefgexifbrdij");
    expect(refDoSupabaseUrl(`https://evil.com/${SUPABASE_REF_SIMULACAO}.supabase.co`)).toBeNull();
    expect(refDoSupabaseUrl(undefined)).toBeNull();
    expect(isSupabaseSimulacao(URL_SIM)).toBe(true);
    expect(isSupabaseSimulacao(URL_PROD)).toBe(false);
  });

  it("libera o bypass de OTP em production apenas com o banco de simulação", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_OTP_DEV_BYPASS_CODE", "123456");
    vi.stubEnv("REP_OTP_DEV_BYPASS_CODE", "654321");

    vi.stubEnv("SUPABASE_URL", URL_PROD);
    expect(isDevBypassEnabled()).toBe(false);
    expect(getDevBypassCode()).toBeNull();
    expect(isRepDevBypassEnabled()).toBe(false);

    vi.stubEnv("SUPABASE_URL", URL_SIM);
    expect(isDevBypassEnabled()).toBe(true);
    expect(getDevBypassCode()).toBe("123456");
    expect(isRepDevBypassEnabled()).toBe(true);

    vi.stubEnv("ADMIN_OTP_DEV_BYPASS_CODE", "");
    expect(isDevBypassEnabled()).toBe(false);
  });
});
