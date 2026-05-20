"use client";

import { useEffect, useState } from "react";

import type { FaqVendas } from "@/lib/admin/faq";

type Mode = "create" | "edit";

type FormState = {
  pergunta: string;
  resposta: string;
  palavras_chave: string;
  ativo: boolean;
  ordem: string;
};

export function FaqFormModal({
  mode,
  faq,
  onClose,
  onSaved,
}: {
  mode: Mode;
  faq: FaqVendas | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    pergunta: faq?.pergunta ?? "",
    resposta: faq?.resposta ?? "",
    palavras_chave: (faq?.palavras_chave ?? []).join(", "),
    ativo: faq ? faq.ativo : true,
    ordem: faq ? String(faq.ordem) : "0",
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

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const palavras = form.palavras_chave
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (!form.pergunta.trim()) {
      setError("Pergunta obrigatoria.");
      setSubmitting(false);
      return;
    }
    if (!form.resposta.trim()) {
      setError("Resposta obrigatoria.");
      setSubmitting(false);
      return;
    }
    if (palavras.length === 0) {
      setError("Coloque pelo menos uma palavra-chave (separadas por virgula).");
      setSubmitting(false);
      return;
    }

    const ordemNumber = Number(form.ordem);
    if (Number.isNaN(ordemNumber) || ordemNumber < 0) {
      setError("Ordem deve ser numero >= 0.");
      setSubmitting(false);
      return;
    }

    const url = mode === "create" ? "/api/admin/faq" : `/api/admin/faq/${faq!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const payload = {
      pergunta: form.pergunta.trim(),
      resposta: form.resposta.trim(),
      palavras_chave: palavras,
      ativo: form.ativo,
      ordem: ordemNumber,
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
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
        <header className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === "create" ? "Nova pergunta" : "Editar pergunta"}
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
            <span className="mb-1 block font-medium text-ink">Pergunta</span>
            <input
              type="text"
              required
              maxLength={200}
              value={form.pergunta}
              onChange={(e) => setForm({ ...form, pergunta: e.target.value })}
              placeholder="Quanto custa?"
              className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Resposta</span>
            <textarea
              required
              maxLength={1000}
              rows={4}
              value={form.resposta}
              onChange={(e) => setForm({ ...form, resposta: e.target.value })}
              placeholder='Pode sim chefe, e so me avisar por aqui...'
              className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <span className="mt-1 block text-xs text-muted">
              Texto que o bot envia. Mantenha curto e use &ldquo;chefe&rdquo;
              pra soar como oficina.
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">
              Palavras-chave (separadas por virgula)
            </span>
            <input
              type="text"
              required
              value={form.palavras_chave}
              onChange={(e) => setForm({ ...form, palavras_chave: e.target.value })}
              placeholder="cancelar, sair, parar"
              className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <span className="mt-1 block text-xs text-muted">
              Coloque variacoes (com e sem acento). Match e por palavra contida
              na mensagem do lead.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Ordem</span>
              <input
                type="number"
                min={0}
                step={1}
                value={form.ordem}
                onChange={(e) => setForm({ ...form, ordem: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="size-4 rounded border-line"
              />
              <span className="font-medium text-ink pb-2">Ativa</span>
            </label>
          </div>

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
