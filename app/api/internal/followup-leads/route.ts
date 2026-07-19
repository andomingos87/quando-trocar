import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processFollowupLeadsBatch } from "@/lib/whatsapp/followup-leads";
import { SupabaseWhatsappRepository } from "@/lib/whatsapp/repository";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

export const runtime = "nodejs";

// Follow-up proativo de leads (CV4, QTR-13). Acionado 1×/dia por Supabase Cron
// em horário comercial (ver migration de agendamento). Protegido pelo
// INTERNAL_JOB_SECRET, no mesmo padrão do consumidor de lembretes.

function isAuthorized(request: Request) {
  const secret = process.env.INTERNAL_JOB_SECRET;
  if (!secret) {
    throw new Error("Missing INTERNAL_JOB_SECRET");
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  return request.headers.get("x-internal-job-secret") === secret;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "missing_internal_secret" },
      { status: 500 },
    );
  }

  const templateFirst = process.env.WHATSAPP_TEMPLATE_FOLLOWUP_24H_NAME;
  const templateSecond = process.env.WHATSAPP_TEMPLATE_FOLLOWUP_72H_NAME;
  if (!templateFirst || !templateSecond) {
    return Response.json(
      { ok: false, error: "missing_followup_template_env" },
      { status: 500 },
    );
  }

  let limit = 100;
  try {
    const body = (await request.json()) as { limit?: number };
    if (typeof body.limit === "number" && body.limit > 0 && body.limit <= 500) {
      limit = body.limit;
    }
  } catch {
    // Corpo vazio mantém o limite padrão.
  }

  const result = await processFollowupLeadsBatch({
    repository: new SupabaseWhatsappRepository(createSupabaseAdminClient()),
    whatsapp: new WhatsAppCloudApiClient(),
    limit,
    templateFirst,
    templateSecond,
    templateLanguage: process.env.WHATSAPP_TEMPLATE_FOLLOWUP_LANGUAGE ?? "pt_BR",
  });

  return Response.json({ ok: true, ...result });
}
