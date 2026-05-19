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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {planos.length} {planos.length === 1 ? "plano" : "planos"} no total
        </p>
        <button
          type="button"
          onClick={() => setModal({ open: true, mode: "create" })}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:w-auto"
        >
          Novo plano
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
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
          <tbody className="divide-y divide-line-soft">
            {planos.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-left text-muted"
                >
                  Nenhum plano. Clique em <strong>Novo plano</strong> para criar.
                </td>
              </tr>
            ) : null}
            {planos.map((plano) => (
              <tr key={plano.id} className="hover:bg-paper-soft">
                <td className="px-4 py-3 font-medium text-ink">
                  {plano.nome}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {currency.format(plano.preco_base)}
                </td>
                <td className="px-4 py-3 max-w-[240px] truncate text-muted">
                  {plano.descricao ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      plano.ativo
                        ? "inline-flex rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-medium text-ink"
                        : "inline-flex rounded-full bg-line px-2 py-0.5 text-xs font-medium text-ink"
                    }
                  >
                    {plano.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {plano.oficinas_vinculadas}
                </td>
                <td className="px-4 py-3 text-muted">
                  {dateFmt.format(new Date(plano.updated_at))}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setModal({ open: true, mode: "edit", plano })
                      }
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft"
                    >
                      Editar
                    </button>
                    {plano.ativo ? (
                      <button
                        type="button"
                        disabled={busy === plano.id}
                        onClick={() => handleDeactivate(plano)}
                        className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-medium text-red hover:bg-red-soft disabled:opacity-50"
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
