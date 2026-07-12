"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Field, Input, Textarea } from "@/components/admin/ui";
import type { OficinaDetail } from "@/lib/admin/oficinas";

/**
 * Config operacional de lembrete por oficina (cadencia, janela de envio e
 * mensagem padrao). Antes so era editavel direto no banco.
 */
export function OficinaLembreteConfigCard({ oficina }: { oficina: OficinaDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [dias, setDias] = useState(String(oficina.dias_lembrete_padrao));
  const [inicio, setInicio] = useState(oficina.horario_envio_inicio);
  const [fim, setFim] = useState(oficina.horario_envio_fim);
  const [mensagem, setMensagem] = useState(oficina.mensagem_lembrete_padrao ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    const n = Number(dias);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      setError("Dias de lembrete deve estar entre 1 e 365.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/oficinas/${oficina.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dias_lembrete_padrao: n,
          horario_envio_inicio: inicio,
          horario_envio_fim: fim,
          mensagem_lembrete_padrao: mensagem.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao salvar configuracao.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Automacao de lembretes
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-brand hover:underline"
          >
            Editar
          </button>
        ) : null}
      </div>

      {!editing ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Cadencia padrao</dt>
            <dd className="font-medium text-ink tabular-nums">
              {oficina.dias_lembrete_padrao} dias
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Janela de envio</dt>
            <dd className="font-medium text-ink tabular-nums">
              {oficina.horario_envio_inicio}–{oficina.horario_envio_fim}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Timezone</dt>
            <dd className="text-ink">{oficina.timezone}</dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-muted">Mensagem padrao</dt>
            <dd className="text-ink">{oficina.mensagem_lembrete_padrao ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cadencia (dias)">
              <Input
                type="number"
                min="1"
                max="365"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
              />
            </Field>
            <Field label="Envio a partir de">
              <Input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Field>
            <Field label="Envio ate">
              <Input type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
            </Field>
          </div>
          <Field label="Mensagem padrao" hint="Deixe vazio para usar o texto global.">
            <Textarea
              rows={2}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
            />
          </Field>
          {error ? (
            <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
