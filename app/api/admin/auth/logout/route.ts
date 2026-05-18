import { NextResponse } from "next/server";

import { withAdminAudit } from "@/lib/admin/audit";
import { getRequestIp } from "@/lib/admin/request-ip";
import {
  clearAdminSessionCookie,
  getAdminFromCookie,
} from "@/lib/admin/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdminFromCookie();
  if (admin) {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    try {
      await withAdminAudit(
        supabase,
        {
          adminId: admin.adminId,
          acao: "admin.logout",
          entidade: "admin_users",
          entidadeId: admin.adminId,
          payload: { ip },
          ip,
        },
        async () => {},
      );
    } catch (err) {
      console.error("admin/logout audit failed", err);
    }
  }
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
