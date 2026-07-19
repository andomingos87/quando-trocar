import {
  getConversationalMetrics,
  getLatestPhoneStatus,
  pct,
} from "@/lib/admin/metrics-conversacional";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

function qualityColor(rating: string | null): string {
  const r = (rating ?? "").toUpperCase();
  if (r === "GREEN" || r === "HIGH") return "bg-cyan-soft text-ink";
  if (r === "YELLOW" || r === "MEDIUM") return "bg-amber-100 text-ink";
  if (r === "RED" || r === "LOW") return "bg-red-soft text-red";
  return "bg-line-soft text-ink";
}

export default async function MetricasConversacionalPage() {
  const supabase = createSupabaseAdminClient();
  const [metrics, phone] = await Promise.all([
    getConversationalMetrics(supabase, 7),
    getLatestPhoneStatus(supabase),
  ]);

  const g = metrics.geracao;
  const fallbackPct = pct(g.enviadaEnlatada, g.total);
  const geradaPct = pct(g.enviadaGerada, g.total);
  const reprovadaPct = pct(g.reprovada, g.total);
  const handoffPct = pct(metrics.conversasEmHandoff, metrics.conversasTotal);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Métricas — camada conversacional</h1>
        <p className="mt-1 text-sm text-muted">
          Últimos {metrics.periodoDias} dias. Sobre <code>agent_tool_calls</code>,{" "}
          <code>mensagens</code> e <code>conversas</code>.
        </p>
      </header>

      {phone ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <span className="text-sm font-medium text-ink">
            Qualidade do número {phone.displayPhoneNumber}:
          </span>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${qualityColor(phone.qualityRating)}`}
          >
            {phone.qualityRating ?? phone.event ?? "—"}
          </span>
          {phone.currentLimit ? (
            <span className="text-xs text-muted">Limite: {phone.currentLimit}</span>
          ) : null}
          <span className="text-xs text-muted">
            Atualizado em {new Date(phone.updatedAt).toLocaleString("pt-BR")}
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-paper-soft p-4 text-sm text-muted">
          Sem evento de qualidade do número ainda. Inscreva a WABA no webhook{" "}
          <code>phone_number_quality_update</code> para acompanhar o rating aqui.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          label="Gerações"
          value={String(g.total)}
          hint="respostas que passaram pela camada"
        />
        <Card label="Enviada gerada" value={`${geradaPct}%`} hint={`${g.enviadaGerada} de ${g.total}`} />
        <Card label="Enviada enlatada" value={`${fallbackPct}%`} hint={`${g.enviadaEnlatada} de ${g.total}`} />
        <Card label="Reprovada (validador)" value={`${reprovadaPct}%`} hint={`${g.reprovada} de ${g.total}`} />
        <Card
          label="Conversas em handoff"
          value={`${handoffPct}%`}
          hint={`${metrics.conversasEmHandoff} de ${metrics.conversasTotal}`}
        />
        <Card label="Resumos de handoff" value={String(metrics.handoffEventos)} hint="no período" />
        <Card label="Mensagens recebidas" value={String(metrics.mensagens.inbound)} />
        <Card label="Mensagens enviadas" value={String(metrics.mensagens.outbound)} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <header className="border-b border-line bg-paper-soft px-4 py-3 text-sm font-medium text-ink">
          Gerações por intenção
        </header>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Intenção</th>
              <th className="px-4 py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {metrics.porIntent.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-muted">
                  Nada no período.
                </td>
              </tr>
            ) : null}
            {metrics.porIntent.map((row) => (
              <tr key={row.intent}>
                <td className="px-4 py-2 text-ink">{row.intent}</td>
                <td className="px-4 py-2 tabular-nums text-muted">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
