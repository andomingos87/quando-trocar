import Link from "next/link";
import { notFound } from "next/navigation";

import { formatBRL, formatDate, formatDateTime } from "@/lib/admin/format";
import {
  getOficinaById,
  getOficinaMetrics30d,
  getRecentMessagesMasked,
  getRecentOficinaAudit,
  getRecentOficinaPayments,
} from "@/lib/admin/oficinas";
import { listPlanos } from "@/lib/admin/planos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OficinaDetailActions } from "@/components/admin/oficina-detail-actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  ativa: "bg-emerald-100 text-emerald-800",
  pausada: "bg-amber-100 text-amber-800",
  cancelada: "bg-slate-200 text-slate-600",
};

export default async function OficinaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const [oficina, planos] = await Promise.all([
    getOficinaById(supabase, id),
    listPlanos(supabase),
  ]);
  if (!oficina) notFound();

  const [metrics, messages, audit, payments] = await Promise.all([
    getOficinaMetrics30d(supabase, id),
    getRecentMessagesMasked(supabase, id, 10),
    getRecentOficinaAudit(supabase, id, 10),
    getRecentOficinaPayments(supabase, id, 6),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{oficina.nome}</h1>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_BADGE[oficina.status] ?? ""
              }`}
            >
              {oficina.status}
              {oficina.motivo_pausa ? ` · ${oficina.motivo_pausa}` : ""}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {oficina.whatsapp_principal} · {oficina.cidade ?? "—"} · Criada em {" "}
            {formatDate(oficina.created_at)} · origem {oficina.origem}
          </p>
        </div>
        <OficinaDetailActions
          oficina={oficina}
          planos={planos.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))}
        />
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Plano e cobranca
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Plano</dt>
              <dd>
                <Link
                  href="/admin/planos"
                  className="font-medium text-slate-900 hover:underline"
                >
                  {oficina.plano_nome ?? "—"}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Preco efetivo</dt>
              <dd className="font-medium tabular-nums">
                {formatBRL(oficina.preco_efetivo)}
                <span className="ml-1 text-xs text-slate-500">
                  ({oficina.preco_negociado !== null ? "negociado" : "base"})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Preco base</dt>
              <dd className="tabular-nums text-slate-600">
                {formatBRL(oficina.preco_base)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Proximo vencimento</dt>
              <dd>{formatDate(oficina.proximo_vencimento)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Metricas (30 dias)
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Clientes cadastrados</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {metrics.clientes_finais}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Lembretes enviados</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {metrics.lembretes_enviados}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Retornos agendados</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {metrics.retornos_concluidos}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Receita gerada</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatBRL(metrics.receita_gerada)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Pagamentos (ultimos 6)
          </h2>
          <Link
            href={`/admin/pagamentos?oficina_id=${oficina.id}`}
            className="text-xs text-slate-600 hover:underline"
          >
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto border-t border-slate-100">
          {payments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">
              Nenhum pagamento ainda. Cobrancas aparecerao quando o Admin-6 estiver ativo.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2">Data</th>
                  <th className="px-5 py-2">Valor</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2">Vencimento</th>
                  <th className="px-5 py-2">Pago em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2 text-slate-600">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-2 tabular-nums">{formatBRL(p.valor)}</td>
                    <td className="px-5 py-2 text-slate-700">{p.status}</td>
                    <td className="px-5 py-2 text-slate-600">{formatDate(p.vencimento)}</td>
                    <td className="px-5 py-2 text-slate-600">{formatDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-medium uppercase tracking-wide text-slate-500">
          Ultimas mensagens (PII mascarada)
        </h2>
        {messages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Sem mensagens recentes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>
                    {m.direction === "inbound" ? "↓ in" : "↑ out"} · {m.cliente_nome_mascarado} ·{" "}
                    {m.cliente_whatsapp_mascarado}
                  </span>
                  <span>{formatDateTime(m.created_at)}</span>
                </div>
                <p className="mt-1 text-slate-700">{m.body_truncado}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-medium uppercase tracking-wide text-slate-500">
          Auditoria (ultimas 10)
        </h2>
        {audit.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">Sem entradas de auditoria.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {audit.map((a) => (
              <li key={a.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="font-mono">{a.acao}</span>
                  <span>{formatDateTime(a.created_at)}</span>
                </div>
                {a.admin_id === null ? (
                  <span className="text-xs text-slate-500">Sistema</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
