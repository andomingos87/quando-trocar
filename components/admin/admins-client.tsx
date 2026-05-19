"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdminUserRow } from "@/lib/admin/admins";
import { formatDateTime } from "@/lib/admin/format";
import { WhatsAppInput } from "@/components/admin/ui";

export function AdminsClient({
  initial,
  selfAdminId,
}: {
  initial: AdminUserRow[];
  selfAdminId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleAtivo = async (admin: AdminUserRow) => {
    const next = !admin.ativo;
    if (
      admin.id === selfAdminId &&
      !next &&
      !confirm("Voce esta tentando desativar seu proprio acesso. Continuar?")
    ) {
      return;
    }
    if (!confirm(`${next ? "Ativar" : "Desativar"} ${admin.nome}?`)) return;
    setBusy(admin.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark sm:w-auto"
        >
          Convidar admin
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
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3 font-medium">Ultimo acesso</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {initial.map((a) => (
              <tr key={a.id} className="hover:bg-paper-soft">
                <td className="px-4 py-3 font-medium text-ink">
                  {a.nome}
                  {a.id === selfAdminId ? (
                    <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-deep">
                      voce
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums text-ink">{a.whatsapp}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      a.ativo
                        ? "inline-flex rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-medium text-ink"
                        : "inline-flex rounded-full bg-line px-2 py-0.5 text-xs font-medium text-ink"
                    }
                  >
                    {a.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(a.ultimo_acesso_em)}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(a.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleAtivo(a)}
                    disabled={busy === a.id}
                    className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft disabled:opacity-50"
                  >
                    {a.ativo ? "Desativar" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <InviteModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function InviteModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ nome: "", whatsapp: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: form.nome.trim(), whatsapp: form.whatsapp.trim() }),
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
          <h2 className="text-lg font-semibold">Convidar admin</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-line-soft"
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Nome</span>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">WhatsApp</span>
            <WhatsAppInput
              required
              value={form.whatsapp}
              onChange={(v) => setForm({ ...form, whatsapp: v })}
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
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-muted"
            >
              {busy ? "Enviando..." : "Convidar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
