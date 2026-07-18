import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/admin/request-ip";
import { normalizePhoneToE164 } from "@/lib/admin/phone";
import {
  generateOtpCode,
  getRepDevBypassCode,
  hashRepOtpCode,
  isRepDevBypassEnabled,
  otpExpiresAt,
} from "@/lib/representante/otp";
import { checkRepOtpSendRateLimit } from "@/lib/representante/rate-limit";
import { getActiveRepresentanteByWhatsapp } from "@/lib/representante/representante";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_MESSAGE =
  "Se este numero estiver cadastrado, enviamos um codigo via WhatsApp.";

export async function POST(request: Request) {
  if (!process.env.REP_SESSION_SECRET) {
    console.error("representante/request-otp missing REP_SESSION_SECRET");
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

  const rate = await checkRepOtpSendRateLimit(supabase, {
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

  // Resposta generica mesmo quando nao existe: nao vaza se o numero e ou nao
  // representante (mesma politica do admin).
  const representante = await getActiveRepresentanteByWhatsapp(supabase, normalized.e164);
  if (!representante) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const devBypass = getRepDevBypassCode();
  const code = devBypass ?? generateOtpCode();
  const codeHash = hashRepOtpCode(code);

  const { error: insertError } = await supabase.from("auth_otps").insert({
    target: "representante",
    target_id: representante.id,
    whatsapp: normalized.e164,
    code_hash: codeHash,
    expires_at: otpExpiresAt().toISOString(),
    ip,
  });

  if (insertError) {
    console.error("representante/request-otp insert failed", insertError);
    return NextResponse.json(
      { ok: false, message: "Erro interno. Tente novamente." },
      { status: 500 },
    );
  }

  if (isRepDevBypassEnabled()) {
    return NextResponse.json({
      ok: true,
      message: GENERIC_MESSAGE,
      devBypass: true,
    });
  }

  // Reaproveita o template Meta de OTP de oficina/admin (ADR-0025): e um
  // template AUTHENTICATION generico ("seu codigo e X"), independente do publico.
  const templateName = process.env.WHATSAPP_TEMPLATE_OTP_NAME;
  if (!templateName) {
    console.error("representante/request-otp missing WHATSAPP_TEMPLATE_OTP_NAME");
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
      // Template AUTHENTICATION com botao COPY_CODE cujo {{1}} deve ecoar o
      // codigo, senao a Meta rejeita (erro 132000).
      urlButtonParameter: code,
    });
  } catch (err) {
    console.error("representante/request-otp template send failed", err);
    return NextResponse.json(
      { ok: false, message: "Erro ao enviar codigo. Tente novamente." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
