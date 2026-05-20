"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { LembreteDetail } from "@/lib/admin/lembretes";

const CANCELLABLE = new Set(["pendente", "enfileirado", "agendado"]);

export function LembreteDetailActions({
  lembrete,
}: {
  lembrete: LembreteDetail;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const canCancel = CANCELLABLE.has(lembrete.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canCancel ? (
        <button
          type="button"
          onClick={() => setModal(true)}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
        >
          Cancelar lembrete
        </button>
      ) : null}
      {modal ? (
        <CancelarModal
          lembrete={lembrete}
          onClose={() => setModal(false)}
          onSaved={() => {
            setModal(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CancelarModal({
  lembrete,
  onClose,
  onSaved,
}: {
  lembrete: LembreteDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lembretes/${lembrete.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "cancelar", motivo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 px-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
        <header className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Cancelar lembrete</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted hover:bg-line-soft hover:text-ink"
          >
            ✕
          </button>
        </header>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Motivo</span>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ex.: cliente pediu pra parar"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
        </label>
        {error ? (
          <p className="mt-2 rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-muted"
          >
            {busy ? "Salvando..." : "Cancelar lembrete"}
          </button>
        </div>
      </div>
    </div>
  );
}
