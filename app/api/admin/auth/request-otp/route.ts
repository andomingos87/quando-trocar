import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestIp } from "@/lib/admin/request-ip";
import { normalizePhoneToE164 } from "@/lib/admin/phone";
import { checkOtpSendRateLimit } from "@/lib/admin/rate-limit";
import {
  generateOtpCode,
  getDevBypassCode,
  hashOtpCode,
  isDevBypassEnabled,
  otpExpiresAt,
} from "@/lib/admin/otp";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_MESSAGE =
  "Se este numero estiver cadastrado, enviamos um codigo via WhatsApp.";

export async function POST(request: Request) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    console.error("admin/request-otp missing ADMIN_SESSION_SECRET");
    return NextResponse.json(
      { ok: false, message: "Erro interno. Tente novamente." },
      { status: 500 },
    );
  }

  let body: { whatsapp?: unknown };
  try {
    body = (await request.json()) as { whatsapp?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  if (typeof body.whatsapp !== "string") {
    return NextResponse.json(
      { ok: false, message: "WhatsApp obrigatorio." },
      { status: 400 },
    );
  }

  const normalized = normalizePhoneToE164(body.whatsapp);
  if (!normalized.ok) {
    return NextResponse.json(
      { ok: false, message: "Numero invalido." },
      { status: 400 },
    );
  }

  const ip = getRequestIp(request);
  const supabase = createSupabaseAdminClient();

  const rate = await checkOtpSendRateLimit(supabase, {
    whatsapp: normalized.e164,
    ip,
  });
  if (!rate.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "Muitas tentativas. Aguarde antes de tentar novamente.",
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id, ativo")
    .eq("whatsapp", normalized.e164)
    .eq("ativo", true)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const devBypass = getDevBypassCode();
  const code = devBypass ?? generateOtpCode();
  const codeHash = hashOtpCode(code);

  const { error: insertError } = await supabase.from("auth_otps").insert({
    target: "admin",
    target_id: admin.id,
    whatsapp: normalized.e164,
    code_hash: codeHash,
    expires_at: otpExpiresAt().toISOString(),
    ip,
  });

  if (insertError) {
    console.error("admin/request-otp insert failed", insertError);
    return NextResponse.json(
      { ok: false, message: "Erro interno. Tente novamente." },
      { status: 500 },
    );
  }

  if (isDevBypassEnabled()) {
    return NextResponse.json({
      ok: true,
      message: GENERIC_MESSAGE,
      devBypass: true,
    });
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_OTP_NAME;
  if (!templateName) {
    console.error("admin/request-otp missing WHATSAPP_TEMPLATE_OTP_NAME");
    return NextResponse.json(
      { ok: false, message: "Erro interno. Tente novamente." },
      { status: 500 },
    );
  }

  try {
    const client = new WhatsAppCloudApiClient();
    await client.sendTemplateMessage({
      to: normalized.e164,
      templateName,
      languageCode: "pt_BR",
      bodyParameters: [code],
    });
  } catch (err) {
    console.error("admin/request-otp template send failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao enviar codigo. Tente novamente." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
