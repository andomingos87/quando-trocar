"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  OficinaListFilters,
  OficinaListResult,
} from "@/lib/admin/oficinas";
import { formatBRL, formatDate, formatRelative } from "@/lib/admin/format";
import { OficinaCreateModal } from "./oficina-create-modal";

const STATUS_BADGE: Record<string, string> = {
  ativa: "bg-cyan-soft text-ink",
  pausada: "bg-orange-soft text-[#8a5a00]",
  cancelada: "bg-line text-muted",
};

export function OficinasClient({
  initial,
  filters,
  planos,
}: {
  initial: OficinaListResult;
  filters: OficinaListFilters;
  planos: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "todas" && value !== "") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.push(`/admin/oficinas?${params.toString()}`));
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
            placeholder="Nome, WhatsApp, cidade"
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
            <option value="todas">Todas</option>
            <option value="ativa">Ativa</option>
            <option value="pausada">Pausada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Plano
          </span>
          <select
            value={filters.plano_id ?? ""}
            onChange={(e) => updateFilter("plano_id", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Todos</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
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
            <option value="landing_whatsapp">Landing WhatsApp</option>
            <option value="manual">Manual</option>
            <option value="importacao">Importacao</option>
          </select>
        </label>
        {filters.status === "pausada" ? (
          <label className="block w-full text-sm sm:w-auto">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Motivo
            </span>
            <select
              value={filters.motivo_pausa ?? ""}
              onChange={(e) => updateFilter("motivo_pausa", e.target.value || undefined)}
              className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
            >
              <option value="">Todos</option>
              <option value="inadimplencia">Inadimplencia</option>
              <option value="voluntaria">Voluntaria</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        ) : null}
        <div className="w-full sm:ml-auto sm:w-auto">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark sm:w-auto"
          >
            Nova oficina
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Cidade</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Preco</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 font-medium">Ultima atividade</th>
              <th className="px-4 py-3 font-medium">Criada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-left text-muted">
                  Nenhuma oficina encontrada com esses filtros.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((row) => (
              <tr key={row.id} className="hover:bg-paper-soft">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/oficinas/${row.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {row.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink tabular-nums">
                  {row.whatsapp_principal}
                </td>
                <td className="px-4 py-3 text-ink">{row.cidade ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_BADGE[row.status] ?? ""
                    }`}
                  >
                    {row.status}
                  </span>
                  {row.motivo_pausa ? (
                    <span className="ml-1 text-xs text-muted">
                      ({row.motivo_pausa})
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink">{row.plano_nome ?? "—"}</td>
                <td className="px-4 py-3 text-ink">
                  <span className="tabular-nums">{formatBRL(row.preco_efetivo)}</span>
                  {row.preco_negociado !== null ? (
                    <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                      negociado
                    </span>
                  ) : (
                    <span className="ml-1 rounded bg-line-soft px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      base
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink">
                  {formatDate(row.proximo_vencimento)}
                </td>
                <td className="px-4 py-3 text-muted">
                  {row.ultima_atividade_em ? formatRelative(row.ultima_atividade_em) : "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatDate(row.created_at)}
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
                router.push(`/admin/oficinas?${params.toString()}`);
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
                router.push(`/admin/oficinas?${params.toString()}`);
              }}
              className="rounded-lg border border-line px-3 py-1 disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <OficinaCreateModal
          planos={planos}
          onClose={() => setModalOpen(false)}
          onSaved={(id) => {
            setModalOpen(false);
            router.push(`/admin/oficinas/${id}`);
          }}
        />
      ) : null}
    </>
  );
}
