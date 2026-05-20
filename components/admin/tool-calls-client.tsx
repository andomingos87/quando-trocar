"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  ToolCallListFilters,
  ToolCallListResult,
} from "@/lib/admin/tool-calls";
import { formatDateTime } from "@/lib/admin/format";

export function ToolCallsClient({
  initial,
  filters,
}: {
  initial: ToolCallListResult;
  filters: ToolCallListFilters;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`/admin/tool-calls?${params.toString()}`));
  };

  const totalPages = Math.max(1, Math.ceil(initial.total / initial.pageSize));

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Tool
          </span>
          <select
            value={filters.tool_name ?? ""}
            onChange={(e) => updateFilter("tool_name", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Todas</option>
            {initial.toolNames.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Agent mode
          </span>
          <select
            value={filters.agent_mode ?? ""}
            onChange={(e) => updateFilter("agent_mode", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Todos</option>
            <option value="vendas">Vendas</option>
            <option value="onboarding">Onboarding</option>
            <option value="operacao">Operacao</option>
            <option value="cliente_final_lembrete">Cliente final lembrete</option>
            <option value="suporte">Suporte</option>
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
              <th className="px-4 py-3 font-medium">Tool</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Alvo</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Criado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-left text-muted">
                  Nenhuma tool call encontrada.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((row) => {
              const isOpen = expanded === row.id;
              return (
                <>
                  <tr key={row.id} className="hover:bg-paper-soft">
                    <td className="px-4 py-3 font-mono text-xs text-ink">
                      {row.tool_name}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {row.agent_mode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {row.oficina_id ? (
                        <Link
                          href={`/admin/oficinas/${row.oficina_id}`}
                          className="hover:underline"
                        >
                          {row.oficina_nome ?? row.oficina_id.slice(0, 8)}
                        </Link>
                      ) : row.lead_id ? (
                        <Link
                          href={`/admin/leads/${row.lead_id}`}
                          className="hover:underline"
                        >
                          lead {row.lead_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.is_error
                            ? "bg-red-soft text-red"
                            : "bg-cyan-soft text-ink"
                        }`}
                      >
                        {row.is_error ? "erro" : "ok"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : row.id)}
                        className="rounded-lg border border-line px-3 py-1 text-xs font-medium hover:bg-line-soft"
                      >
                        {isOpen ? "Fechar" : "Payload"}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr key={`${row.id}-payload`}>
                      <td colSpan={6} className="bg-paper-soft px-4 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-muted">
                              Input
                            </p>
                            <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                              {JSON.stringify(row.input ?? {}, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-muted">
                              Output
                            </p>
                            <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                              {JSON.stringify(row.output ?? {}, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
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
                router.push(`/admin/tool-calls?${params.toString()}`);
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
                router.push(`/admin/tool-calls?${params.toString()}`);
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
