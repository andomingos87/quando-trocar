"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type {
  OficinaListFilters,
  OficinaListResult,
  OficinaSortKey,
} from "@/lib/admin/oficinas";
import { formatBRL, formatDate, formatRelative } from "@/lib/admin/format";
import { Button, StatusBadge } from "@/components/admin/ui";
import { OficinaStatusBadge } from "@/components/admin/oficina-status-badge";
import { OficinaFormModal } from "./oficina-form-modal";
import { OficinasBulkDeleteModal } from "./oficinas-bulk-delete-modal";

const SORT_LABEL: Record<OficinaSortKey, string> = {
  nome: "Nome",
  cidade: "Cidade",
  status: "Status",
  proximo_vencimento: "Vencimento",
  created_at: "Criada",
};

export function OficinasClient({
  initial,
  filters,
  planos,
  representantes,
}: {
  initial: OficinaListResult;
  filters: OficinaListFilters;
  planos: Array<{ id: string; nome: string }>;
  representantes: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<OficinaListResult["rows"][number] | null>(null);
  const [search, setSearch] = useState(filters.busca ?? "");

  // Seleção em massa — restrita à página atual (os ids visíveis).
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const rowIds = initial.rows.map((r) => r.id);
  const rowIdsKey = rowIds.join(",");

  // Ao paginar/filtrar/ordenar as linhas mudam — zera a seleção para não
  // carregar ids que saíram da tela.
  useEffect(() => {
    setSelected(new Set());
  }, [rowIdsKey]);

  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.has(id));
  const someSelected = rowIds.some((id) => selected.has(id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rowIds.forEach((id) => next.delete(id));
      else rowIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedRows = initial.rows.filter((r) => selected.has(r.id));

  const pushParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    startTransition(() => router.push(`/admin/oficinas?${params.toString()}`));
  };

  const updateFilter = (key: string, value: string | undefined) => {
    pushParams((params) => {
      if (value && value !== "todas" && value !== "") params.set(key, value);
      else params.delete(key);
      params.delete("page");
    });
  };

  // Busca com debounce (400ms), alem de Enter (imediato) e botao limpar.
  useEffect(() => {
    const current = filters.busca ?? "";
    if (search === current) return;
    const t = setTimeout(() => updateFilter("busca", search.trim() || undefined), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleSort = (key: OficinaSortKey) => {
    const nextDir = initial.sort === key && initial.dir === "asc" ? "desc" : "asc";
    pushParams((params) => {
      params.set("sort", key);
      params.set("dir", nextDir);
      params.delete("page");
    });
  };

  const totalPages = Math.max(1, Math.ceil(initial.total / initial.pageSize));
  const firstItem = initial.total === 0 ? 0 : (initial.page - 1) * initial.pageSize + 1;
  const lastItem = Math.min(initial.page * initial.pageSize, initial.total);

  const SortHeader = ({ k, className }: { k: OficinaSortKey; className?: string }) => {
    const active = initial.sort === k;
    return (
      <th className={`px-4 py-3 font-medium ${className ?? ""}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
        >
          {SORT_LABEL[k]}
          <span className="text-[10px]">{active ? (initial.dir === "asc" ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Busca
          </span>
          <div className="relative sm:w-72">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateFilter("busca", search.trim() || undefined);
              }}
              placeholder="Nome, WhatsApp, cidade, CPF/CNPJ, e-mail"
              className="w-full rounded-lg border border-line px-3 py-1.5 pr-8 text-sm outline-none focus:border-brand"
            />
            {search ? (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                ✕
              </button>
            ) : null}
          </div>
        </label>
        <FilterSelect
          label="Status"
          value={filters.status ?? "todas"}
          onChange={(v) => updateFilter("status", v)}
          options={[
            ["todas", "Todas"],
            ["ativa", "Ativa"],
            ["pausada", "Pausada"],
            ["cancelada", "Cancelada"],
          ]}
        />
        <FilterSelect
          label="Plano"
          value={filters.plano_id ?? ""}
          onChange={(v) => updateFilter("plano_id", v || undefined)}
          options={[["", "Todos"], ...planos.map((p) => [p.id, p.nome] as [string, string])]}
        />
        <FilterSelect
          label="Representante"
          value={filters.representante_id ?? ""}
          onChange={(v) => updateFilter("representante_id", v || undefined)}
          options={[["", "Todos"], ...representantes.map((r) => [r.id, r.nome] as [string, string])]}
        />
        <FilterSelect
          label="Cobranca"
          value={filters.cobranca ?? ""}
          onChange={(v) => updateFilter("cobranca", v || undefined)}
          options={[
            ["", "Todas"],
            ["pronta", "Pronta (com CPF/CNPJ)"],
            ["sem_documento", "Sem CPF/CNPJ"],
          ]}
        />
        <FilterSelect
          label="Origem"
          value={filters.origem ?? ""}
          onChange={(v) => updateFilter("origem", v || undefined)}
          options={[
            ["", "Todas"],
            ["landing_whatsapp", "Landing WhatsApp"],
            ["manual", "Manual"],
            ["importacao", "Importacao"],
          ]}
        />
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <a
            href={`/api/admin/oficinas/export?${sp.toString()}`}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-paper-soft sm:flex-none"
          >
            Exportar CSV
          </a>
          <Button onClick={() => setModalOpen(true)} className="flex-1 sm:flex-none">
            Nova oficina
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper-soft px-4 py-2.5">
          <span className="text-sm font-medium text-ink">
            {selected.size} {selected.size === 1 ? "oficina selecionada" : "oficinas selecionadas"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm text-muted hover:text-ink"
            >
              Limpar selecao
            </button>
            <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              Excluir selecionadas
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={`overflow-x-auto rounded-2xl border border-line bg-white transition-opacity ${
          isPending ? "opacity-60" : ""
        }`}
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  aria-label="Selecionar todas as oficinas da pagina"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={rowIds.length === 0}
                  className="h-4 w-4 accent-brand"
                />
              </th>
              <SortHeader k="nome" />
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <SortHeader k="cidade" />
              <SortHeader k="status" />
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Preco</th>
              <th className="px-4 py-3 font-medium">Representante</th>
              <SortHeader k="proximo_vencimento" />
              <th className="px-4 py-3 font-medium">Ultima atividade</th>
              <th className="px-4 py-3 font-medium">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center">
                  <p className="text-sm font-medium text-ink">Nenhuma oficina encontrada</p>
                  <p className="mt-1 text-sm text-muted">
                    Ajuste os filtros ou cadastre uma nova oficina.
                  </p>
                  <Button className="mt-4" onClick={() => setModalOpen(true)}>
                    Nova oficina
                  </Button>
                </td>
              </tr>
            ) : null}
            {initial.rows.map((row) => (
              <tr
                key={row.id}
                className={`hover:bg-paper-soft ${selected.has(row.id) ? "bg-brand-soft/40" : ""}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${row.nome}`}
                    checked={selected.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    className="h-4 w-4 accent-brand"
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/oficinas/${row.id}`}
                    className="font-medium text-ink hover:text-brand hover:underline"
                  >
                    {row.nome}
                  </Link>
                  {!row.cobranca_pronta ? (
                    <StatusBadge tone="erro" className="ml-2 align-middle">
                      sem CPF/CNPJ
                    </StatusBadge>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink tabular-nums">{row.whatsapp_principal}</td>
                <td className="px-4 py-3 text-ink">{row.cidade ?? "—"}</td>
                <td className="px-4 py-3">
                  <OficinaStatusBadge status={row.status} motivo={row.motivo_pausa} />
                </td>
                <td className="px-4 py-3 text-ink">{row.plano_nome ?? "—"}</td>
                <td className="px-4 py-3 text-ink">
                  <span className="tabular-nums">{formatBRL(row.preco_efetivo)}</span>
                  <span
                    className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      row.preco_negociado !== null
                        ? "bg-brand-soft text-brand-deep"
                        : "bg-line-soft text-muted"
                    }`}
                  >
                    {row.preco_negociado !== null ? "negociado" : "base"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{row.representante_nome ?? "—"}</td>
                <td className="px-4 py-3 text-ink">{formatDate(row.proximo_vencimento)}</td>
                <td className="px-4 py-3 text-muted">
                  {row.ultima_atividade_em ? formatRelative(row.ultima_atividade_em) : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setEditRow(row)}
                    className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          {initial.total === 0
            ? "Nenhum resultado"
            : `Mostrando ${firstItem}–${lastItem} de ${initial.total}`}
        </span>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <span>
              Pagina {initial.page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={initial.page <= 1}
              onClick={() => pushParams((p) => p.set("page", String(initial.page - 1)))}
              className="rounded-lg border border-line px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={initial.page >= totalPages}
              onClick={() => pushParams((p) => p.set("page", String(initial.page + 1)))}
              className="rounded-lg border border-line px-3 py-1 disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <OficinaFormModal
          mode="create"
          planos={planos}
          representantes={representantes}
          onClose={() => setModalOpen(false)}
          onSaved={(id) => {
            setModalOpen(false);
            if (id) router.push(`/admin/oficinas/${id}`);
          }}
        />
      ) : null}

      {editRow ? (
        <OficinaFormModal
          mode="edit"
          oficina={editRow}
          planos={planos}
          representantes={representantes}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            startTransition(() => router.refresh());
          }}
        />
      ) : null}

      {bulkDeleteOpen && selectedRows.length > 0 ? (
        <OficinasBulkDeleteModal
          oficinas={selectedRows.map((r) => ({ id: r.id, nome: r.nome }))}
          onClose={() => setBulkDeleteOpen(false)}
          onDeleted={() => {
            setBulkDeleteOpen(false);
            setSelected(new Set());
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block w-full text-sm sm:w-auto">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
