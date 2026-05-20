"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ConfiguracoesVendedorRow } from "@/lib/admin/configuracoes-vendedor";

type FormState = {
  taxa_recuperacao_roi: string;
  whatsapp_handoff_comercial: string;
  frases_landing: string;
};

export function ConfiguracoesVendedorForm({
  initial,
}: {
  initial: ConfiguracoesVendedorRow;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({
    taxa_recuperacao_roi: String(Math.round(initial.taxa_recuperacao_roi * 100)),
    whatsapp_handoff_comercial: initial.whatsapp_handoff_comercial,
    frases_landing: initial.frases_landing.join("\n"),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const taxaPercent = Number(form.taxa_recuperacao_roi);
    if (Number.isNaN(taxaPercent) || taxaPercent <= 0 || taxaPercent >= 100) {
      setError("Taxa de recuperacao deve ser entre 1% e 99%.");
      setSubmitting(false);
      return;
    }

    const frases = form.frases_landing
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    if (frases.length === 0) {
      setError("Coloque pelo menos uma frase-gatilho.");
      setSubmitting(false);
      return;
    }

    const payload = {
      taxa_recuperacao_roi: taxaPercent / 100,
      whatsapp_handoff_comercial: form.whatsapp_handoff_comercial.trim(),
      frases_landing: frases,
    };

    try {
      const res = await fetch("/api/admin/configuracoes-vendedor", {
        method: "PATCH",
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
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">
          Taxa de recuperacao do ROI (%)
        </span>
        <input
          type="number"
          min={1}
          max={99}
          step={1}
          value={form.taxa_recuperacao_roi}
          onChange={(e) =>
            setForm({ ...form, taxa_recuperacao_roi: e.target.value })
          }
          className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-40"
        />
        <span className="mt-1 block text-xs text-muted">
          O bot estima quantos clientes a oficina recupera a cada mes. 15% e o
          padrao (conservador-medio).
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">
          WhatsApp comercial (handoff)
        </span>
        <input
          type="text"
          value={form.whatsapp_handoff_comercial}
          onChange={(e) =>
            setForm({ ...form, whatsapp_handoff_comercial: e.target.value })
          }
          placeholder="+5511945207618"
          className="w-full rounded-lg border border-line px-3 py-2 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
        />
        <span className="mt-1 block text-xs text-muted">
          Numero pra onde o bot manda o lead quando precisa de humano (preco
          insistente, rede/franquia, volume alto). Use formato E.164.
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">
          Frases-gatilho de origem &ldquo;landing_page&rdquo;
        </span>
        <textarea
          rows={4}
          value={form.frases_landing}
          onChange={(e) => setForm({ ...form, frases_landing: e.target.value })}
          placeholder={"oi quero testar o quando trocar\noi quero conhecer o quando trocar"}
          className="w-full rounded-lg border border-line px-3 py-2 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <span className="mt-1 block text-xs text-muted">
          Uma frase por linha. Mensagens identicas (ignorando acentos e
          pontuacao) marcam o lead como vindo da landing. Demais entradas viram
          &ldquo;manual_whatsapp&rdquo;.
        </span>
      </label>

      {error ? (
        <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-lg border border-cyan/30 bg-cyan-soft px-3 py-2 text-sm text-ink">
          Salvo. O bot atualiza em ate 1 minuto (cache).
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-muted"
        >
          {submitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
