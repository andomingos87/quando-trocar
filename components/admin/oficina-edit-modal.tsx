"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Field, Input, Select, WhatsAppInput } from "@/components/admin/ui";
import { formatBRL, formatDate } from "@/lib/admin/format";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import type { OficinaListRow, OficinaStatus } from "@/lib/admin/oficinas";

const STATUS_BADGE: Record<string, string> = {
  ativa: "bg-cyan-soft text-ink",
  pausada: "bg-orange-soft text-[#8a5a00]",
  cancelada: "bg-line text-muted",
};

export function OficinaEditModal({
  oficina,
  planos,
  onClose,
  onSaved,
}: {
  oficina: OficinaListRow;
  planos: Array<{ id: string; nome: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(oficina.nome);
  const [whatsapp, setWhatsapp] = useState(formatPhoneBR(oficina.whatsapp_principal));
  const [cidade, setCidade] = useState(oficina.cidade ?? "");
  const [responsavel, setResponsavel] = useState(oficina.responsavel ?? "");
  const [planoId, setPlanoId] = useState(oficina.plano_id ?? planos[0]?.id ?? "");
  const [precoNegociado, setPrecoNegociado] = useState(
    oficina.preco_negociado !== null ? String(oficina.preco_negociado) : "",
  );
  const [status, setStatus] = useState<OficinaStatus>(oficina.status);
  const [motivo, setMotivo] = useState(oficina.motivo_pausa ?? "voluntaria");
  const [cancelName, setCancelName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleDelete = async () => {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/oficinas/${oficina.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName: deleteName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setDeleteError(data.message ?? "Erro ao excluir oficina.");
        return;
      }
      onSaved();
    } catch {
      setDeleteError("Erro de conexao.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      cidade: cidade.trim() || null,
      responsavel: responsavel.trim() || null,
      plano_id: planoId,
      status,
    };

    if (precoNegociado.trim() === "") {
      payload.preco_negociado = null;
    } else {
      const n = Number(precoNegociado.replace(",", "."));
      if (Number.isNaN(n) || n < 0) {
        setError("Preco negociado invalido.");
        return;
      }
      payload.preco_negociado = n;
    }

    if (status === "pausada") payload.motivo_pausa = motivo;
    if (status === "ativa") payload.motivo_pausa = null;
    if (status === "cancelada") payload.cancelConfirmationName = cancelName;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/oficinas/${oficina.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao salvar oficina.");
        return;
      }
      onSaved();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 px-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">Cadastro da oficina</h2>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUS_BADGE[oficina.status] ?? ""
                }`}
              >
                {oficina.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Origem {oficina.origem} · Criada em {formatDate(oficina.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted hover:bg-line-soft hover:text-ink"
          >
            ✕
          </button>
        </header>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <Input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </Field>

          <Field label="WhatsApp principal">
            <WhatsAppInput
              required
              value={whatsapp}
              onChange={(v) => setWhatsapp(v)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cidade">
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </Field>
            <Field label="Responsavel">
              <Input
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Plano">
              <Select value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                {planos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Preco negociado"
              hint={`Vazio usa preco base (${formatBRL(oficina.preco_base)})`}
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={precoNegociado}
                onChange={(e) => setPrecoNegociado(e.target.value)}
                placeholder="usa preco base"
              />
            </Field>
          </div>

          <Field label="Status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as OficinaStatus)}
            >
              <option value="ativa">Ativa</option>
              <option value="pausada">Pausada</option>
              <option value="cancelada">Cancelada</option>
            </Select>
          </Field>

          {status === "pausada" ? (
            <Field label="Motivo da pausa">
              <Select
                value={motivo ?? "voluntaria"}
                onChange={(e) => setMotivo(e.target.value as typeof motivo)}
              >
                <option value="voluntaria">Voluntaria</option>
                <option value="inadimplencia">Inadimplencia</option>
                <option value="admin">Admin</option>
              </Select>
            </Field>
          ) : null}

          {status === "cancelada" && oficina.status !== "cancelada" ? (
            <Field
              label="Confirme o nome da oficina para cancelar"
              hint="Cancelamento e irreversivel por esta tela."
            >
              <Input
                value={cancelName}
                onChange={(e) => setCancelName(e.target.value)}
                placeholder={oficina.nome}
                className="border-red/40"
              />
            </Field>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-red/30 bg-red-soft/40 p-3">
            {!deleting ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Excluir oficina</p>
                  <p className="text-xs text-muted">
                    Remove a oficina de todas as telas do admin. Irreversivel por esta tela.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDeleting(true);
                    setDeleteError(null);
                    setDeleteName("");
                  }}
                  disabled={busy}
                  className="border-red/40 text-red"
                >
                  Excluir
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Field
                  label="Confirme o nome da oficina para excluir"
                  hint="A exclusao e irreversivel por esta tela."
                >
                  <Input
                    value={deleteName}
                    onChange={(e) => setDeleteName(e.target.value)}
                    placeholder={oficina.nome}
                    className="border-red/40"
                  />
                </Field>
                {deleteError ? (
                  <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
                    {deleteError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDeleting(false)}
                    disabled={deleteBusy}
                  >
                    Voltar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={handleDelete}
                    disabled={deleteBusy || deleteName.trim() !== oficina.nome.trim()}
                  >
                    {deleteBusy ? "Excluindo..." : "Confirmar exclusao"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Link
              href={`/admin/oficinas/${oficina.id}`}
              className="text-sm text-muted hover:text-ink hover:underline"
            >
              Abrir pagina completa
            </Link>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
