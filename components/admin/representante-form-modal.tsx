"use client";

import { useState } from "react";

import { Button, Field, Input, Select, WhatsAppInput } from "@/components/admin/ui";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import type { RepresentanteListRow } from "@/lib/admin/representantes";

export function RepresentanteFormModal({
  mode,
  representante,
  linkPreview,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  representante: RepresentanteListRow | null;
  linkPreview: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(representante?.nome ?? "");
  const [whatsapp, setWhatsapp] = useState(
    representante ? formatPhoneBR(representante.whatsapp) : "",
  );
  const [codigo, setCodigo] = useState(representante?.codigo ?? "");
  const [ativo, setAtivo] = useState(representante?.ativo ?? true);
  const [usaOverride, setUsaOverride] = useState(
    representante ? representante.comissao_tipo !== null : false,
  );
  const [comissaoTipo, setComissaoTipo] = useState<"percentual" | "fixo">(
    representante?.comissao_tipo ?? "percentual",
  );
  const [comissaoValor, setComissaoValor] = useState(
    representante?.comissao_valor !== null && representante?.comissao_valor !== undefined
      ? String(representante.comissao_valor)
      : "",
  );
  const [duracao, setDuracao] = useState(
    representante?.comissao_duracao_meses !== null &&
      representante?.comissao_duracao_meses !== undefined
      ? String(representante.comissao_duracao_meses)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      codigo: codigo.trim().toUpperCase(),
      ativo,
    };

    if (usaOverride) {
      const n = Number(comissaoValor.replace(",", "."));
      if (comissaoValor.trim() === "" || Number.isNaN(n) || n < 0) {
        setError("Valor da comissao invalido.");
        return;
      }
      payload.comissao_tipo = comissaoTipo;
      payload.comissao_valor = n;
    } else {
      payload.comissao_tipo = null;
      payload.comissao_valor = null;
    }

    if (duracao.trim() === "") {
      payload.comissao_duracao_meses = null;
    } else {
      const d = Number(duracao);
      if (!Number.isInteger(d) || d < 1) {
        setError("Duracao deve ser um numero inteiro de meses (ou vazio).");
        return;
      }
      payload.comissao_duracao_meses = d;
    }

    setBusy(true);
    try {
      const res = await fetch(
        mode === "create"
          ? "/api/admin/representantes"
          : `/api/admin/representantes/${representante!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao salvar representante.");
        return;
      }
      onSaved();
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!representante) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/representantes/${representante.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmNome: deleteName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setDeleteError(data.message ?? "Erro ao excluir representante.");
        return;
      }
      onSaved();
    } catch {
      setDeleteError("Erro de conexao.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 px-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">
            {mode === "create" ? "Novo representante" : "Editar representante"}
          </h2>
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
            <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>

          <Field label="WhatsApp">
            <WhatsAppInput required value={whatsapp} onChange={(v) => setWhatsapp(v)} />
          </Field>

          <Field
            label="Codigo do link"
            hint="Vai no link de divulgacao como #REP-CODIGO. Letras, numeros e hifen."
          >
            <Input
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="CARLOS-SP"
            />
          </Field>

          {linkPreview ? (
            <p className="break-all rounded-lg bg-paper-soft px-3 py-2 text-xs text-muted">
              Link de divulgacao: <span className="text-ink">{linkPreview}</span>
            </p>
          ) : null}

          <Field label="Status">
            <Select
              value={ativo ? "ativo" : "inativo"}
              onChange={(e) => setAtivo(e.target.value === "ativo")}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo (nao atribui nem gera comissao)</option>
            </Select>
          </Field>

          <div className="rounded-xl border border-line bg-paper-soft/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={usaOverride}
                onChange={(e) => setUsaOverride(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              Comissao propria (sobrescreve a regra global)
            </label>
            {usaOverride ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <Select
                    value={comissaoTipo}
                    onChange={(e) => setComissaoTipo(e.target.value as "percentual" | "fixo")}
                  >
                    <option value="percentual">Percentual (%)</option>
                    <option value="fixo">Fixo (R$)</option>
                  </Select>
                </Field>
                <Field label={comissaoTipo === "percentual" ? "Percentual (%)" : "Valor (R$)"}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={comissaoValor}
                    onChange={(e) => setComissaoValor(e.target.value)}
                    placeholder={comissaoTipo === "percentual" ? "20" : "15,00"}
                  />
                </Field>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">
                Sem override, vale a regra global de Configuracoes → Comissao de
                representantes.
              </p>
            )}
            <div className="mt-3">
              <Field
                label="Duracao (meses)"
                hint="Quantos pagamentos da oficina geram comissao. Vazio herda a regra global."
              >
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                  placeholder="herda a global"
                />
              </Field>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
              {error}
            </p>
          ) : null}

          {mode === "edit" && representante ? (
            <div className="rounded-xl border border-red/30 bg-red-soft/40 p-3">
              {!deleting ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Excluir representante</p>
                    <p className="text-xs text-muted">
                      So e possivel excluir quem nao tem comissao registrada. Com
                      historico, desative.
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
                    label="Confirme o nome do representante para excluir"
                    hint="A exclusao e irreversivel por esta tela."
                  >
                    <Input
                      value={deleteName}
                      onChange={(e) => setDeleteName(e.target.value)}
                      placeholder={representante.nome}
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
                      disabled={deleteBusy || deleteName.trim() !== representante.nome.trim()}
                    >
                      {deleteBusy ? "Excluindo..." : "Confirmar exclusao"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
