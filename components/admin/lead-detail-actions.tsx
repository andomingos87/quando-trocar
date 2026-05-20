"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { LeadDetail, LeadStatus } from "@/lib/admin/leads";

const TERMINAL = new Set<LeadStatus>(["convertido", "perdido"]);

const STATUS_OPTIONS: LeadStatus[] = [
  "novo",
  "em_conversa",
  "qualificado",
  "interessado",
  "teste_aceito",
];

export type LeadActionsPlano = {
  id: string;
  nome: string;
  preco_base: number;
  ativo: boolean;
};

export function LeadDetailActions({
  lead,
  planos,
}: {
  lead: LeadDetail;
  planos: LeadActionsPlano[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<
    | null
    | "perdido"
    | "reopen"
    | "edit"
    | "whatsapp"
    | "convert"
    | "delete"
  >(null);

  const onSaved = (redirectTo?: string) => {
    setOpen(null);
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  };

  const isPerdido = lead.status === "perdido";
  const isConvertido = lead.status === "convertido";
  const isVivo = !TERMINAL.has(lead.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isVivo ? <StatusInline lead={lead} onSaved={() => onSaved()} /> : null}

      {isVivo ? (
        <button
          type="button"
          onClick={() => setOpen("convert")}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Converter em oficina
        </button>
      ) : null}

      {!isConvertido ? (
        <button
          type="button"
          onClick={() => setOpen("edit")}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
        >
          Editar dados
        </button>
      ) : null}

      {!isConvertido ? (
        <button
          type="button"
          onClick={() => setOpen("whatsapp")}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
        >
          Editar WhatsApp
        </button>
      ) : null}

      {isPerdido ? (
        <button
          type="button"
          onClick={() => setOpen("reopen")}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
        >
          Reabrir lead
        </button>
      ) : null}

      {isVivo ? (
        <button
          type="button"
          onClick={() => setOpen("perdido")}
          className="rounded-lg border border-red/40 px-3 py-1.5 text-sm font-medium text-red hover:bg-red-soft"
        >
          Marcar perdido
        </button>
      ) : null}

      {isConvertido && lead.oficina_id ? (
        <Link
          href={`/admin/oficinas/${lead.oficina_id}`}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
        >
          Ir para oficina
        </Link>
      ) : null}

      {!isConvertido ? (
        <button
          type="button"
          onClick={() => setOpen("delete")}
          className="rounded-lg border border-red/40 px-3 py-1.5 text-sm font-medium text-red hover:bg-red-soft"
        >
          Deletar
        </button>
      ) : null}

      {open === "perdido" ? (
        <PerdidoModal lead={lead} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "reopen" ? (
        <ReopenModal lead={lead} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "edit" ? (
        <EditLeadModal lead={lead} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "whatsapp" ? (
        <ChangeWhatsappModal
          lead={lead}
          onClose={() => setOpen(null)}
          onSaved={() => onSaved()}
        />
      ) : null}
      {open === "convert" ? (
        <ConvertManualModal
          lead={lead}
          planos={planos}
          onClose={() => setOpen(null)}
          onSaved={(oficinaId) =>
            onSaved(oficinaId ? `/admin/oficinas/${oficinaId}` : undefined)
          }
        />
      ) : null}
      {open === "delete" ? (
        <SoftDeleteModal
          lead={lead}
          onClose={() => setOpen(null)}
          onSaved={() => onSaved("/admin/leads")}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatusInline({
  lead,
  onSaved,
}: {
  lead: LeadDetail;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = status !== lead.status;

  const submit = async () => {
    if (!dirty) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "change_status", status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as LeadStatus)}
        disabled={busy}
        className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={!dirty || busy}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft disabled:opacity-50"
      >
        {busy ? "..." : "Salvar status"}
      </button>
      {error ? <span className="text-xs text-red">{error}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 px-4">
      <div onClick={onClose} className="absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto sm:p-6">
        <header className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-muted hover:bg-line-soft hover:text-ink"
          >
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-2 rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
      {message}
    </p>
  );
}

function FooterButtons({
  onClose,
  onSubmit,
  busy,
  submitLabel,
  submitTone = "primary",
  disabled = false,
}: {
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  submitTone?: "primary" | "danger";
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="rounded-lg border border-line px-3 py-2 text-sm font-medium"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || disabled}
        className={
          submitTone === "danger"
            ? "rounded-lg bg-red px-4 py-2 text-sm font-semibold text-white disabled:bg-muted"
            : "rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:bg-muted"
        }
      >
        {busy ? "Salvando..." : submitLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PerdidoModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [motivo, setMotivo] = useState(lead.motivo_perda ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "marcar_perdido", motivo_perda: motivo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Marcar lead como perdido" onClose={onClose}>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Motivo da perda</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Ex.: ja contratou concorrente"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
      </label>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Marcar perdido"
        submitTone="danger"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function ReopenModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "reopen" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Reabrir lead" onClose={onClose}>
      <p className="text-sm text-ink">
        O lead voltara para <strong>em_conversa</strong> e o motivo da perda sera limpo.
      </p>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Reabrir"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function EditLeadModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nome: lead.nome ?? "",
    nome_responsavel: lead.nome_responsavel ?? "",
    nome_oficina: lead.nome_oficina ?? "",
    cidade: lead.cidade ?? "",
    principal_dor: lead.principal_dor ?? "",
    melhor_horario_contato: lead.melhor_horario_contato ?? "",
    volume_trocas_mes:
      lead.volume_trocas_mes !== null ? String(lead.volume_trocas_mes) : "",
    ticket_medio: lead.ticket_medio !== null ? String(lead.ticket_medio) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { acao: "update" };
      payload.nome = form.nome.trim() || null;
      payload.nome_responsavel = form.nome_responsavel.trim() || null;
      payload.nome_oficina = form.nome_oficina.trim() || null;
      payload.cidade = form.cidade.trim() || null;
      payload.principal_dor = form.principal_dor.trim() || null;
      payload.melhor_horario_contato = form.melhor_horario_contato.trim() || null;
      payload.volume_trocas_mes =
        form.volume_trocas_mes.trim() === ""
          ? null
          : Number.parseInt(form.volume_trocas_mes, 10);
      payload.ticket_medio =
        form.ticket_medio.trim() === ""
          ? null
          : Number.parseFloat(form.ticket_medio);

      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Editar dados do lead" onClose={onClose}>
      <div className="space-y-3">
        <TextField label="Nome" value={form.nome} onChange={(v) => set("nome", v)} />
        <TextField
          label="Responsavel"
          value={form.nome_responsavel}
          onChange={(v) => set("nome_responsavel", v)}
        />
        <TextField
          label="Nome da oficina"
          value={form.nome_oficina}
          onChange={(v) => set("nome_oficina", v)}
        />
        <TextField
          label="Cidade"
          value={form.cidade}
          onChange={(v) => set("cidade", v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Volume trocas/mes"
            value={form.volume_trocas_mes}
            onChange={(v) => set("volume_trocas_mes", v)}
            inputMode="numeric"
          />
          <TextField
            label="Ticket medio (R$)"
            value={form.ticket_medio}
            onChange={(v) => set("ticket_medio", v)}
            inputMode="decimal"
          />
        </div>
        <TextField
          label="Melhor horario"
          value={form.melhor_horario_contato}
          onChange={(v) => set("melhor_horario_contato", v)}
        />
        <TextareaField
          label="Principal dor"
          value={form.principal_dor}
          onChange={(v) => set("principal_dor", v)}
          rows={3}
        />
      </div>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Salvar"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function ChangeWhatsappModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [novo, setNovo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "change_whatsapp",
          whatsapp: novo,
          confirmacao_whatsapp: confirma,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Trocar WhatsApp do lead" onClose={onClose}>
      <p className="text-sm text-muted">
        Atual: <span className="font-mono text-ink">{lead.whatsapp}</span>
      </p>
      <div className="mt-3 space-y-3">
        <TextField
          label="Novo WhatsApp"
          value={novo}
          onChange={setNovo}
          placeholder="+55 11 9..."
        />
        <TextField
          label="Digite novamente para confirmar"
          value={confirma}
          onChange={setConfirma}
          placeholder="+55 11 9..."
        />
      </div>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Trocar"
        submitTone="danger"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function ConvertManualModal({
  lead,
  planos,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  planos: LeadActionsPlano[];
  onClose: () => void;
  onSaved: (oficinaId: string | null) => void;
}) {
  const ativos = useMemo(() => planos.filter((p) => p.ativo), [planos]);
  const [planoId, setPlanoId] = useState<string>(ativos[0]?.id ?? "");
  const [preco, setPreco] = useState<string>("");
  const [dias, setDias] = useState<string>("90");
  const [status, setStatus] = useState<"ativa" | "pausada">("ativa");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        acao: "convert_manual",
        plano_id: planoId,
        preco_negociado: preco.trim() === "" ? null : Number.parseFloat(preco),
        dias_lembrete: Number.parseInt(dias, 10),
        status,
      };
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved((data.oficinaId as string | undefined) ?? null);
    } finally {
      setBusy(false);
    }
  };

  if (ativos.length === 0) {
    return (
      <ModalShell title="Converter em oficina" onClose={onClose}>
        <p className="text-sm text-red">
          Nenhum plano ativo encontrado. Cadastre um plano antes de converter.
        </p>
        <FooterButtons
          onClose={onClose}
          onSubmit={() => undefined}
          busy={false}
          submitLabel="Converter"
          disabled
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Converter lead em oficina" onClose={onClose}>
      <p className="text-sm text-muted">
        Cria uma oficina com WhatsApp <span className="font-mono">{lead.whatsapp}</span> e
        marca o lead como convertido.
      </p>
      <div className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Plano</span>
          <select
            value={planoId}
            onChange={(e) => setPlanoId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            {ativos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} (R$ {p.preco_base.toFixed(2)})
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Preco negociado (R$, opcional)"
            value={preco}
            onChange={setPreco}
            placeholder="vazio = preco do plano"
            inputMode="decimal"
          />
          <TextField
            label="Dias entre lembretes"
            value={dias}
            onChange={setDias}
            inputMode="numeric"
          />
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Status inicial</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "ativa" | "pausada")}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="ativa">ativa</option>
            <option value="pausada">pausada</option>
          </select>
        </label>
      </div>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Converter"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function SoftDeleteModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nomeRef =
    lead.nome ?? lead.nome_responsavel ?? lead.nome_oficina ?? lead.whatsapp;

  const submit = async () => {
    if (confirma.trim() !== nomeRef.trim()) {
      setError(`Digite "${nomeRef}" para confirmar.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro.");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Deletar lead" onClose={onClose}>
      <p className="text-sm text-ink">
        Soft delete: o lead some das listagens, mas a auditoria e o historico permanecem.
      </p>
      <div className="mt-3 space-y-3">
        <TextareaField
          label="Motivo"
          value={motivo}
          onChange={setMotivo}
          rows={2}
        />
        <TextField
          label={`Digite "${nomeRef}" para confirmar`}
          value={confirma}
          onChange={setConfirma}
        />
      </div>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Deletar"
        submitTone="danger"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={500}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
      />
    </label>
  );
}
