"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  OutboundListFilters,
  OutboundListResult,
} from "@/lib/admin/mensagens";
import { formatDateTime } from "@/lib/admin/format";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-line-soft text-ink",
  sent: "bg-cyan-soft text-ink",
  failed: "bg-red-soft text-red",
  retry_scheduled: "bg-orange-soft text-[#8a5a00]",
};

const RETRYABLE = new Set(["failed", "retry_scheduled"]);

export function MensagensClient({
  initial,
  filters,
}: {
  initial: OutboundListResult;
  filters: OutboundListFilters;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

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

  return (
    <>
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
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="retry_scheduled">Retry scheduled</option>
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
            <option value="text">Text</option>
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

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Destino</th>
              <th className="px-4 py-3 font-medium">Tipo / Template</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tent.</th>
              <th className="px-4 py-3 font-medium">Erro</th>
              <th className="px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3 font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-left text-muted">
                  Nenhuma mensagem encontrada.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((row) => (
              <tr key={row.id} className="hover:bg-paper-soft align-top">
                <td className="px-4 py-3 text-ink tabular-nums">
                  {row.to_whatsapp_mascarado}
                  {row.oficina_nome ? (
                    <div className="text-xs text-muted">{row.oficina_nome}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted">
                    {row.message_kind}
                  </div>
                  {row.template_name ? (
                    <div className="font-mono text-xs">{row.template_name}</div>
                  ) : null}
                  {row.body_truncado ? (
                    <div className="text-xs text-muted">{row.body_truncado}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_BADGE[row.status] ?? ""
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink tabular-nums">
                  {row.attempts ?? 0}
                </td>
                <td className="px-4 py-3 text-xs text-red">
                  {row.provider_error_code ? (
                    <div className="font-mono">{row.provider_error_code}</div>
                  ) : null}
                  {row.provider_error_message_truncado ? (
                    <div>{row.provider_error_message_truncado}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatDateTime(row.created_at)}
                </td>
                <td className="px-4 py-3">
                  {RETRYABLE.has(row.status) ? (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => retry(row.id)}
                      className="rounded-lg border border-line px-3 py-1 text-xs font-medium hover:bg-line-soft disabled:opacity-50"
                    >
                      {busyId === row.id ? "..." : "Retry"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
