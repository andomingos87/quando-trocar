"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { OficinaDetail } from "@/lib/admin/oficinas";

type Modal =
  | { kind: "none" }
  | { kind: "status" }
  | { kind: "plano-preco" };

export function OficinaDetailActions({
  oficina,
  planos,
}: {
  oficina: OficinaDetail;
  planos: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const cobrancaManualEnabled =
    process.env.NEXT_PUBLIC_ADMIN_BILLING_ENABLED === "true";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setModal({ kind: "status" })}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
      >
        Editar status
      </button>
      <button
        type="button"
        onClick={() => setModal({ kind: "plano-preco" })}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
      >
        Editar plano/preco
      </button>
      {cobrancaManualEnabled ? (
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Disparar cobranca manual fora do ciclo?")) return;
            const res = await fetch(`/api/admin/oficinas/${oficina.id}/cobrar`, {
              method: "POST",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
              alert(data.message ?? "Erro ao disparar cobranca.");
              return;
            }
            router.refresh();
          }}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Disparar cobranca manual
        </button>
      ) : null}

      {modal.kind === "status" ? (
        <StatusModal
          oficina={oficina}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => {
            setModal({ kind: "none" });
            router.refresh();
          }}
        />
      ) : null}
      {modal.kind === "plano-preco" ? (
        <PlanoPrecoModal
          oficina={oficina}
          planos={planos}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => {
            setModal({ kind: "none" });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 px-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
        <header className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted hover:bg-line-soft hover:text-ink"
          >
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function StatusModal({
  oficina,
  onClose,
  onSaved,
}: {
  oficina: OficinaDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(oficina.status);
  const [motivo, setMotivo] = useState(oficina.motivo_pausa ?? "voluntaria");
  const [cancelName, setCancelName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { status };
      if (status === "pausada") payload.motivo_pausa = motivo;
      if (status === "ativa") payload.motivo_pausa = null;
      if (status === "cancelada") payload.cancelConfirmationName = cancelName;

      const res = await fetch(`/api/admin/oficinas/${oficina.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <ModalShell title="Editar status" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="w-full rounded-lg border border-line px-3 py-2"
          >
            <option value="ativa">Ativa</option>
            <option value="pausada">Pausada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </label>
        {status === "pausada" ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Motivo da pausa</span>
            <select
              value={motivo ?? ""}
              onChange={(e) => setMotivo(e.target.value as typeof motivo)}
              className="w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="voluntaria">Voluntaria</option>
              <option value="inadimplencia">Inadimplencia</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        ) : null}
        {status === "cancelada" ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">
              Confirme o nome da oficina para cancelar
            </span>
            <input
              type="text"
              value={cancelName}
              onChange={(e) => setCancelName(e.target.value)}
              placeholder={oficina.nome}
              className="w-full rounded-lg border border-red/40 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-red">
              Cancelamento e irreversivel por esta tela.
            </span>
          </label>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-muted"
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function PlanoPrecoModal({
  oficina,
  planos,
  onClose,
  onSaved,
}: {
  oficina: OficinaDetail;
  planos: Array<{ id: string; nome: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [planoId, setPlanoId] = useState(oficina.plano_id ?? planos[0]?.id ?? "");
  const [precoNegociado, setPrecoNegociado] = useState(
    oficina.preco_negociado !== null ? String(oficina.preco_negociado) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    if (planoId !== oficina.plano_id) payload.plano_id = planoId;
    if (precoNegociado === "") {
      payload.preco_negociado = null;
    } else {
      const n = Number(precoNegociado.replace(",", "."));
      if (Number.isNaN(n) || n < 0) {
        setError("Preco invalido.");
        setBusy(false);
        return;
      }
      payload.preco_negociado = n;
    }
    try {
      const res = await fetch(`/api/admin/oficinas/${oficina.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <ModalShell title="Editar plano e preco" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Plano</span>
          <select
            value={planoId}
            onChange={(e) => setPlanoId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2"
          >
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">
            Preco negociado (vazio = usa preco_base)
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={precoNegociado}
            onChange={(e) => setPrecoNegociado(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        {error ? (
          <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-muted"
          >
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
