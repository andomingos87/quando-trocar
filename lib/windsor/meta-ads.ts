import "server-only";

// Cliente da Data API do Windsor.ai (https://connectors.windsor.ai/<connector>),
// usada para puxar spend/resultado do Meta Ads sem lidar com a Marketing API
// da Meta diretamente. Requer a conta de anúncios conectada no painel do
// Windsor (conector "facebook") — ver docs/runbooks/ads-analytics-setup.md.
//
// IMPORTANTE: os nomes de campo abaixo (`campaign`, `adset`, `ad`, `actions`
// etc.) são os documentados publicamente pelo Windsor para o conector
// "facebook", mas só podem ser confirmados de fato chamando `get_fields` com
// uma conta já conectada. Se o Windsor retornar erro de campo inválido,
// rode `get_fields` (MCP) com a conta conectada e ajuste `FIELDS` aqui.
const WINDSOR_BASE_URL = "https://connectors.windsor.ai/facebook";

const FIELDS = [
  "date",
  "campaign_id",
  "campaign",
  "adset_id",
  "adset",
  "ad_id",
  "ad",
  "spend",
  "impressions",
  "clicks",
  "actions",
] as const;

// Ação que a Meta reporta pra campanhas de objetivo "Conversas por mensagem"
// (click-to-WhatsApp/Instagram) — é o que o Ads Manager mostra como
// "Resultados" pra esse tipo de campanha (ex.: os "7" do print do usuário).
const MESSAGING_CONVERSATION_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply",
];

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

type WindsorAction = { action_type?: string; value?: string | number };

type WindsorRawRow = {
  date?: string;
  ad_id?: string;
  ad?: string;
  adset_id?: string;
  adset?: string;
  campaign_id?: string;
  campaign?: string;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  actions?: WindsorAction[] | string;
  [key: string]: unknown;
};

function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractMessagingResults(actions: WindsorRawRow["actions"]): number {
  if (!actions) return 0;
  const parsed = typeof actions === "string" ? safeParseJson(actions) : actions;
  if (!Array.isArray(parsed)) return 0;
  return parsed
    .filter(
      (action): action is WindsorAction =>
        Boolean(action?.action_type) &&
        MESSAGING_CONVERSATION_ACTION_TYPES.includes(action.action_type!),
    )
    .reduce((sum, action) => sum + toNumber(action.value), 0);
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
      .filter((row) => row.ad_id || row.ad)
      .map((row) => {
        const spend = toNumber(row.spend);
        const results = extractMessagingResults(row.actions);

        return {
          date: String(row.date ?? input.dateFrom),
          adId: String(row.ad_id ?? row.ad),
          adName: row.ad ? String(row.ad) : null,
          adsetId: row.adset_id ? String(row.adset_id) : null,
          adsetName: row.adset ? String(row.adset) : null,
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
