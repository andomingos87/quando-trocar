import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/admin/ui";
import { OficinaStatusBadge } from "@/components/admin/oficina-status-badge";
import { OficinaDetailActions } from "@/components/admin/oficina-detail-actions";
import { OficinaLembreteConfigCard } from "@/components/admin/oficina-lembrete-config-card";
import { formatBRL, formatDate, formatDateTime } from "@/lib/admin/format";
import { formatCep, formatCpfCnpj } from "@/lib/admin/documento-br";
import {
  getOficinaById,
  getOficinaMetrics30d,
  getRecentMessagesMasked,
  getRecentOficinaAudit,
  getRecentOficinaPayments,
  type OficinaDetail,
} from "@/lib/admin/oficinas";
import { listPlanos } from "@/lib/admin/planos";
import { listRepresentantes } from "@/lib/admin/representantes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACAO_LABEL: Record<string, string> = {
  "oficina.create_manual": "Oficina criada",
  "oficina.update_cadastro": "Cadastro atualizado",
  "oficina.update_fiscal": "Dados fiscais atualizados",
  "oficina.update_status": "Status atualizado",
  "oficina.update_plano": "Plano atualizado",
  "oficina.update_preco": "Preco atualizado",
  "oficina.update_representante": "Representante atualizado",
  "oficina.update_lembrete_config": "Automacao de lembretes atualizada",
  "oficina.soft_delete": "Oficina excluida",
  "oficina.cobranca_manual_disparada": "Cobranca manual disparada",
};

function enderecoLinha(o: OficinaDetail): string {
  const partes = [
    o.logradouro,
    o.numero,
    o.complemento,
    o.bairro,
    [o.cidade, o.estado].filter(Boolean).join("/"),
    o.cep ? `CEP ${formatCep(o.cep)}` : null,
  ].filter((p) => p && String(p).trim().length > 0);
  return partes.length ? partes.join(" · ") : "—";
}

export default async function OficinaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const [oficina, planos, representantes] = await Promise.all([
    getOficinaById(supabase, id),
    listPlanos(supabase),
    listRepresentantes(supabase),
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
      <Link href="/admin/oficinas" className="text-sm text-muted hover:text-ink hover:underline">
        ← Oficinas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-semibold text-ink">{oficina.nome}</h1>
            <OficinaStatusBadge status={oficina.status} motivo={oficina.motivo_pausa} />
            {oficina.cobranca_pronta ? (
              <StatusBadge tone="sucesso">pronta p/ cobranca</StatusBadge>
            ) : (
              <StatusBadge tone="erro">sem CPF/CNPJ</StatusBadge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {oficina.whatsapp_principal} · {oficina.cidade ?? "—"} · Criada em{" "}
            {formatDate(oficina.created_at)} · origem {oficina.origem}
          </p>
        </div>
        <OficinaDetailActions
          oficina={oficina}
          planos={planos.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))}
          representantes={representantes
            .filter((r) => r.ativo)
            .map((r) => ({ id: r.id, nome: r.nome }))}
        />
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Cadastro e dados fiscais
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Responsavel</dt>
              <dd className="text-ink">{oficina.responsavel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">CPF / CNPJ</dt>
              <dd className="text-ink tabular-nums">
                {oficina.cpf_cnpj ? formatCpfCnpj(oficina.cpf_cnpj) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">E-mail</dt>
              <dd className="truncate text-ink">{oficina.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Representante</dt>
              <dd className="text-ink">{oficina.representante_nome ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Endereco</dt>
              <dd className="text-ink">{enderecoLinha(oficina)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Ticket medio</dt>
              <dd className="text-ink tabular-nums">{formatBRL(oficina.ticket_medio)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Trocas / mes</dt>
              <dd className="text-ink tabular-nums">{oficina.volume_trocas_mes ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Customer ASAAS</dt>
              <dd className="text-ink">
                {oficina.asaas_customer_id ? (
                  <span className="font-mono text-xs">{oficina.asaas_customer_id}</span>
                ) : (
                  <span className="text-muted">nao registrado</span>
                )}
              </dd>
            </div>
            {oficina.observacao ? (
              <div className="col-span-2">
                <dt className="text-xs text-muted">Observacao</dt>
                <dd className="text-ink">{oficina.observacao}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Plano e cobranca
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Plano</dt>
              <dd>
                <Link href="/admin/planos" className="font-medium text-ink hover:underline">
                  {oficina.plano_nome ?? "—"}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Preco efetivo</dt>
              <dd className="font-medium tabular-nums">
                {formatBRL(oficina.preco_efetivo)}
                <span className="ml-1 text-xs text-muted">
                  ({oficina.preco_negociado !== null ? "negociado" : "base"})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Preco base</dt>
              <dd className="tabular-nums text-muted">{formatBRL(oficina.preco_base)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Proximo vencimento</dt>
              <dd>{formatDate(oficina.proximo_vencimento)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Metricas (30 dias)
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Clientes cadastrados</dt>
              <dd className="text-lg font-semibold tabular-nums">{metrics.clientes_finais}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Lembretes enviados</dt>
              <dd className="text-lg font-semibold tabular-nums">{metrics.lembretes_enviados}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Retornos agendados</dt>
              <dd className="text-lg font-semibold tabular-nums">{metrics.retornos_concluidos}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Receita gerada</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatBRL(metrics.receita_gerada)}
              </dd>
            </div>
          </dl>
        </div>
        <OficinaLembreteConfigCard oficina={oficina} />
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Pagamentos (ultimos 6)
          </h2>
          <Link
            href={`/admin/pagamentos?oficina_id=${oficina.id}`}
            className="text-xs text-muted hover:underline"
          >
            Ver todos
          </Link>
        </div>
        <div className="overflow-x-auto border-t border-line-soft">
          {payments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">
              Nenhum pagamento ainda. Cobrancas aparecerao quando o Admin-6 estiver ativo.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-2">Data</th>
                  <th className="px-5 py-2">Valor</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2">Vencimento</th>
                  <th className="px-5 py-2">Pago em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2 text-muted">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-2 tabular-nums">{formatBRL(p.valor)}</td>
                    <td className="px-5 py-2 text-ink">{p.status}</td>
                    <td className="px-5 py-2 text-muted">{formatDate(p.vencimento)}</td>
                    <td className="px-5 py-2 text-muted">{formatDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Ultimas mensagens (PII mascarada)
        </h2>
        {messages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sem mensagens recentes.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    {m.direction === "inbound" ? "↓ in" : "↑ out"} · {m.cliente_nome_mascarado} ·{" "}
                    {m.cliente_whatsapp_mascarado}
                  </span>
                  <span>{formatDateTime(m.created_at)}</span>
                </div>
                <p className="mt-1 text-ink">{m.body_truncado}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Auditoria (ultimas 10)
        </h2>
        {audit.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sem entradas de auditoria.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {audit.map((a) => (
              <li key={a.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span className="font-medium text-ink">{ACAO_LABEL[a.acao] ?? a.acao}</span>
                  <span>{formatDateTime(a.created_at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {a.admin_nome ?? (a.admin_id === null ? "Sistema" : "Admin")}
                </p>
                {a.changes.length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-ink">
                    {a.changes.map((c, i) => (
                      <li key={i}>
                        <span className="text-muted">{c.field}:</span>{" "}
                        <span className="line-through decoration-muted/50">{c.from}</span>{" "}
                        <span className="text-muted">→</span> <span className="font-medium">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
