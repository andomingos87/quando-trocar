"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Select } from "@/components/admin/ui";
import type { ComissaoListFilters, ComissaoRow, ComissaoStatus } from "@/lib/admin/comissoes";
import { formatBRL, formatDateTime } from "@/lib/admin/format";

const STATUS_BADGE: Record<ComissaoStatus, string> = {
  prevista: "bg-orange-soft text-[#8a5a00]",
  paga: "bg-cyan-soft text-ink",
  cancelada: "bg-line text-muted",
};

const STATUS_LABEL: Record<ComissaoStatus, string> = {
  prevista: "Prevista",
  paga: "Paga",
  cancelada: "Cancelada",
};

export function ComissoesClient({
  initial,
  filters,
  representantes,
}: {
  initial: {
    rows: ComissaoRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPrevisto: number;
    totalPago: number;
  };
  filters: ComissaoListFilters;
  representantes: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pushFilters = (next: Partial<ComissaoListFilters>) => {
    const merged = { ...filters, ...next, page: next.page ?? 1 };
    const params = new URLSearchParams();
    if (merged.representante_id) params.set("representante_id", merged.representante_id);
    if (merged.status) params.set("status", merged.status);
    if (merged.mes) params.set("mes", merged.mes);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    router.push(`/admin/comissoes${params.size ? `?${params}` : ""}`);
  };

  const call = async (key: string, url: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro na operacao.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(null);
    }
  };

  const marcarPaga = (c: ComissaoRow) => call(c.id, `/api/admin/comissoes/${c.id}/pagar`);

  const cancelar = (c: ComissaoRow) => {
    const motivo = prompt(
      `Cancelar a comissao de ${formatBRL(c.valor)} de ${c.representante_nome ?? "?"}. Motivo:`,
    );
    if (!motivo?.trim()) return;
    void call(c.id, `/api/admin/comissoes/${c.id}/cancelar`, { motivo: motivo.trim() });
  };

  const pagarLote = () => {
    if (!filters.representante_id) return;
    const repNome =
      representantes.find((r) => r.id === filters.representante_id)?.nome ?? "representante";
    if (
      !confirm(
        `Marcar como pagas TODAS as comissoes previstas de ${repNome}${
          filters.mes ? ` em ${filters.mes}` : ""
        }?`,
      )
    ) {
      return;
    }
    void call("lote", "/api/admin/comissoes/pagar-lote", {
      representante_id: filters.representante_id,
      mes: filters.mes,
    });
  };

  const totalPages = Math.max(1, Math.ceil(initial.total / initial.pageSize));

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Previsto (a pagar)</p>
          <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">
            {formatBRL(initial.totalPrevisto)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Pago</p>
          <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">
            {formatBRL(initial.totalPago)}
          </p>
        </div>
        <div className="flex items-center justify-end">
          {filters.representante_id ? (
            <button
              type="button"
              onClick={pagarLote}
              disabled={busy === "lote"}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {busy === "lote" ? "Marcando..." : "Marcar previstas como pagas"}
            </button>
          ) : (
            <p className="text-xs text-muted">
              Filtre por representante para pagar em lote.
            </p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Representante
          </span>
          <Select
            value={filters.representante_id ?? ""}
            onChange={(e) => pushFilters({ representante_id: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {representantes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Status
          </span>
          <Select
            value={filters.status ?? ""}
            onChange={(e) =>
              pushFilters({ status: (e.target.value || undefined) as ComissaoStatus | undefined })
            }
          >
            <option value="">Todos</option>
            <option value="prevista">Prevista</option>
            <option value="paga">Paga</option>
            <option value="cancelada">Cancelada</option>
          </Select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Mes
          </span>
          <input
            type="month"
            value={filters.mes ?? ""}
            onChange={(e) => pushFilters({ mes: e.target.value || undefined })}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Representante</th>
              <th className="px-4 py-3 font-medium">Oficina</th>
              <th className="px-4 py-3 font-medium">Regra aplicada</th>
              <th className="px-4 py-3 font-medium">Base</th>
              <th className="px-4 py-3 font-medium">Comissao</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Gerada em</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-left text-muted">
                  Nenhuma comissao para os filtros. Comissoes aparecem quando um
                  pagamento de oficina atribuida e confirmado.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((c) => (
              <tr key={c.id} className="hover:bg-paper-soft">
                <td className="px-4 py-3 font-medium text-ink">
                  {c.representante_nome ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted">{c.oficina_nome ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {c.tipo === "percentual"
                    ? `${c.taxa_aplicada}%`
                    : `${formatBRL(c.taxa_aplicada)} fixo`}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted">{formatBRL(c.base_valor)}</td>
                <td className="px-4 py-3 font-medium tabular-nums text-ink">
                  {formatBRL(c.valor)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status]}`}
                    title={c.status === "cancelada" ? c.cancelada_motivo ?? undefined : undefined}
                  >
                    {STATUS_LABEL[c.status]}
                    {c.status === "paga" && c.paga_em
                      ? ` · ${formatDateTime(c.paga_em).slice(0, 10)}`
                      : ""}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatDateTime(c.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.status === "prevista" ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={busy === c.id}
                        onClick={() => marcarPaga(c)}
                        className="whitespace-nowrap rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft disabled:opacity-50"
                      >
                        {busy === c.id ? "..." : "Marcar paga"}
                      </button>
                      <button
                        type="button"
                        disabled={busy === c.id}
                        onClick={() => cancelar(c)}
                        className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-medium text-red hover:bg-red-soft disabled:opacity-50"
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
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Pagina {initial.page} de {totalPages} · {initial.total} comissoes
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={initial.page <= 1}
              onClick={() => pushFilters({ page: initial.page - 1 })}
              className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={initial.page >= totalPages}
              onClick={() => pushFilters({ page: initial.page + 1 })}
              className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
