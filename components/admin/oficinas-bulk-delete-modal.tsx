"use client";

import { useState } from "react";

import { Button, Field, Input, Modal } from "@/components/admin/ui";

/** Palavra de confirmação deliberada (case-insensitive) para liberar a exclusão. */
const CONFIRM_WORD = "EXCLUIR";

type SelectedOficina = { id: string; nome: string };

/**
 * Modal de confirmação da exclusão em massa de oficinas. Lista os nomes
 * selecionados e exige digitar "EXCLUIR" para habilitar o botão — mesma postura
 * deliberada do delete individual, adaptada para o volume (não pede o nome de
 * cada oficina). Chama `DELETE /api/admin/oficinas` com os ids.
 */
export function OficinasBulkDeleteModal({
  oficinas,
  onClose,
  onDeleted,
}: {
  oficinas: SelectedOficina[];
  onClose: () => void;
  onDeleted: (deleted: number) => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const count = oficinas.length;
  const label = count === 1 ? "oficina" : "oficinas";
  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD && !busy;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/oficinas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: oficinas.map((o) => o.id), confirm: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        deleted?: number;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao excluir oficinas.");
        return;
      }
      onDeleted(data.deleted ?? count);
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Excluir ${count} ${label}`}
      subtitle="Remove as oficinas de todas as telas do admin. Irreversivel por esta tela."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="max-h-48 overflow-y-auto rounded-lg border border-line bg-paper-soft">
          <ul className="divide-y divide-line-soft text-sm">
            {oficinas.map((o) => (
              <li key={o.id} className="truncate px-3 py-2 text-ink" title={o.nome}>
                {o.nome}
              </li>
            ))}
          </ul>
        </div>

        <Field
          label={`Digite ${CONFIRM_WORD} para confirmar`}
          hint="A exclusao e irreversivel por esta tela."
        >
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDelete();
            }}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            className="border-red/40"
          />
        </Field>

        {error ? (
          <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={!canConfirm}>
            {busy ? "Excluindo..." : `Excluir ${count} ${label}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
