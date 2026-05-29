"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import {
  agentModeLabel,
  toolDescription,
  toolKind,
  toolLabel,
  type ToolKind,
} from "@/lib/admin/tool-calls-catalog";
import type {
  ToolCallListFilters,
  ToolCallListResult,
} from "@/lib/admin/tool-calls";
import { formatDateTime } from "@/lib/admin/format";

const KIND_CHIP: Record<ToolKind, string> = {
  acao: "bg-cyan-soft text-ink",
  leitura: "bg-line-soft text-muted",
  ignorado: "bg-paper-soft text-muted",
  seguranca: "bg-orange-soft text-ink",
  erro: "bg-red-soft text-red",
};

function Tooltip({ text }: { text: string }) {
  if (!text) return null;
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        tabIndex={0}
        aria-label="O que é esta ação"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:text-brand focus:text-brand focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-line bg-ink px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

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
            Ação
          </span>
          <select
            value={filters.tool_name ?? ""}
            onChange={(e) => updateFilter("tool_name", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Todas as ações</option>
            {initial.toolNames.map((t) => (
              <option key={t} value={t}>
                {toolLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Agente
          </span>
          <select
            value={filters.agent_mode ?? ""}
            onChange={(e) => updateFilter("agent_mode", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Todos os agentes</option>
            <option value="vendas">Vendas</option>
            <option value="onboarding">Onboarding</option>
            <option value="operacao">Operação</option>
            <option value="cliente_final_lembrete">Cliente final</option>
            <option value="suporte">Suporte</option>
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Período
          </span>
          <select
            value={filters.periodo ?? ""}
            onChange={(e) => updateFilter("periodo", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Qualquer data</option>
            <option value="ultimas_24h">Últimas 24h</option>
            <option value="ultimos_7d">Últimos 7 dias</option>
            <option value="ultimos_30d">Últimos 30 dias</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Agente</th>
              <th className="px-4 py-3 font-medium">Quem / oficina</th>
              <th className="px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-left text-muted">
                  Nenhuma ação encontrada com esses filtros.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((row) => {
              const isOpen = expanded === row.id;
              const desc = toolDescription(row.tool_name);
              return (
                <>
                  <tr key={row.id} className="hover:bg-paper-soft">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${KIND_CHIP[toolKind(row.tool_name)]}`}
                        >
                          {toolLabel(row.tool_name)}
                        </span>
                        <Tooltip text={desc} />
                      </div>
                      <span className="mt-1 block font-mono text-[11px] text-muted">
                        {row.tool_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {agentModeLabel(row.agent_mode)}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {row.oficina_id ? (
                        <Link
                          href={`/admin/oficinas/${row.oficina_id}`}
                          className="text-brand hover:underline"
                        >
                          {row.oficina_nome ?? row.oficina_id.slice(0, 8)}
                        </Link>
                      ) : row.lead_id ? (
                        <Link
                          href={`/admin/leads/${row.lead_id}`}
                          className="text-brand hover:underline"
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
                        {isOpen ? "Fechar" : "Ver detalhes"}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr key={`${row.id}-payload`}>
                      <td colSpan={6} className="bg-paper-soft px-4 py-3">
                        {desc ? (
                          <p className="mb-3 text-xs text-muted">{desc}</p>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-muted">
                              Entrada (o que o agente enviou)
                            </p>
                            <pre className="mt-1 max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                              {JSON.stringify(row.input ?? {}, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-muted">
                              Saída (resultado da ação)
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
            Página {initial.page} de {totalPages}
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
              Próxima
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
