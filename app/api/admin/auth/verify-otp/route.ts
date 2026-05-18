import { NextResponse } from "next/server";

import { withAdminAudit } from "@/lib/admin/audit";
import { hasAttemptsLeft, hashOtpCode, isOtpExpired } from "@/lib/admin/otp";
import { normalizePhoneToE164 } from "@/lib/admin/phone";
import { getRequestIp } from "@/lib/admin/request-ip";
import { setAdminSessionCookie, signAdminSession } from "@/lib/admin/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_MESSAGE = "Codigo invalido ou expirado.";

export async function POST(request: Request) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    console.error("admin/verify-otp missing ADMIN_SESSION_SECRET");
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

  const ip = getRequestIp(request);
  const supabase = createSupabaseAdminClient();

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id, whatsapp, ativo")
    .eq("whatsapp", normalized.e164)
    .eq("ativo", true)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json(
      { ok: false, message: INVALID_MESSAGE },
      { status: 400 },
    );
  }

  const { data: otp } = await supabase
    .from("auth_otps")
    .select("id, code_hash, attempts, used_at, expires_at")
    .eq("target", "admin")
    .eq("target_id", admin.id)
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

  const expectedHash = hashOtpCode(code);
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

  await withAdminAudit(
    supabase,
    {
      adminId: admin.id,
      acao: "admin.login",
      entidade: "admin_users",
      entidadeId: admin.id,
      payload: { ip },
      ip,
    },
    async () => {
      const { error: otpError } = await supabase
        .from("auth_otps")
        .update({ used_at: nowIso, attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      if (otpError) {
        throw new Error(`otp_update_failed: ${otpError.message}`);
      }
      const { error: adminUpdateError } = await supabase
        .from("admin_users")
        .update({ ultimo_acesso_em: nowIso })
        .eq("id", admin.id);
      if (adminUpdateError) {
        throw new Error(`admin_update_failed: ${adminUpdateError.message}`);
      }
    },
  );

  const token = await signAdminSession({
    adminId: admin.id,
    whatsapp: admin.whatsapp,
  });
  await setAdminSessionCookie(token);

  return NextResponse.json({ ok: true });
}
