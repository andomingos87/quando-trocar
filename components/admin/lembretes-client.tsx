"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type {
  LembreteListFilters,
  LembreteListResult,
} from "@/lib/admin/lembretes";
import { formatDateTime, formatRelative } from "@/lib/admin/format";

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-line-soft text-ink",
  enfileirado: "bg-brand-soft text-brand-deep",
  enviado: "bg-cyan-soft text-ink",
  respondido: "bg-cyan text-ink",
  agendado: "bg-brand-soft text-brand-deep",
  sem_resposta: "bg-orange-soft text-[#8a5a00]",
  cancelado: "bg-line text-muted",
  erro_envio: "bg-red-soft text-red",
};

export function LembretesClient({
  initial,
  filters,
}: {
  initial: LembreteListResult;
  filters: LembreteListFilters;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(sp.toString());
    if (value && value !== "todas" && value !== "") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => router.push(`/admin/lembretes?${params.toString()}`));
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
            placeholder="Veiculo, servico, oficina"
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
            <option value="pendente">Pendente</option>
            <option value="enfileirado">Enfileirado</option>
            <option value="enviado">Enviado</option>
            <option value="respondido">Respondido</option>
            <option value="agendado">Agendado</option>
            <option value="sem_resposta">Sem resposta</option>
            <option value="cancelado">Cancelado</option>
            <option value="erro_envio">Erro envio</option>
          </select>
        </label>
        <label className="block w-full text-sm sm:w-auto">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Periodo (agendado_para)
          </span>
          <select
            value={filters.periodo ?? ""}
            onChange={(e) => updateFilter("periodo", e.target.value || undefined)}
            className="w-full rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand sm:w-auto"
          >
            <option value="">Qualquer</option>
            <option value="ultimos_7d">Ultimos 7 dias</option>
            <option value="proximos_7d">Proximos 7 dias</option>
            <option value="mes_atual">Mes atual</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Veiculo</th>
              <th className="px-4 py-3 font-medium">Servico</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Agendado</th>
              <th className="px-4 py-3 font-medium">Oficina</th>
              <th className="px-4 py-3 font-medium">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-left text-muted">
                  Nenhum lembrete encontrado.
                </td>
              </tr>
            ) : null}
            {initial.rows.map((row) => (
              <tr key={row.id} className="hover:bg-paper-soft">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/lembretes/${row.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {row.cliente_nome ?? "—"}
                  </Link>
                  <span className="ml-2 text-xs text-muted">
                    {row.cliente_whatsapp_mascarado}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.veiculo_descricao ?? "—"}
                </td>
                <td className="px-4 py-3 text-ink">{row.servico_tipo ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_BADGE[row.status] ?? ""
                    }`}
                  >
                    {row.status}
                  </span>
                  {(row.attempts ?? 0) > 0 ? (
                    <span className="ml-1 text-xs text-muted">
                      ({row.attempts} tent.)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink">
                  {formatDateTime(row.scheduled_at)}
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.oficina_id ? (
                    <Link
                      href={`/admin/oficinas/${row.oficina_id}`}
                      className="hover:underline"
                    >
                      {row.oficina_nome ?? row.oficina_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatRelative(row.updated_at)}
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
                router.push(`/admin/lembretes?${params.toString()}`);
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
                router.push(`/admin/lembretes?${params.toString()}`);
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
