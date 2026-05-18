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

function Card({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "ok";
}) {
  const ring =
    tone === "warning"
      ? "ring-amber-200"
      : tone === "danger"
        ? "ring-red-200"
        : tone === "ok"
          ? "ring-emerald-200"
          : "ring-slate-200";
  return (
    <div className={`rounded-2xl bg-white p-5 ring-1 ${ring}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
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
        <h1 className="text-2xl font-semibold">Visao geral</h1>
        <p className="mt-1 text-sm text-slate-600">
          Diagnostico do produto em segundos. Atualiza a cada 30s.
        </p>
      </header>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="text-base font-medium">Nenhuma oficina ainda.</p>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre a primeira em <strong>Oficinas → Nova oficina</strong>.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="MRR estimado" value={formatBRL(mrr)} hint="Soma de preco efetivo das ativas" tone="ok" />
        <Card label="Oficinas ativas" value={counts.ativas} />
        <Card label="Oficinas em teste" value={counts.em_teste} />
        <Card
          label="Oficinas em risco"
          value={counts.em_risco}
          hint="Pausadas por inadimplencia"
          tone={counts.em_risco > 0 ? "danger" : "default"}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Novas oficinas no mes" value={novas} />
        <Card label="Receita recebida no mes" value={formatBRL(receita)} />
        <Card
          label="Pagamentos pendentes"
          value={pendentes}
          tone={pendentes > 0 ? "warning" : "default"}
        />
        <Card
          label="Pagamentos falhos no mes"
          value={falhos}
          tone={falhos > 0 ? "danger" : "default"}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-medium uppercase tracking-wide text-slate-500">
          Atividades recentes
        </h2>
        {atividades.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Nenhuma atividade ainda. Operacoes do painel aparecerao aqui.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {atividades.map((a) => (
              <li key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 text-sm">
                <div>
                  <p>
                    <span className="font-mono text-xs text-slate-600">{a.acao}</span>
                    <span className="ml-2 text-slate-500">por</span>{" "}
                    <span className="font-medium text-slate-800">{a.admin_label}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {a.entidade}
                    {a.entidade_id ? ` · ${a.entidade_id.slice(0, 8)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
