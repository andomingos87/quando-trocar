import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WindsorMetaAdsClient } from "@/lib/windsor/meta-ads";

export const runtime = "nodejs";

// Sync diário do Meta Ads (via Windsor.ai) para ad_insights_daily. Acionado
// 1×/dia por Supabase Cron (ver migration de agendamento). Protegido pelo
// INTERNAL_JOB_SECRET, no mesmo padrão do consumidor de lembretes/follow-up.

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

// Reprocessa os últimos 7 dias a cada sync — a Meta ainda ajusta atribuição de
// conversão em D+1/D+2, então gravar só "hoje" deixaria o resultado defasado.
const LOOKBACK_DAYS = 7;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
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

  const today = new Date();
  const dateTo = isoDate(today);
  const dateFrom = isoDate(new Date(today.getTime() - (LOOKBACK_DAYS - 1) * 24 * 60 * 60 * 1000));

  try {
    const client = new WindsorMetaAdsClient();
    const rows = await client.fetchDailyInsights({ dateFrom, dateTo });

    if (rows.length === 0) {
      return Response.json({ ok: true, synced: 0 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("ad_insights_daily").upsert(
      rows.map((row) => ({
        date: row.date,
        ad_id: row.adId,
        ad_name: row.adName,
        adset_id: row.adsetId,
        adset_name: row.adsetName,
        campaign_id: row.campaignId,
        campaign_name: row.campaignName,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        results: row.results,
        cost_per_result: row.costPerResult,
        raw: row.raw,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "date,ad_id" },
    );

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ ok: true, synced: rows.length });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "sync_failed" },
      { status: 500 },
    );
  }
}
