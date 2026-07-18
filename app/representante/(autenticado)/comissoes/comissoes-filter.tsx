"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/admin/ui";

// Filtro read-only do extrato: mes (YYYY-MM) + status. Atualiza a URL; a pagina
// (server) re-consulta escopada ao rep da sessao.
export function ComissoesFilter({ mes, status }: { mes: string; status: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (key: "mes" | "status", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Mês</span>
        <input
          type="month"
          value={mes}
          onChange={(e) => update("mes", e.target.value)}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Status</span>
        <Select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="w-44"
        >
          <option value="">Todos</option>
          <option value="prevista">Prevista</option>
          <option value="paga">Paga</option>
          <option value="cancelada">Cancelada</option>
        </Select>
      </label>
      {mes || status ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink transition hover:bg-paper-soft"
        >
          Limpar
        </button>
      ) : null}
    </div>
  );
}
