// ADR-0001: estas mutacoes sao iniciativa do admin humano. O LLM nao escreve
// em leads_oficina.status diretamente; eventuais mudancas vindas do agente
// passam por outras rotas com guardas explicitos.
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  changeLeadStatus,
  changeLeadWhatsapp,
  convertLeadManual,
  marcarLeadPerdido,
  reopenLead,
  softDeleteLead,
  updateLead,
  validateChangeLeadStatus,
  validateChangeLeadWhatsapp,
  validateConvertLeadManual,
  validateMarcarLeadPerdido,
  validateReopenLead,
  validateSoftDeleteLead,
  validateUpdateLead,
} from "@/lib/admin/leads";
import { getRequestIp } from "@/lib/admin/request-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function handleError(err: unknown) {
  const status = (err as { status?: number }).status ?? 500;
  const message =
    err instanceof Error && status !== 500 ? err.message : "Erro ao atualizar lead.";
  if (status === 500) console.error("admin/leads route failed", err);
  return NextResponse.json({ ok: false, message }, { status });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, message: "ID invalido." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const acao = typeof body.acao === "string" ? body.acao : "";
  const supabase = createSupabaseAdminClient();
  const ip = getRequestIp(request);
  const auditCtx = { adminId: auth.admin.adminId, ip };

  try {
    switch (acao) {
      case "marcar_perdido": {
        const v = validateMarcarLeadPerdido({
          motivo_perda: body.motivo_perda as string | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await marcarLeadPerdido(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "change_status": {
        const v = validateChangeLeadStatus({
          status: body.status as never,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await changeLeadStatus(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "reopen": {
        validateReopenLead();
        const result = await reopenLead(supabase, id, auditCtx);
        return NextResponse.json(result);
      }
      case "update": {
        const v = validateUpdateLead(body as never);
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await updateLead(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "change_whatsapp": {
        const v = validateChangeLeadWhatsapp({
          whatsapp: body.whatsapp as string | undefined,
          confirmacao_whatsapp: body.confirmacao_whatsapp as string | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await changeLeadWhatsapp(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "convert_manual": {
        const v = validateConvertLeadManual({
          plano_id: body.plano_id as string | undefined,
          preco_negociado:
            body.preco_negociado === null
              ? null
              : (body.preco_negociado as number | undefined),
          dias_lembrete: body.dias_lembrete as number | undefined,
          status: body.status as "ativa" | "pausada" | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await convertLeadManual(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { ok: false, message: "Acao desconhecida." },
          { status: 400 },
        );
    }
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, message: "ID invalido." }, { status: 400 });
  }

  let body: { motivo?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const v = validateSoftDeleteLead({ motivo: body.motivo });
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, message: v.message, field: v.field },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await softDeleteLead(supabase, id, v.data, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
