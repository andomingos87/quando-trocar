import Link from "next/link";

import {
  formatBRL,
  getAdsAnalytics,
  hasAnyAdInsightsSynced,
} from "@/lib/admin/metrics-ads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

type PageProps = {
  searchParams: Promise<{ dias?: string }>;
};

export default async function AnalyticsAdsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dias = Number(params.dias) || 30;

  const supabase = createSupabaseAdminClient();
  const [analytics, synced] = await Promise.all([
    getAdsAnalytics(supabase, dias),
    hasAnyAdInsightsSynced(supabase),
  ]);

  const { overview, porCampanha } = analytics;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics de anúncios</h1>
          <p className="mt-1 text-sm text-muted">
            Últimos {analytics.periodoDias} dias. Liga o gasto/resultado do Meta Ads
            (via Windsor.ai) ao funil real do CRM — lead, qualificado, convertido.
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-white p-1">
          {PERIODOS.map((periodo) => (
            <Link
              key={periodo.dias}
              href={`/admin/analytics-ads?dias=${periodo.dias}`}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                periodo.dias === dias
                  ? "bg-ink text-white"
                  : "text-muted hover:text-ink"
              }`}
            >
              {periodo.label}
            </Link>
          ))}
        </div>
      </header>

      {!synced ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-soft p-4 text-sm text-muted">
          Nenhum dado de anúncio sincronizado ainda. Conecte a conta de Meta Ads no
          Windsor.ai, configure <code>WINDSOR_API_KEY</code> e{" "}
          <code>INTERNAL_JOB_SECRET</code> e rode o sync — veja{" "}
          <code>docs/runbooks/ads-analytics-setup.md</code>. Enquanto isso, os números
          abaixo mostram só a atribuição de leads já capturada (quando houver).
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Gasto" value={formatBRL(overview.gasto)} hint="Meta Ads (Windsor)" />
        <Card
          label="Resultados (Meta)"
          value={String(overview.resultadosMeta)}
          hint="conversas iniciadas por anúncio"
        />
        <Card label="Leads no CRM" value={String(overview.leads)} hint="atribuídos a um anúncio" />
        <Card label="Qualificados" value={String(overview.qualificados)} />
        <Card label="Convertidos" value={String(overview.convertidos)} hint="virou oficina paga" />
        <Card label="Custo por lead" value={formatBRL(overview.custoPorLead)} />
        <Card label="Custo por qualificado" value={formatBRL(overview.custoPorQualificado)} />
        <Card label="CAC (custo por conversão)" value={formatBRL(overview.cac)} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <header className="border-b border-line bg-paper-soft px-4 py-3 text-sm font-medium text-ink">
          Por campanha / anúncio
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Campanha</th>
                <th className="px-4 py-2 font-medium">Anúncio</th>
                <th className="px-4 py-2 font-medium">Gasto</th>
                <th className="px-4 py-2 font-medium">Resultados (Meta)</th>
                <th className="px-4 py-2 font-medium">Leads</th>
                <th className="px-4 py-2 font-medium">Qualificados</th>
                <th className="px-4 py-2 font-medium">Convertidos</th>
                <th className="px-4 py-2 font-medium">Custo/lead</th>
                <th className="px-4 py-2 font-medium">Custo/qualificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {porCampanha.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-muted">
                    Nada no período.
                  </td>
                </tr>
              ) : null}
              {porCampanha.map((row) => (
                <tr key={row.adId}>
                  <td className="px-4 py-2 text-ink">{row.campanhaNome}</td>
                  <td className="px-4 py-2 text-muted">{row.adNome ?? row.adId}</td>
                  <td className="px-4 py-2 tabular-nums text-muted">
                    {formatBRL(row.gasto)}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted">{row.resultadosMeta}</td>
                  <td className="px-4 py-2 tabular-nums text-muted">{row.leads}</td>
                  <td className="px-4 py-2 tabular-nums text-muted">{row.qualificados}</td>
                  <td className="px-4 py-2 tabular-nums text-muted">{row.convertidos}</td>
                  <td className="px-4 py-2 tabular-nums text-muted">
                    {formatBRL(row.custoPorLead)}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted">
                    {formatBRL(row.custoPorQualificado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
