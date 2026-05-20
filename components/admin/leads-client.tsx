"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { LeadListFilters, LeadListResult } from "@/lib/admin/leads";
import { formatDate, formatRelative } from "@/lib/admin/format";

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-line-soft text-ink",
  em_conversa: "bg-brand-soft text-brand-deep",
  qualificado: "bg-brand-soft text-brand-deep",
  interessado: "bg-brand-soft text-brand-deep",
  teste_aceito: "bg-orange-soft text-[#8a5a00]",
  convertido: "bg-cyan-soft text-ink",
  perdido: "bg-line text-muted",
};

export function LeadsClient({
  initial,
  filters,
}: {
  initial: LeadListResult;
  filters: LeadListFilters;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "todas" && value !== "") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.push(`/admin/leads?${params.toString()}`));
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
            placeholder="Nome, WhatsApp, oficina"
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
            <option value="novo">Novo</option>
            <option value="em_conversa">Em conversa</option>
            <option value="qualificado">Qualificado</option>
            <option value="interessado">Interessado</option>
            <option value="teste_aceito">Teste aceito</option>
            <option value="convertido">Convertido</option>
            <option value="perdido">Perdido</option>
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Origem
          </span>
          <select
            value={filters.origem ?? ""}
            onChange={(e) => updateFilter("origem", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Todas</option>
            <option value="landing_page">Landing page</option>
            <option value="manual_whatsapp">Manual WhatsApp</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Oficina</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Ultima msg</th>
              <th className="px-4 py-3 font-medium">Criado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-left text-muted">
                  Nenhum lead encontrado com esses filtros.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((row) => (
              <tr key={row.id} className="hover:bg-paper-soft">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/leads/${row.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {row.nome ?? row.nome_responsavel ?? "(sem nome)"}
                  </Link>
                  {row.nome_oficina ? (
                    <span className="ml-2 text-xs text-muted">
                      · {row.nome_oficina}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink tabular-nums">
                  {row.whatsapp}
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.oficina_id ? (
                    <Link
                      href={`/admin/oficinas/${row.oficina_id}`}
                      className="text-ink hover:underline"
                    >
                      ver
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
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
                <td className="px-4 py-3 text-ink">{row.origem}</td>
                <td className="px-4 py-3 text-muted">
                  {row.last_message_at ? formatRelative(row.last_message_at) : "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatDate(row.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? <Pagination totalPages={totalPages} initial={initial} /> : null}
    </>
  );
}

function Pagination({
  totalPages,
  initial,
}: {
  totalPages: number;
  initial: LeadListResult;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  return (
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
            router.push(`/admin/leads?${params.toString()}`);
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
            router.push(`/admin/leads?${params.toString()}`);
          }}
          className="rounded-lg border border-line px-3 py-1 disabled:opacity-50"
        >
          Proxima
        </button>
      </div>
    </div>
  );
}
