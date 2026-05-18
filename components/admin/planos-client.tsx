"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PlanoWithUsage } from "@/lib/admin/planos";
import { PlanoFormModal } from "./plano-form-modal";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type ModalState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; plano: PlanoWithUsage };

export function PlanosClient({
  initialPlanos,
}: {
  initialPlanos: PlanoWithUsage[];
}) {
  const router = useRouter();
  const [planos] = useState(initialPlanos);
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const handleDeactivate = async (plano: PlanoWithUsage) => {
    if (plano.oficinas_vinculadas > 0) {
      setError(
        `Nao e possivel desativar: ${plano.oficinas_vinculadas} oficina(s) vinculada(s).`,
      );
      return;
    }
    if (!confirm(`Desativar o plano "${plano.nome}"?`)) return;
    setBusy(plano.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/planos/${plano.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao desativar plano.");
        return;
      }
      refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {planos.length} {planos.length === 1 ? "plano" : "planos"} no total
        </p>
        <button
          type="button"
          onClick={() => setModal({ open: true, mode: "create" })}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Novo plano
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Preco base</th>
              <th className="px-4 py-3 font-medium">Descricao</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3 font-medium">Oficinas</th>
              <th className="px-4 py-3 font-medium">Atualizado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {planos.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  Nenhum plano. Clique em <strong>Novo plano</strong> para criar.
                </td>
              </tr>
            ) : null}
            {planos.map((plano) => (
              <tr key={plano.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {plano.nome}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {currency.format(plano.preco_base)}
                </td>
                <td className="px-4 py-3 max-w-[240px] truncate text-slate-600">
                  {plano.descricao ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      plano.ativo
                        ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        : "inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700"
                    }
                  >
                    {plano.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {plano.oficinas_vinculadas}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {dateFmt.format(new Date(plano.updated_at))}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModal({ open: true, mode: "edit", plano })
                      }
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Editar
                    </button>
                    {plano.ativo ? (
                      <button
                        type="button"
                        disabled={busy === plano.id}
                        onClick={() => handleDeactivate(plano)}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {busy === plano.id ? "Desativando..." : "Desativar"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open ? (
        <PlanoFormModal
          mode={modal.mode}
          plano={modal.mode === "edit" ? modal.plano : null}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
