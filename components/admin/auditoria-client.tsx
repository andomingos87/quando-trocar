"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";

import type { AuditFilters, AuditEntryView } from "@/lib/admin/audit-queries";
import { formatDateTime } from "@/lib/admin/format";

export function AuditoriaClient({
  initial,
  filters,
  admins,
  acoes,
  entidades,
}: {
  initial: { rows: AuditEntryView[]; total: number; page: number; pageSize: number };
  filters: AuditFilters;
  admins: Array<{ id: string; nome: string }>;
  acoes: string[];
  entidades: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/admin/auditoria?${params.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(initial.total / initial.pageSize));

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Admin
          </span>
          <select
            value={filters.admin_id ?? ""}
            onChange={(e) => updateFilter("admin_id", e.target.value || undefined)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Entidade
          </span>
          <select
            value={filters.entidade ?? ""}
            onChange={(e) => updateFilter("entidade", e.target.value || undefined)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {entidades.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Acao
          </span>
          <select
            value={filters.acao ?? ""}
            onChange={(e) => updateFilter("acao", e.target.value || undefined)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            {acoes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Entidade ID
          </span>
          <input
            type="search"
            defaultValue={filters.entidade_id ?? ""}
            onBlur={(e) => updateFilter("entidade_id", e.target.value || undefined)}
            placeholder="uuid"
            className="w-56 rounded-lg border border-line px-3 py-1.5 text-sm font-mono"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Acao</th>
              <th className="px-4 py-3 font-medium">Entidade</th>
              <th className="px-4 py-3 font-medium">Entidade ID</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-left text-muted">
                  Nenhuma entrada com esses filtros.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className="cursor-pointer hover:bg-paper-soft"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <td className="px-4 py-3 text-muted">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">{r.admin_label}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.acao}</td>
                  <td className="px-4 py-3 text-ink">{r.entidade}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {r.entidade_id ? r.entidade_id.slice(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{r.ip ?? "—"}</td>
                </tr>
                {expanded === r.id ? (
                  <tr className="bg-paper-soft">
                    <td colSpan={6} className="px-4 py-3">
                      <PayloadViewer payload={r.payload} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
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
                router.push(`/admin/auditoria?${params.toString()}`);
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
                router.push(`/admin/auditoria?${params.toString()}`);
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

function PayloadViewer({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object") {
    return (
      <pre className="overflow-x-auto rounded-lg border border-line bg-white p-3 text-xs">
        {JSON.stringify(payload, null, 2)}
      </pre>
    );
  }
  const obj = payload as Record<string, unknown>;
  if (obj.before && obj.after) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-red">Antes</p>
          <pre className="overflow-x-auto rounded-lg border border-red/30 bg-red-soft p-3 text-xs">
            {JSON.stringify(obj.before, null, 2)}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink">
            Depois
          </p>
          <pre className="overflow-x-auto rounded-lg border border-cyan/40 bg-cyan-soft p-3 text-xs">
            {JSON.stringify(obj.after, null, 2)}
          </pre>
        </div>
      </div>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-white p-3 text-xs">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}
