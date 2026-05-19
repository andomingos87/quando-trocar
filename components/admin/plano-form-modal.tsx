"use client";

import { useEffect, useState } from "react";

import type { PlanoWithUsage } from "@/lib/admin/planos";

type Mode = "create" | "edit";

type FormState = {
  nome: string;
  preco_base: string;
  descricao: string;
  ativo: boolean;
};

export function PlanoFormModal({
  mode,
  plano,
  onClose,
  onSaved,
}: {
  mode: Mode;
  plano: PlanoWithUsage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    nome: plano?.nome ?? "",
    preco_base: plano ? String(plano.preco_base) : "",
    descricao: plano?.descricao ?? "",
    ativo: plano ? plano.ativo : true,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const precoBaseNumber = Number(form.preco_base.replace(",", "."));
  const precoBaseChanged =
    mode === "edit" && plano && precoBaseNumber !== plano.preco_base;
  const oficinasPotencialmenteAfetadas =
    precoBaseChanged && plano ? plano.oficinas_vinculadas : 0;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!form.nome.trim()) {
      setError("Nome obrigatorio.");
      setSubmitting(false);
      return;
    }
    if (Number.isNaN(precoBaseNumber) || precoBaseNumber < 0) {
      setError("Preco base deve ser numero >= 0.");
      setSubmitting(false);
      return;
    }

    const url =
      mode === "create"
        ? "/api/admin/planos"
        : `/api/admin/planos/${plano!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const payload =
      mode === "create"
        ? {
            nome: form.nome.trim(),
            preco_base: precoBaseNumber,
            descricao: form.descricao.trim() || null,
            ativo: form.ativo,
          }
        : {
            nome: form.nome.trim(),
            preco_base: precoBaseNumber,
            descricao: form.descricao.trim() || null,
            ativo: form.ativo,
          };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao salvar.");
        return;
      }
      onSaved();
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 px-4">
      <div
        onClick={onClose}
        className="absolute inset-0"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "create" ? "Novo plano" : "Editar plano"}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Sera registrado em <code>admin_audit_log</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-line-soft hover:text-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Nome</span>
            <input
              type="text"
              required
              maxLength={120}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">
              Preco base (R$)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.preco_base}
              onChange={(e) =>
                setForm({ ...form, preco_base: e.target.value })
              }
              className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {oficinasPotencialmenteAfetadas > 0 ? (
              <span className="mt-1 block text-xs text-[#8a5a00]">
                {oficinasPotencialmenteAfetadas} oficina(s) vinculada(s) podem
                ser afetadas (somente as sem preco negociado).
              </span>
            ) : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">
              Descricao
            </span>
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              className="size-4 rounded border-line"
            />
            <span className="font-medium text-ink">Ativo</span>
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
              disabled={submitting}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-line-soft disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-muted"
            >
              {submitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
