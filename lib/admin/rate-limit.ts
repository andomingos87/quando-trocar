import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const WHATSAPP_LIMIT = 3;
const WHATSAPP_WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 1;
const IP_WINDOW_MS = 60 * 1000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; reason: "whatsapp" | "ip"; retryAfterSec: number };

export async function checkOtpSendRateLimit(
  supabase: SupabaseClient,
  input: { whatsapp: string; ip: string | null },
): Promise<RateLimitResult> {
  const now = Date.now();
  const sinceWhatsapp = new Date(now - WHATSAPP_WINDOW_MS).toISOString();

  const { count: whatsappCount, error: whatsappError } = await supabase
    .from("auth_otps")
    .select("id", { count: "exact", head: true })
    .eq("whatsapp", input.whatsapp)
    .eq("target", "admin")
    .gte("created_at", sinceWhatsapp);

  if (whatsappError) {
    throw new Error(`rate_limit_whatsapp_query_failed: ${whatsappError.message}`);
  }

  if ((whatsappCount ?? 0) >= WHATSAPP_LIMIT) {
    return {
      ok: false,
      reason: "whatsapp",
      retryAfterSec: Math.ceil(WHATSAPP_WINDOW_MS / 1000),
    };
  }

  if (input.ip) {
    const sinceIp = new Date(now - IP_WINDOW_MS).toISOString();
    const { count: ipCount, error: ipError } = await supabase
      .from("auth_otps")
      .select("id", { count: "exact", head: true })
      .eq("ip", input.ip)
      .eq("target", "admin")
      .gte("created_at", sinceIp);

    if (ipError) {
      throw new Error(`rate_limit_ip_query_failed: ${ipError.message}`);
    }

    if ((ipCount ?? 0) >= IP_LIMIT) {
      return {
        ok: false,
        reason: "ip",
        retryAfterSec: Math.ceil(IP_WINDOW_MS / 1000),
      };
    }
  }

  return { ok: true };
}
