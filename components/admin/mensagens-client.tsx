"use client";

import { ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type {
  OutboundListFilters,
  OutboundListResult,
  OutboundListRow,
  OutboundSummary,
} from "@/lib/admin/mensagens";
import { Card, CardHint, CardLabel, CardValue } from "@/components/admin/ui";
import { formatDateTime, formatRelative } from "@/lib/admin/format";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-line-soft text-ink",
  sent: "bg-cyan-soft text-ink",
  failed: "bg-red-soft text-red",
  retry_scheduled: "bg-orange-soft text-[#8a5a00]",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviada",
  failed: "Falha",
  retry_scheduled: "Retry agendado",
};

const RETRYABLE = new Set(["failed", "retry_scheduled"]);

type Conversa = {
  key: string;
  destino: string;
  oficinaNome: string | null;
  rows: OutboundListRow[];
  lastActivity: string;
  counts: Record<string, number>;
};

function groupByConversa(rows: OutboundListRow[]): Conversa[] {
  const map = new Map<string, Conversa>();
  for (const row of rows) {
    const key = row.conversa_id ?? `wa:${row.to_whatsapp_mascarado}`;
    let grupo = map.get(key);
    if (!grupo) {
      grupo = {
        key,
        destino: row.to_whatsapp_mascarado,
        oficinaNome: row.oficina_nome,
        rows: [],
        lastActivity: row.created_at,
        counts: {},
      };
      map.set(key, grupo);
    }
    grupo.rows.push(row);
    if (row.created_at > grupo.lastActivity) grupo.lastActivity = row.created_at;
    grupo.counts[row.status] = (grupo.counts[row.status] ?? 0) + 1;
  }
  // rows ja vem ordenado por created_at desc; grupos seguem a primeira aparicao.
  return [...map.values()];
}

