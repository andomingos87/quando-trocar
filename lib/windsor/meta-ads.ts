import "server-only";

// Cliente da Data API do Windsor.ai (https://connectors.windsor.ai/<connector>),
// usada para puxar spend/resultado do Meta Ads sem lidar com a Marketing API
// da Meta diretamente. Requer a conta de anúncios conectada no painel do
// Windsor (conector "facebook") — ver docs/runbooks/ads-analytics-setup.md.
//
// Nomes de campo confirmados via `get_fields`/`get_data` (MCP Windsor) com a
// conta real conectada (2026-08-03). O Windsor NÃO expõe um array `actions`
// genérico como a Marketing API da Meta — cada tipo de ação vira um campo
// "achatado" próprio (`actions_<action_type>`). O campo abaixo é o que a Meta
// reporta pra campanhas de objetivo "Conversas por mensagem"
// (click-to-WhatsApp/Instagram) — é o "Resultados" que o Ads Manager mostra
// pra esse tipo de campanha.
const WINDSOR_BASE_URL = "https://connectors.windsor.ai/facebook";

const MESSAGING_RESULT_FIELD = "actions_onsite_conversion_messaging_conversation_started_7d";

const FIELDS = [
  "date",
  "campaign_id",
  "campaign",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  MESSAGING_RESULT_FIELD,
] as const;

export type MetaAdInsightRow = {
  date: string;
  adId: string;
  adName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  costPerResult: number | null;
  raw: Record<string, unknown>;
};

type WindsorRawRow = {
  date?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign?: string;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  [MESSAGING_RESULT_FIELD]?: string | number;
  [key: string]: unknown;
};

function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export class WindsorMetaAdsClient {
  constructor(private readonly apiKey = process.env.WINDSOR_API_KEY) {}

  async fetchDailyInsights(input: { dateFrom: string; dateTo: string }): Promise<MetaAdInsightRow[]> {
    if (!this.apiKey) {
      throw new Error("Missing WINDSOR_API_KEY environment variable");
    }

    const url = new URL(WINDSOR_BASE_URL);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("fields", FIELDS.join(","));
    url.searchParams.set("date_from", input.dateFrom);
    url.searchParams.set("date_to", input.dateTo);
    url.searchParams.set("_renderer", "json");

    const response = await fetch(url.toString());
    const body = (await response.json().catch(() => null)) as {
      data?: WindsorRawRow[];
      message?: string;
    } | null;

    if (!response.ok || !Array.isArray(body?.data)) {
      throw new Error(`windsor_fetch_failed: ${body?.message ?? response.statusText}`);
    }

    return body.data
      .filter((row) => row.ad_id)
      .map((row) => {
        const spend = toNumber(row.spend);
        const results = toNumber(row[MESSAGING_RESULT_FIELD]);

        return {
          date: String(row.date ?? input.dateFrom),
          adId: String(row.ad_id),
          adName: row.ad_name ? String(row.ad_name) : null,
          adsetId: row.adset_id ? String(row.adset_id) : null,
          adsetName: row.adset_name ? String(row.adset_name) : null,
          campaignId: row.campaign_id ? String(row.campaign_id) : null,
          campaignName: row.campaign ? String(row.campaign) : null,
          spend,
          impressions: toNumber(row.impressions),
          clicks: toNumber(row.clicks),
          results,
          costPerResult: results > 0 ? Math.round((spend / results) * 100) / 100 : null,
          raw: row as Record<string, unknown>,
        };
      });
  }
}
