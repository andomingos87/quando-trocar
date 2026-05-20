// ADR-0001: opt-out e demais mudancas de status de cliente final sao decisao
// humana (admin). O LLM nao muda consentimento; ele apenas envia/nao envia
// conforme o estado atual.
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin/api-guard";
import {
  changeClienteWhatsapp,
  marcarClienteOptOut,
  marcarNumeroCorreto,
  marcarNumeroErrado,
  reactivateCliente,
  softDeleteCliente,
  updateCliente,
  validateChangeClienteWhatsapp,
  validateMarcarClienteOptOut,
  validateMarcarNumeroCorreto,
  validateMarcarNumeroErrado,
  validateReactivateCliente,
  validateSoftDeleteCliente,
  validateUpdateCliente,
} from "@/lib/admin/clientes";
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
    err instanceof Error && status !== 500 ? err.message : "Erro ao atualizar cliente.";
  if (status === 500) console.error("admin/clientes route failed", err);
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
      case "marcar_opt_out": {
        const v = validateMarcarClienteOptOut({
          motivo: body.motivo as string | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await marcarClienteOptOut(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "reactivate": {
        const v = validateReactivateCliente({
          origem_consentimento: body.origem_consentimento as string | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await reactivateCliente(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "marcar_numero_errado": {
        const v = validateMarcarNumeroErrado({
          motivo: body.motivo as string | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await marcarNumeroErrado(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "marcar_numero_correto": {
        validateMarcarNumeroCorreto();
        const result = await marcarNumeroCorreto(supabase, id, auditCtx);
        return NextResponse.json(result);
      }
      case "update": {
        const v = validateUpdateCliente({
          nome: body.nome as string | null | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await updateCliente(supabase, id, v.data, auditCtx);
        return NextResponse.json(result);
      }
      case "change_whatsapp": {
        const v = validateChangeClienteWhatsapp({
          whatsapp: body.whatsapp as string | undefined,
          confirmacao_whatsapp: body.confirmacao_whatsapp as string | undefined,
        });
        if (!v.ok) {
          return NextResponse.json(
            { ok: false, message: v.message, field: v.field },
            { status: 400 },
          );
        }
        const result = await changeClienteWhatsapp(supabase, id, v.data, auditCtx);
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

  const v = validateSoftDeleteCliente({ motivo: body.motivo });
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, message: v.message, field: v.field },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(request);
    const result = await softDeleteCliente(supabase, id, v.data, {
      adminId: auth.admin.adminId,
      ip,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
