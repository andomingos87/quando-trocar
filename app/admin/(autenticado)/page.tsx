import Link from "next/link";

import { Card, CardHint, CardLabel, CardValue } from "@/components/admin/ui";
import {
  CATEGORIA_DOT,
  describeAcao,
  describeEntidade,
} from "@/lib/admin/audit-actions";
import { dayLabel, formatBRL, formatDateTime, formatRelative } from "@/lib/admin/format";
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
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Atividades recentes
          </h2>
          <Link
            href="/admin/auditoria"
            className="text-xs font-medium text-brand-dark hover:text-brand-deep"
          >
            Ver tudo →
          </Link>
        </div>
        {atividades.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            Nenhuma atividade ainda. Operacoes do painel aparecerao aqui.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {atividades.map((a, i) => {
              const { label, categoria } = describeAcao(a.acao);
              const entidade = describeEntidade(a.entidade);
              const dia = dayLabel(a.created_at);
              const showDia = i === 0 || dayLabel(atividades[i - 1].created_at) !== dia;
              return (
                <li key={a.id}>
                  {showDia ? (
                    <p className="bg-paper-soft px-5 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                      {dia}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 px-5 py-3 text-sm">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CATEGORIA_DOT[categoria]}`}
                      aria-hidden
                    />
                    <div>
                      <p className="font-medium text-ink" title={a.acao}>
                        {label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {a.admin_label}
                        {entidade ? ` · ${entidade}` : ""}
                      </p>
                    </div>
                    <time
                      dateTime={a.created_at}
                      title={formatDateTime(a.created_at)}
                      className="whitespace-nowrap text-xs text-muted"
                    >
                      {formatRelative(a.created_at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
