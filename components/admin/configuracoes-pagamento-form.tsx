"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ConfiguracoesPagamentoRow } from "@/lib/admin/configuracoes-pagamento";

type Provedor = "mercado_pago" | "asaas";
type Ambiente = "sandbox" | "producao";

const PROVEDOR_OPCOES: ReadonlyArray<{ value: Provedor; label: string }> = [
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "asaas", label: "ASAAS" },
];

const AMBIENTE_OPCOES: ReadonlyArray<{ value: Ambiente; label: string }> = [
  { value: "sandbox", label: "Sandbox (teste)" },
  { value: "producao", label: "Producao" },
];

function SecretField({
  label,
  hint,
  configured,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  configured: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-2 font-medium text-ink">
        {label}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            configured
              ? "bg-cyan-soft text-ink"
              : "bg-red-soft text-red"
          }`}
        >
          {configured ? "configurada" : "nao configurada"}
        </span>
      </span>
      <input
        type="password"
        value={value}
        autoComplete="new-password"
        onChange={(e) => onChange(e.target.value)}
        placeholder={configured ? "•••••••• (deixe em branco pra manter)" : "cole a credencial aqui"}
        className="w-full rounded-lg border border-line px-3 py-2 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <span className="mt-1 block text-xs text-muted">{hint}</span>
    </label>
  );
}

export function ConfiguracoesPagamentoForm({
  initial,
  siteUrl,
}: {
  initial: ConfiguracoesPagamentoRow;
  siteUrl: string;
}) {
  const router = useRouter();
  const [provedorAtivo, setProvedorAtivo] = useState<Provedor>(initial.provedor_ativo);
  const [asaasAmbiente, setAsaasAmbiente] = useState<Ambiente>(initial.asaas_ambiente);
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasWebhookToken, setAsaasWebhookToken] = useState("");
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpWebhookSecret, setMpWebhookSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const asaasWebhookUrl = `${siteUrl}/api/webhooks/asaas`;
  const mpWebhookUrl = `${siteUrl}/api/webhooks/mercado-pago`;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const payload: Record<string, string> = {
      provedor_ativo: provedorAtivo,
      asaas_ambiente: asaasAmbiente,
    };
    if (asaasApiKey.trim()) payload.asaas_api_key = asaasApiKey.trim();
    if (asaasWebhookToken.trim()) payload.asaas_webhook_token = asaasWebhookToken.trim();
    if (mpAccessToken.trim()) payload.mp_access_token = mpAccessToken.trim();
    if (mpWebhookSecret.trim()) payload.mp_webhook_secret = mpWebhookSecret.trim();

    try {
      const res = await fetch("/api/admin/configuracoes-pagamento", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Erro ao salvar.");
        return;
      }
      setSuccess(true);
      setAsaasApiKey("");
      setAsaasWebhookToken("");
      setMpAccessToken("");
      setMpWebhookSecret("");
      router.refresh();
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Provedor ativo</span>
        <select
          value={provedorAtivo}
          onChange={(e) => setProvedorAtivo(e.target.value as Provedor)}
          className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
        >
          {PROVEDOR_OPCOES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">
          Provedor usado para gerar novas cobrancas. Trocar so vale para cobrancas
          futuras — as pendentes seguem no provedor em que foram criadas.
        </span>
      </label>

      <section className="space-y-4 rounded-xl border border-line p-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">ASAAS</h3>
          <span className="text-xs text-muted">
            {initial.asaas_api_key_set ? "credencial no cofre" : "sem credencial"}
          </span>
        </header>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Ambiente</span>
          <select
            value={asaasAmbiente}
            onChange={(e) => setAsaasAmbiente(e.target.value as Ambiente)}
            className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
          >
            {AMBIENTE_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            Sandbox usa a base de teste do ASAAS (chave <code>$aact_hmlg_</code>).
            Producao usa a chave <code>$aact_prod_</code>.
          </span>
        </label>

        <SecretField
          label="API key"
          hint="Chave de API do ASAAS (Configuracoes > Integracoes > API). Guardada cifrada no cofre; nunca aparece de volta."
          configured={initial.asaas_api_key_set}
          value={asaasApiKey}
          onChange={setAsaasApiKey}
        />
        <SecretField
          label="Webhook token"
          hint="Token que voce define ao criar o webhook no ASAAS. E validado no header asaas-access-token."
          configured={initial.asaas_webhook_token_set}
          value={asaasWebhookToken}
          onChange={setAsaasWebhookToken}
        />

        <div className="rounded-lg bg-cyan-soft/50 px-3 py-2 text-xs text-ink">
          Cadastre este webhook no painel do ASAAS:
          <code className="mt-1 block break-all font-mono">{asaasWebhookUrl}</code>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-line p-4">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Mercado Pago</h3>
          <span className="text-xs text-muted">
            {initial.mp_access_token_set ? "credencial disponivel" : "sem credencial"}
          </span>
        </header>

        <SecretField
          label="Access token"
          hint="Access token do Mercado Pago. Se ja estiver em variavel de ambiente, aparece como configurada."
          configured={initial.mp_access_token_set}
          value={mpAccessToken}
          onChange={setMpAccessToken}
        />
        <SecretField
          label="Webhook secret"
          hint="Secret para validar a assinatura do webhook do Mercado Pago."
          configured={initial.mp_webhook_secret_set}
          value={mpWebhookSecret}
          onChange={setMpWebhookSecret}
        />

        <div className="rounded-lg bg-cyan-soft/50 px-3 py-2 text-xs text-ink">
          URL de webhook do Mercado Pago:
          <code className="mt-1 block break-all font-mono">{mpWebhookUrl}</code>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-lg border border-cyan/30 bg-cyan-soft px-3 py-2 text-sm text-ink">
          Salvo. Novas cobrancas passam a usar esta configuracao.
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
