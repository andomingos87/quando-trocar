"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { PagamentoListFilters, PagamentoRow } from "@/lib/admin/pagamentos";
import { formatBRL, formatDate } from "@/lib/admin/format";

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800",
  pago: "bg-emerald-100 text-emerald-800",
  falhou: "bg-red-100 text-red-800",
  cancelado: "bg-slate-200 text-slate-700",
};

export function PagamentosClient({
  initial,
  filters,
}: {
  initial: { rows: PagamentoRow[]; total: number; page: number; pageSize: number };
  filters: PagamentoListFilters;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`/admin/pagamentos?${params.toString()}`);
  };

  const reenviar = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pagamentos/${id}/reenviar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao reenviar.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const cancelar = async (id: string) => {
    const justificativa = prompt("Justificativa para cancelar o pagamento:");
    if (!justificativa || !justificativa.trim()) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pagamentos/${id}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao cancelar.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(initial.total / initial.pageSize));

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Status
          </span>
          <select
            value={filters.status ?? ""}
            onChange={(e) => updateFilter("status", e.target.value || undefined)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="falhou">Falhou</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Periodo
          </span>
          <select
            value={filters.periodo ?? ""}
            onChange={(e) => updateFilter("periodo", e.target.value || undefined)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Oficina</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Pago em</th>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/oficinas/${p.oficina_id}`}
                    className="text-slate-900 hover:underline"
                  >
                    {p.oficina_nome ?? p.oficina_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatBRL(p.valor)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_BADGE[p.status] ?? ""
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDate(p.vencimento)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(p.paid_at)}</td>
                <td className="px-4 py-3 text-slate-600 tabular-nums">{p.tentativa}</td>
                <td className="px-4 py-3 text-right">
                  {p.status === "pendente" ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => reenviar(p.id)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Reenviar
                      </button>
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => cancelar(p.id)}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-slate-600">
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
                router.push(`/admin/pagamentos?${params.toString()}`);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={initial.page >= totalPages}
              onClick={() => {
                const params = new URLSearchParams(sp.toString());
                params.set("page", String(initial.page + 1));
                router.push(`/admin/pagamentos?${params.toString()}`);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
