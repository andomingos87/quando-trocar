import { afterEach, describe, expect, test, vi } from "vitest";

import { WindsorMetaAdsClient } from "@/lib/windsor/meta-ads";

function mockFetchOk(data: unknown[]) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ data }),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

describe("WindsorMetaAdsClient.fetchDailyInsights", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("extrai resultados de 'conversas por mensagem' do campo achatado do Windsor", async () => {
    mockFetchOk([
      {
        date: "2026-08-01",
        ad_id: "ad-1",
        ad_name: "Anúncio A",
        adset_id: "adset-1",
        adset_name: "Conjunto A",
        campaign_id: "camp-1",
        campaign: "Campanha A",
        spend: "26.00",
        impressions: "1200",
        clicks: "40",
        actions_onsite_conversion_messaging_conversation_started_7d: "7",
      },
    ]);

    const client = new WindsorMetaAdsClient("fake-key");
    const rows = await client.fetchDailyInsights({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-01",
    });

    expect(rows).toEqual([
      {
        date: "2026-08-01",
        adId: "ad-1",
        adName: "Anúncio A",
        adsetId: "adset-1",
        adsetName: "Conjunto A",
        campaignId: "camp-1",
        campaignName: "Campanha A",
        spend: 26,
        impressions: 1200,
        clicks: 40,
        results: 7,
        costPerResult: 3.71,
        raw: expect.any(Object),
      },
    ]);
  });

  test("sem campo de resultado de conversa -> results 0 e custoPorResultado null", async () => {
    mockFetchOk([
      {
        date: "2026-08-01",
        ad_id: "ad-2",
        spend: "10",
        impressions: "100",
        clicks: "5",
      },
    ]);

    const client = new WindsorMetaAdsClient("fake-key");
    const [row] = await client.fetchDailyInsights({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-01",
    });

    expect(row.results).toBe(0);
    expect(row.costPerResult).toBeNull();
  });

  test("sem WINDSOR_API_KEY -> lança erro claro", async () => {
    const client = new WindsorMetaAdsClient(undefined);

    await expect(
      client.fetchDailyInsights({ dateFrom: "2026-08-01", dateTo: "2026-08-01" }),
    ).rejects.toThrow("WINDSOR_API_KEY");
  });

  test("resposta sem campo data -> erro windsor_fetch_failed", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ message: "invalid api_key" }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = new WindsorMetaAdsClient("fake-key");
    await expect(
      client.fetchDailyInsights({ dateFrom: "2026-08-01", dateTo: "2026-08-01" }),
    ).rejects.toThrow("windsor_fetch_failed");
  });
});
