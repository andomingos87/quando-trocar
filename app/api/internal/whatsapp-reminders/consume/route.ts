import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseWhatsappRepository } from "@/lib/whatsapp/repository";
import { processReminderQueueBatch } from "@/lib/whatsapp/reminder-worker";
import { WhatsAppCloudApiClient } from "@/lib/whatsapp/whatsapp-client";

export const runtime = "nodejs";

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

  let batchSize = 10;

  try {
    const body = (await request.json()) as { batchSize?: number };
    if (typeof body.batchSize === "number" && body.batchSize > 0 && body.batchSize <= 100) {
      batchSize = body.batchSize;
    }
  } catch {
    // Empty body keeps the default batch size.
  }

  const result = await processReminderQueueBatch({
    repository: new SupabaseWhatsappRepository(createSupabaseAdminClient()),
    whatsapp: new WhatsAppCloudApiClient(),
    batchSize,
  });

  return Response.json({ ok: true, ...result });
}
