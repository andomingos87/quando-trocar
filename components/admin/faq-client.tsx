"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { FaqVendas } from "@/lib/admin/faq";
import { FaqFormModal } from "./faq-form-modal";

type ModalState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; faq: FaqVendas };

type Filter = "todas" | "ativas" | "inativas";

export function FaqClient({ initialFaqs }: { initialFaqs: FaqVendas[] }) {
  const router = useRouter();
  const [faqs] = useState(initialFaqs);
  const [filter, setFilter] = useState<Filter>("ativas");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return faqs.filter((faq) => {
      if (filter === "ativas" && !faq.ativo) return false;
      if (filter === "inativas" && faq.ativo) return false;
      if (!normalizedSearch) return true;
      const haystack = `${faq.pergunta} ${faq.resposta} ${faq.palavras_chave.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [faqs, filter, search]);

  const refresh = () => router.refresh();

  const handleDeactivate = async (faq: FaqVendas) => {
    if (!confirm(`Desativar a pergunta "${faq.pergunta}"?`)) return;
    setBusy(faq.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${faq.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao desativar.");
        return;
      }
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleToggleActive = async (faq: FaqVendas) => {
    setBusy(faq.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${faq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !faq.ativo }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao alterar status.");
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm">
            {(["ativas", "inativas", "todas"] as Filter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={
                  filter === value
                    ? "rounded-md bg-brand px-3 py-1 text-xs font-medium text-white"
                    : "rounded-md px-3 py-1 text-xs font-medium text-muted hover:text-ink"
                }
              >
                {value === "ativas" ? "Ativas" : value === "inativas" ? "Inativas" : "Todas"}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pergunta, resposta ou palavra-chave"
            className="w-64 rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <span className="text-xs text-muted">
            {filtered.length} {filtered.length === 1 ? "pergunta" : "perguntas"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setModal({ open: true, mode: "create" })}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Nova pergunta
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
              <th className="px-4 py-3 font-medium">Ordem</th>
              <th className="px-4 py-3 font-medium">Pergunta</th>
              <th className="px-4 py-3 font-medium">Palavras-chave</th>
              <th className="px-4 py-3 font-medium">Ativa</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-left text-muted">
                  Nada por aqui. Clique em <strong>Nova pergunta</strong> pra criar.
                </td>
              </tr>
            ) : null}
            {filtered.map((faq) => (
              <tr key={faq.id} className="hover:bg-paper-soft align-top">
                <td className="px-4 py-3 tabular-nums text-muted">{faq.ordem}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{faq.pergunta}</div>
                  <div className="mt-0.5 text-xs text-muted line-clamp-2">{faq.resposta}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {faq.palavras_chave.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-full bg-line-soft px-2 py-0.5 text-xs text-ink"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      faq.ativo
                        ? "inline-flex rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-medium text-ink"
                        : "inline-flex rounded-full bg-line px-2 py-0.5 text-xs font-medium text-ink"
                    }
                  >
                    {faq.ativo ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModal({ open: true, mode: "edit", faq })}
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={busy === faq.id}
                      onClick={() => handleToggleActive(faq)}
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft disabled:opacity-50"
                    >
                      {busy === faq.id ? "..." : faq.ativo ? "Desativar" : "Ativar"}
                    </button>
                    {faq.ativo ? (
                      <button
                        type="button"
                        disabled={busy === faq.id}
                        onClick={() => handleDeactivate(faq)}
                        className="rounded-md border border-red/40 px-2.5 py-1 text-xs font-medium text-red hover:bg-red-soft disabled:opacity-50"
                      >
                        Apagar
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
        <FaqFormModal
          mode={modal.mode}
          faq={modal.mode === "edit" ? modal.faq : null}
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
