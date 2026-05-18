"use client";

import { useState } from "react";

export function OficinaCreateModal({
  planos,
  onClose,
  onSaved,
}: {
  planos: Array<{ id: string; nome: string }>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    cidade: "",
    plano_id: planos[0]?.id ?? "",
    preco_negociado: "",
    status: "ativa" as "ativa" | "pausada",
    observacao: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      nome: form.nome.trim(),
      whatsapp: form.whatsapp.trim(),
      cidade: form.cidade.trim(),
      plano_id: form.plano_id,
      preco_negociado:
        form.preco_negociado === "" ? null : Number(form.preco_negociado.replace(",", ".")),
      status: form.status,
      observacao: form.observacao.trim() || null,
    };
    try {
      const res = await fetch("/api/admin/oficinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao criar oficina.");
        return;
      }
      onSaved(data.id!);
    } catch {
      setError("Erro de conexao.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <header className="mb-4">
          <h2 className="text-lg font-semibold">Nova oficina</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cadastro manual. <code>origem = manual</code>.
          </p>
        </header>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Nome</span>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">WhatsApp</span>
            <input
              type="tel"
              required
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="+55 11 90000-0000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Cidade</span>
            <input
              type="text"
              required
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Plano</span>
              <select
                required
                value={form.plano_id}
                onChange={(e) => setForm({ ...form, plano_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Preco negociado (opt.)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.preco_negociado}
                onChange={(e) => setForm({ ...form, preco_negociado: e.target.value })}
                placeholder="usa preco base se vazio"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status inicial</span>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as "ativa" | "pausada" })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="ativa">Ativa (com proximo_vencimento +30d)</option>
              <option value="pausada">Pausada</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Observacao</span>
            <textarea
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              {submitting ? "Criando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
