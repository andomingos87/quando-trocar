"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ClienteDetail } from "@/lib/admin/clientes";

export function ClienteDetailActions({ cliente }: { cliente: ClienteDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState<
    | null
    | "opt_out"
    | "reactivate"
    | "numero_errado"
    | "numero_correto"
    | "edit"
    | "whatsapp"
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

  const isAtivo = cliente.status === "ativo";
  const isOptOut = cliente.status === "opt_out";
  const isNumeroErrado = cliente.status === "numero_errado";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen("edit")}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
      >
        Editar nome
      </button>

      <button
        type="button"
        onClick={() => setOpen("whatsapp")}
        className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
      >
        Editar WhatsApp
      </button>

      {isAtivo ? (
        <button
          type="button"
          onClick={() => setOpen("numero_errado")}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
        >
          Marcar numero errado
        </button>
      ) : null}

      {isNumeroErrado ? (
        <button
          type="button"
          onClick={() => setOpen("numero_correto")}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-line-soft"
        >
          Marcar numero correto
        </button>
      ) : null}

      {isOptOut ? (
        <button
          type="button"
          onClick={() => setOpen("reactivate")}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Reativar consentimento
        </button>
      ) : null}

      {isAtivo ? (
        <button
          type="button"
          onClick={() => setOpen("opt_out")}
          className="rounded-lg border border-red/40 px-3 py-1.5 text-sm font-medium text-red hover:bg-red-soft"
        >
          Marcar opt-out
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen("delete")}
        className="rounded-lg border border-red/40 px-3 py-1.5 text-sm font-medium text-red hover:bg-red-soft"
      >
        Deletar
      </button>

      {open === "opt_out" ? (
        <OptOutModal cliente={cliente} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "reactivate" ? (
        <ReactivateModal cliente={cliente} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "numero_errado" ? (
        <NumeroErradoModal cliente={cliente} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "numero_correto" ? (
        <NumeroCorretoModal cliente={cliente} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "edit" ? (
        <EditClienteModal cliente={cliente} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "whatsapp" ? (
        <ChangeWhatsappModal cliente={cliente} onClose={() => setOpen(null)} onSaved={() => onSaved()} />
      ) : null}
      {open === "delete" ? (
        <SoftDeleteModal
          cliente={cliente}
          onClose={() => setOpen(null)}
          onSaved={() => onSaved("/admin/clientes")}
        />
      ) : null}
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
}: {
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel: string;
  submitTone?: "primary" | "danger";
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
        disabled={busy}
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

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

// ---------------------------------------------------------------------------

function OptOutModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "marcar_opt_out", motivo }),
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
    <ModalShell title="Marcar cliente como opt-out" onClose={onClose}>
      <TextareaField label="Motivo" value={motivo} onChange={setMotivo} />
      <p className="mt-2 text-xs text-muted">
        Apos isso, novos lembretes nao serao enviados a este cliente.
      </p>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Marcar opt-out"
        submitTone="danger"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function ReactivateModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [origem, setOrigem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "reactivate",
          origem_consentimento: origem,
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
    <ModalShell title="Reativar consentimento" onClose={onClose}>
      <p className="text-sm text-ink">
        Cliente voltara para <strong>ativo</strong>. Registre a nova origem do
        consentimento (ex.: &quot;pedido verbal na oficina&quot;,
        &quot;cliente confirmou por WhatsApp&quot;).
      </p>
      <div className="mt-3">
        <TextField
          label="Origem do consentimento"
          value={origem}
          onChange={setOrigem}
          placeholder="pedido_verbal_oficina"
        />
      </div>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Reativar"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function NumeroErradoModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "marcar_numero_errado", motivo }),
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
    <ModalShell title="Marcar numero como errado" onClose={onClose}>
      <TextareaField label="Motivo" value={motivo} onChange={setMotivo} />
      <p className="mt-2 text-xs text-muted">
        Lembretes pendentes deste cliente serao cancelados.
      </p>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Marcar errado"
        submitTone="danger"
      />
    </ModalShell>
  );
}

function NumeroCorretoModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "marcar_numero_correto" }),
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
    <ModalShell title="Marcar numero como correto" onClose={onClose}>
      <p className="text-sm text-ink">
        Cliente voltara para <strong>ativo</strong>. Consentimento WhatsApp nao muda.
      </p>
      <ErrorBox message={error} />
      <FooterButtons
        onClose={onClose}
        onSubmit={submit}
        busy={busy}
        submitLabel="Confirmar"
      />
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------

function EditClienteModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(cliente.nome ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "update",
          nome: nome.trim() || null,
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
    <ModalShell title="Editar dados do cliente" onClose={onClose}>
      <TextField label="Nome" value={nome} onChange={setNome} />
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
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteDetail;
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
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
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
    <ModalShell title="Trocar WhatsApp do cliente" onClose={onClose}>
      <p className="text-sm text-muted">
        Atual: <span className="font-mono text-ink">{cliente.whatsapp_mascarado}</span>
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

function SoftDeleteModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refNome = cliente.nome ?? cliente.whatsapp;

  const submit = async () => {
    if (confirma.trim() !== refNome.trim()) {
      setError(`Digite "${refNome}" para confirmar.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}`, {
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
    <ModalShell title="Deletar cliente" onClose={onClose}>
      <p className="text-sm text-ink">
        Soft delete: o cliente some das listagens, lembretes pendentes serao cancelados,
        mas a auditoria e o historico permanecem.
      </p>
      <div className="mt-3 space-y-3">
        <TextareaField label="Motivo" value={motivo} onChange={setMotivo} rows={2} />
        <TextField
          label={`Digite "${refNome}" para confirmar`}
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
