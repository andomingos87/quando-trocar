"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Button,
  CepInput,
  CpfCnpjInput,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  WhatsAppInput,
} from "@/components/admin/ui";
import { OficinaStatusBadge } from "@/components/admin/oficina-status-badge";
import { formatBRL, formatDate } from "@/lib/admin/format";
import { formatCep, formatCpfCnpj, UF_LIST } from "@/lib/admin/documento-br";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import type { OficinaListRow, OficinaStatus } from "@/lib/admin/oficinas";

type PlanoOpt = { id: string; nome: string };
type RepOpt = { id: string; nome: string };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-line-soft pb-1 text-xs font-medium uppercase tracking-wide text-muted">
      {children}
    </p>
  );
}

function toMoneyString(v: number | null): string {
  return v !== null && v !== undefined ? String(v) : "";
}

function parseMoney(s: string): { ok: true; value: number | null } | { ok: false } {
  if (s.trim() === "") return { ok: true, value: null };
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

function parseInteger(s: string): { ok: true; value: number | null } | { ok: false } {
  if (s.trim() === "") return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

/**
 * Modal unico de cadastro de oficina — usado tanto para criar (mode="create")
 * quanto para editar (mode="edit"). Substitui os antigos create/edit modals e os
 * modais parciais de status/plano da pagina de detalhe.
 */
export function OficinaFormModal({
  mode,
  oficina,
  planos,
  representantes,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  oficina?: OficinaListRow;
  planos: PlanoOpt[];
  representantes: RepOpt[];
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const isEdit = mode === "edit";

  const [nome, setNome] = useState(oficina?.nome ?? "");
  const [whatsapp, setWhatsapp] = useState(
    oficina ? formatPhoneBR(oficina.whatsapp_principal) : "",
  );
  const [responsavel, setResponsavel] = useState(oficina?.responsavel ?? "");
  const [cpfCnpj, setCpfCnpj] = useState(formatCpfCnpj(oficina?.cpf_cnpj ?? ""));
  const [email, setEmail] = useState(oficina?.email ?? "");
  const [cep, setCep] = useState(formatCep(oficina?.cep ?? ""));
  const [estado, setEstado] = useState(oficina?.estado ?? "");
  const [cidade, setCidade] = useState(oficina?.cidade ?? "");
  const [bairro, setBairro] = useState(oficina?.bairro ?? "");
  const [logradouro, setLogradouro] = useState(oficina?.logradouro ?? "");
  const [numero, setNumero] = useState(oficina?.numero ?? "");
  const [complemento, setComplemento] = useState(oficina?.complemento ?? "");
  const [planoId, setPlanoId] = useState(oficina?.plano_id ?? planos[0]?.id ?? "");
  const [precoNegociado, setPrecoNegociado] = useState(
    toMoneyString(oficina?.preco_negociado ?? null),
  );
  const [representanteId, setRepresentanteId] = useState(oficina?.representante_id ?? "");
  const [status, setStatus] = useState<OficinaStatus>(oficina?.status ?? "ativa");
  const [motivo, setMotivo] = useState(oficina?.motivo_pausa ?? "voluntaria");
  const [cancelName, setCancelName] = useState("");
  const [ticket, setTicket] = useState(toMoneyString(oficina?.ticket_medio ?? null));
  const [volume, setVolume] = useState(
    oficina?.volume_trocas_mes != null ? String(oficina.volume_trocas_mes) : "",
  );
  const [observacao, setObservacao] = useState(oficina?.observacao ?? "");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Danger zone (edit)
  const [deleting, setDeleting] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleDelete = async () => {
    if (!oficina) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/oficinas/${oficina.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName: deleteName.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
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

    const preco = parseMoney(precoNegociado);
    if (!preco.ok) return setError("Preco negociado invalido.");
    const ticketParsed = parseMoney(ticket);
    if (!ticketParsed.ok) return setError("Ticket medio invalido.");
    const volumeParsed = parseInteger(volume);
    if (!volumeParsed.ok) return setError("Volume de trocas invalido (numero inteiro).");

    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      whatsapp: whatsapp.trim(),
      cidade: cidade.trim(),
      responsavel: responsavel.trim() || null,
      cpf_cnpj: cpfCnpj.trim() || null,
      email: email.trim() || null,
      cep: cep.trim() || null,
      estado: estado || null,
      bairro: bairro.trim() || null,
      logradouro: logradouro.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      plano_id: planoId,
      preco_negociado: preco.value,
      representante_id: representanteId || null,
      status,
      ticket_medio: ticketParsed.value,
      volume_trocas_mes: volumeParsed.value,
      observacao: observacao.trim() || null,
    };
    if (status === "pausada") payload.motivo_pausa = motivo;
    if (status === "ativa") payload.motivo_pausa = null;
    if (isEdit && status === "cancelada") payload.cancelConfirmationName = cancelName;

    setBusy(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/oficinas/${oficina!.id}` : "/api/admin/oficinas",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao salvar oficina.");
        return;
      }
      onSaved(data.id);
    } catch {
      setError("Erro de conexao.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      size="lg"
      title={isEdit ? "Cadastro da oficina" : "Nova oficina"}
      badge={oficina ? <OficinaStatusBadge status={oficina.status} /> : undefined}
      subtitle={
        oficina
          ? `Origem ${oficina.origem} · Criada em ${formatDate(oficina.created_at)}`
          : "Cadastro manual (origem = manual)."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <section className="space-y-3">
          <SectionTitle>Identificacao</SectionTitle>
          <Field label="Nome">
            <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp principal">
              <WhatsAppInput required value={whatsapp} onChange={setWhatsapp} />
            </Field>
            <Field label="Responsavel">
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Contato e dados fiscais</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CPF / CNPJ" hint="Obrigatorio para cobranca via ASAAS.">
              <CpfCnpjInput value={cpfCnpj} onChange={setCpfCnpj} />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@oficina.com.br"
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Endereco</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr_5rem]">
            <Field label="CEP">
              <CepInput value={cep} onChange={setCep} />
            </Field>
            <Field label="Cidade">
              <Input required value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </Field>
            <Field label="UF">
              <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">—</option>
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Bairro">
            <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem_1fr]">
            <Field label="Logradouro">
              <Input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
            </Field>
            <Field label="Numero">
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </Field>
            <Field label="Complemento">
              <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>Plano e cobranca</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
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
              hint={
                oficina
                  ? `Vazio usa preco base (${formatBRL(oficina.preco_base)})`
                  : "Vazio usa o preco base do plano."
              }
            >
              <Input
                inputMode="decimal"
                value={precoNegociado}
                onChange={(e) => setPrecoNegociado(e.target.value)}
                placeholder="usa preco base"
              />
            </Field>
          </div>
          <Field
            label="Representante"
            hint="Comissao vale so para pagamentos apos a atribuicao."
          >
            <Select
              value={representanteId}
              onChange={(e) => setRepresentanteId(e.target.value)}
            >
              <option value="">Sem representante</option>
              {representantes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </Select>
          </Field>
        </section>

        <section className="space-y-3">
          <SectionTitle>Status</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as OficinaStatus)}
              >
                <option value="ativa">Ativa</option>
                <option value="pausada">Pausada</option>
                {isEdit ? <option value="cancelada">Cancelada</option> : null}
              </Select>
            </Field>
            {status === "pausada" ? (
              <Field label="Motivo da pausa">
                <Select value={motivo ?? "voluntaria"} onChange={(e) => setMotivo(e.target.value as typeof motivo)}>
                  <option value="voluntaria">Voluntaria</option>
                  <option value="inadimplencia">Inadimplencia</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
            ) : null}
          </div>
          {isEdit && status === "cancelada" && oficina?.status !== "cancelada" ? (
            <Field
              label="Confirme o nome da oficina para cancelar"
              hint="Cancelamento e irreversivel por esta tela."
            >
              <Input
                value={cancelName}
                onChange={(e) => setCancelName(e.target.value)}
                placeholder={oficina?.nome}
                className="border-red/40"
              />
            </Field>
          ) : null}
        </section>

        <section className="space-y-3">
          <SectionTitle>Qualificacao e notas</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ticket medio" hint="Valor medio de servico (R$).">
              <Input
                inputMode="decimal"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                placeholder="ex.: 350"
              />
            </Field>
            <Field label="Volume de trocas / mes">
              <Input
                inputMode="numeric"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="ex.: 40"
              />
            </Field>
          </div>
          <Field label="Observacao">
            <Textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Anotacao livre sobre a oficina"
            />
          </Field>
        </section>

        {error ? (
          <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
            {error}
          </p>
        ) : null}

        {isEdit ? (
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
                    placeholder={oficina?.nome}
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
                    disabled={deleteBusy || deleteName.trim() !== (oficina?.nome.trim() ?? "")}
                  >
                    {deleteBusy ? "Excluindo..." : "Confirmar exclusao"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          {isEdit && oficina ? (
            <Link
              href={`/admin/oficinas/${oficina.id}`}
              className="text-sm text-muted hover:text-ink hover:underline"
            >
              Abrir pagina completa
            </Link>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
