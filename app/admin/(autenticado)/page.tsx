import { Card, CardHint, CardLabel, CardValue } from "@/components/admin/ui";
import { formatBRL, formatDateTime } from "@/lib/admin/format";
import {
  getAtividadesRecentes,
  getMrrEstimado,
  getNovasOficinasMes,
  getOficinasCounts,
  getPagamentosFalhosMes,
  getPagamentosPendentes,
  getReceitaRecebidaMes,
} from "@/lib/admin/metrics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 30;

type MetricTone = "default" | "warning" | "danger" | "ok";

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: MetricTone;
}) {
  const cardTone =
    tone === "warning"
      ? "atencao"
      : tone === "danger"
        ? "erro"
        : tone === "ok"
          ? "sucesso"
          : "default";
  return (
    <Card tone={cardTone}>
      <CardLabel>{label}</CardLabel>
      <CardValue>{value}</CardValue>
      {hint ? <CardHint>{hint}</CardHint> : null}
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const supabase = createSupabaseAdminClient();

  const [mrr, counts, novas, receita, pendentes, falhos, atividades] =
    await Promise.all([
      getMrrEstimado(supabase),
      getOficinasCounts(supabase),
      getNovasOficinasMes(supabase),
      getReceitaRecebidaMes(supabase),
      getPagamentosPendentes(supabase),
      getPagamentosFalhosMes(supabase),
      getAtividadesRecentes(supabase, 20),
    ]);

  const empty = counts.ativas === 0 && counts.em_teste === 0 && novas === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Visao geral</h1>
        <p className="mt-1 text-sm text-muted">
          Diagnostico do produto em segundos. Atualiza a cada 30s.
        </p>
      </header>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10">
          <p className="text-base font-medium text-ink">Nenhuma oficina ainda.</p>
          <p className="mt-1 text-sm text-muted">
            Cadastre a primeira em <strong className="text-ink">Oficinas → Nova oficina</strong>.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MRR estimado" value={formatBRL(mrr)} hint="Soma de preco efetivo das ativas" tone="ok" />
        <MetricCard label="Oficinas ativas" value={counts.ativas} />
        <MetricCard label="Oficinas em teste" value={counts.em_teste} />
        <MetricCard
          label="Oficinas em risco"
          value={counts.em_risco}
          hint="Pausadas por inadimplencia"
          tone={counts.em_risco > 0 ? "danger" : "default"}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Novas oficinas no mes" value={novas} />
        <MetricCard label="Receita recebida no mes" value={formatBRL(receita)} />
        <MetricCard
          label="Pagamentos pendentes"
          value={pendentes}
          tone={pendentes > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Pagamentos falhos no mes"
          value={falhos}
          tone={falhos > 0 ? "danger" : "default"}
        />
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Atividades recentes
        </h2>
        {atividades.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            Nenhuma atividade ainda. Operacoes do painel aparecerao aqui.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {atividades.map((a) => (
              <li key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 text-sm">
                <div>
                  <p>
                    <span className="font-mono text-xs text-muted">{a.acao}</span>
                    <span className="ml-2 text-muted">por</span>{" "}
                    <span className="font-medium text-ink">{a.admin_label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.entidade}
                    {a.entidade_id ? ` · ${a.entidade_id.slice(0, 8)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
