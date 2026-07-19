"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PerguntaAgrupada } from "@/lib/admin/perguntas-sem-resposta";
import { FaqFormModal } from "./faq-form-modal";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PerguntasSemRespostaClient({
  initialPerguntas,
}: {
  initialPerguntas: PerguntaAgrupada[];
}) {
  const router = useRouter();
  const [perguntas] = useState(initialPerguntas);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<PerguntaAgrupada | null>(null);

  const refresh = () => router.refresh();

  const marcar = async (
    pergunta: string,
    status: "resolvida" | "ignorada",
  ) => {
    setBusy(pergunta);
    setError(null);
    try {
      const res = await fetch("/api/admin/perguntas-sem-resposta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta, status }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao atualizar.");
        return;
      }
      refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {error ? (
        <div className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper-soft text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Pergunta</th>
              <th className="px-4 py-3 font-medium">Vezes</th>
              <th className="px-4 py-3 font-medium">Modo</th>
              <th className="px-4 py-3 font-medium">Última</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {perguntas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-left text-muted">
                  Nenhuma pergunta em aberto. Quando o bot não souber responder
                  algo, aparece aqui pra você virar FAQ.
                </td>
              </tr>
            ) : null}
            {perguntas.map((p) => (
              <tr key={p.pergunta} className="hover:bg-paper-soft align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{p.pergunta}</div>
                  <div className="mt-0.5 text-xs text-muted line-clamp-2">
                    Respondeu (enlatada): {p.respostaEnviada}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className="inline-flex rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-medium text-ink">
                    {p.ocorrencias}×
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{p.agentMode}</td>
                <td className="px-4 py-3 tabular-nums text-muted">
                  {formatDate(p.ultimaEm)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy === p.pergunta}
                      onClick={() => setModal(p)}
                      className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                    >
                      Virar FAQ
                    </button>
                    <button
                      type="button"
                      disabled={busy === p.pergunta}
                      onClick={() => marcar(p.pergunta, "ignorada")}
                      className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-line-soft disabled:opacity-50"
                    >
                      {busy === p.pergunta ? "..." : "Ignorar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal ? (
        <FaqFormModal
          mode="create"
          faq={null}
          initialPergunta={modal.pergunta}
          onClose={() => setModal(null)}
          onSaved={() => {
            // Virou FAQ → marca as ocorrências como resolvidas e recarrega.
            const pergunta = modal.pergunta;
            setModal(null);
            void marcar(pergunta, "resolvida");
          }}
        />
      ) : null}
    </>
  );
}
