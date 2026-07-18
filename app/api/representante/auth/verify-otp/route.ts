import { NextResponse } from "next/server";

import { normalizePhoneToE164 } from "@/lib/admin/phone";
import { hasAttemptsLeft, hashRepOtpCode, isOtpExpired } from "@/lib/representante/otp";
import { getActiveRepresentanteByWhatsapp } from "@/lib/representante/representante";
import {
  setRepresentanteSessionCookie,
  signRepresentanteSession,
} from "@/lib/representante/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_MESSAGE = "Codigo invalido ou expirado.";

export async function POST(request: Request) {
  if (!process.env.REP_SESSION_SECRET) {
    console.error("representante/verify-otp missing REP_SESSION_SECRET");
    return NextResponse.json(
      { ok: false, message: "Erro interno. Tente novamente." },
      { status: 500 },
    );
  }

  let body: { whatsapp?: unknown; code?: unknown };
  try {
    body = (await request.json()) as { whatsapp?: unknown; code?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, message: "Payload invalido." },
      { status: 400 },
    );
  }

  if (typeof body.whatsapp !== "string" || typeof body.code !== "string") {
    return NextResponse.json(
      { ok: false, message: "WhatsApp e codigo obrigatorios." },
      { status: 400 },
    );
  }

  const code = body.code.trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  const normalized = normalizePhoneToE164(body.whatsapp);
  if (!normalized.ok) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const representante = await getActiveRepresentanteByWhatsapp(supabase, normalized.e164);
  if (!representante) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  const { data: otp } = await supabase
    .from("auth_otps")
    .select("id, code_hash, attempts, used_at, expires_at")
    .eq("target", "representante")
    .eq("target_id", representante.id)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  if (isOtpExpired(otp.expires_at)) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  if (!hasAttemptsLeft(otp.attempts)) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  const expectedHash = hashRepOtpCode(code);
  if (expectedHash !== otp.code_hash) {
    await supabase
      .from("auth_otps")
      .update({ attempts: otp.attempts + 1 })
      .eq("id", otp.id);
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();

  // Consumo ATOMICO: so avanca o request que efetivamente vira used_at de null
  // para agora. `.select().maybeSingle()` devolve a linha so quando o UPDATE
  // condicional acertou uma linha — se outro request simultaneo ja consumiu o
  // OTP, `consumed` vem null e barramos a segunda emissao de sessao.
  const { data: consumed, error: otpError } = await supabase
    .from("auth_otps")
    .update({ used_at: nowIso, attempts: otp.attempts + 1 })
    .eq("id", otp.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (otpError) {
    console.error("representante/verify-otp otp update failed", otpError);
    return NextResponse.json(
      { ok: false, message: "Erro interno. Tente novamente." },
      { status: 500 },
    );
  }
  if (!consumed) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  // Trilha de login do rep (analogo a admin_users.ultimo_acesso_em). Auditoria
  // dedicada do rep fica para R4.5; nao poluimos admin_audit_log.
  await supabase
    .from("representantes")
    .update({ ultimo_acesso_em: nowIso })
    .eq("id", representante.id);

  const token = await signRepresentanteSession({
    representanteId: representante.id,
    whatsapp: representante.whatsapp,
    codigo: representante.codigo,
  });
  await setRepresentanteSessionCookie(token);

  return NextResponse.json({ ok: true });
}