export function MensagensClient({
  initial,
  summary,
  filters,
}: {
  initial: OutboundListResult;
  summary: OutboundSummary;
  filters: OutboundListFilters;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const conversas = useMemo(() => groupByConversa(initial.rows), [initial.rows]);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => (conversas.length > 6 ? new Set(conversas.map((c) => c.key)) : new Set()),
  );

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "todas" && value !== "") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`/admin/mensagens?${params.toString()}`));
  };

  const retry = async (id: string) => {
    if (!confirm("Reenfileirar esta mensagem? O worker tentara enviar de novo.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/mensagens/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "retry" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        alert(data.message ?? "Erro ao reenfileirar.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(initial.total / initial.pageSize));
  const pendentes = summary.pending + summary.retry_scheduled;

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardLabel>Total no filtro</CardLabel>
          <CardValue>{summary.total}</CardValue>
          <CardHint>Independente do status selecionado</CardHint>
        </Card>
        <Card tone={summary.sent > 0 ? "sucesso" : "default"}>
          <CardLabel>Enviadas</CardLabel>
          <CardValue>{summary.sent}</CardValue>
          <CardHint>
            {summary.taxaEntrega === null
              ? "Sem entregas resolvidas"
              : `Taxa de entrega ${summary.taxaEntrega}%`}
          </CardHint>
        </Card>
        <Card tone={summary.failed > 0 ? "erro" : "default"}>
          <CardLabel>Falhas</CardLabel>
          <CardValue>{summary.failed}</CardValue>
          <CardHint>Erros definitivos do provedor</CardHint>
        </Card>
        <Card tone={pendentes > 0 ? "atencao" : "default"}>
          <CardLabel>Na fila</CardLabel>
          <CardValue>{pendentes}</CardValue>
          <CardHint>
            {summary.pending} pendente{summary.pending === 1 ? "" : "s"} ·{" "}
            {summary.retry_scheduled} retry
          </CardHint>
        </Card>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Busca
          </span>
          <input
            type="search"
            defaultValue={filters.busca ?? ""}
            onBlur={(e) => updateFilter("busca", e.target.value || undefined)}
            placeholder="WhatsApp ou template"
            className="w-full sm:w-64 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Status
          </span>
          <select
            value={filters.status ?? "todas"}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="todas">Todos</option>
            <option value="pending">Pendente</option>
            <option value="sent">Enviada</option>
            <option value="failed">Falha</option>
            <option value="retry_scheduled">Retry agendado</option>
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Tipo
          </span>
          <select
            value={filters.message_kind ?? ""}
            onChange={(e) => updateFilter("message_kind", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Todos</option>
            <option value="text">Texto</option>
            <option value="template">Template</option>
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Periodo
          </span>
          <select
            value={filters.periodo ?? ""}
            onChange={(e) => updateFilter("periodo", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Qualquer</option>
            <option value="ultimas_24h">Ultimas 24h</option>
            <option value="ultimos_7d">Ultimos 7 dias</option>
            <option value="ultimos_30d">Ultimos 30 dias</option>
          </select>
        </label>
      </div>

      {conversas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-sm text-muted">
          Nenhuma mensagem encontrada.
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {conversas.length} conversa{conversas.length === 1 ? "" : "s"} nesta pagina
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCollapsed(new Set())}
              className="font-medium text-ink hover:text-brand"
            >
              Expandir tudo
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(new Set(conversas.map((c) => c.key)))}
              className="font-medium text-ink hover:text-brand"
            >
              Recolher tudo
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {conversas.map((conversa) => {
          const isCollapsed = collapsed.has(conversa.key);
          return (
            <div
              key={conversa.key}
              className="overflow-hidden rounded-2xl border border-line bg-white"
            >
              <button
                type="button"
                onClick={() => toggle(conversa.key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper-soft"
              >
                <ChevronRight
                  size={16}
                  className={`shrink-0 text-muted transition-transform ${
                    isCollapsed ? "" : "rotate-90"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-ink tabular-nums">
                      {conversa.destino}
                    </span>
                    {conversa.oficinaNome ? (
                      <span className="truncate text-xs text-muted">
                        · {conversa.oficinaNome}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {conversa.rows.length} mensage{conversa.rows.length === 1 ? "m" : "ns"} ·
                    ultima ha {formatRelative(conversa.lastActivity)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {(["sent", "retry_scheduled", "pending", "failed"] as const)
                    .filter((s) => conversa.counts[s])
                    .map((s) => (
                      <span
                        key={s}
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[s]}`}
                        title={STATUS_LABEL[s]}
                      >
                        {conversa.counts[s]}
                      </span>
                    ))}
                </div>
              </button>

              {isCollapsed ? null : (
                <ul className="divide-y divide-line-soft border-t border-line-soft">
                  {conversa.rows.map((row) => (
                    <li
                      key={row.id}
                      className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-start"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[row.status] ?? ""
                            }`}
                          >
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-wide text-muted">
                            {row.message_kind === "template" ? "Template" : "Texto"}
                          </span>
                          {row.template_name ? (
                            <span className="font-mono text-xs text-ink">
                              {row.template_name}
                            </span>
                          ) : null}
                          {row.attempts && row.attempts > 0 ? (
                            <span className="text-xs text-muted tabular-nums">
                              {row.attempts} tentativa{row.attempts === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                        {row.body_truncado ? (
                          <p className="mt-1 text-sm text-ink">{row.body_truncado}</p>
                        ) : null}
                        {row.provider_error_code ||
                        row.provider_error_message_truncado ? (
                          <p className="mt-1 text-xs text-red">
                            {row.provider_error_code ? (
                              <span className="font-mono">{row.provider_error_code} </span>
                            ) : null}
                            {row.provider_error_message_truncado}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted">
                          {formatDateTime(row.created_at)}
                        </p>
                      </div>
                      <div className="sm:pl-4">
                        {RETRYABLE.has(row.status) ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => retry(row.id)}
                            className="rounded-lg border border-line px-3 py-1 text-xs font-medium hover:bg-line-soft disabled:opacity-50"
                          >
                            {busyId === row.id ? "..." : "Reenviar"}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Pagina {initial.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={initial.page <= 1}
              onClick={() => {
                const params = new URLSearchParams(sp.toString());
                params.set("page", String(initial.page - 1));
                router.push(`/admin/mensagens?${params.toString()}`);
              }}
              className="rounded-lg border border-line px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={initial.page >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(sp.toString());
                params.set("page", String(initial.page + 1));
                router.push(`/admin/mensagens?${params.toString()}`);
              }}
              className="rounded-lg border border-line px-3 py-1 disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
