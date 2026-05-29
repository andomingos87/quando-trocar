import Link from "next/link";
import { notFound } from "next/navigation";

import { formatBRL, formatDate, formatDateTime } from "@/lib/admin/format";
import {
  getLembreteById,
  getLembreteOutboundMessages,
} from "@/lib/admin/lembretes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LembreteDetailActions } from "@/components/admin/lembrete-detail-actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-line-soft text-ink",
  enfileirado: "bg-brand-soft text-brand-deep",
  enviado: "bg-cyan-soft text-ink",
  respondido: "bg-cyan text-ink",
  agendado: "bg-brand-soft text-brand-deep",
  sem_resposta: "bg-orange-soft text-[#8a5a00]",
  cancelado: "bg-line text-muted",
  erro_envio: "bg-red-soft text-red",
};

export default async function LembreteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const lembrete = await getLembreteById(supabase, id);
  if (!lembrete) notFound();

  const outbound = await getLembreteOutboundMessages(supabase, id, 20);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              Lembrete {lembrete.servico_tipo ?? ""}
            </h1>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_BADGE[lembrete.status] ?? ""
              }`}
            >
              {lembrete.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {lembrete.cliente_nome ?? "—"} · {lembrete.cliente_whatsapp_mascarado} ·
            agendado para {formatDateTime(lembrete.scheduled_at)}
          </p>
        </div>
        <LembreteDetailActions lembrete={lembrete} />
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Servico
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Field label="Tipo" value={lembrete.servico_tipo} />
            <Field
              label="Valor"
              value={
                lembrete.servico_valor !== null
                  ? formatBRL(lembrete.servico_valor)
                  : null
              }
            />
            <Field
              label="Data do servico"
              value={lembrete.servico_data ? formatDate(lembrete.servico_data) : null}
            />
            <Field label="Descricao" value={lembrete.servico_descricao} wide />
          </dl>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Veiculo & cliente
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Field label="Veiculo" value={lembrete.veiculo_descricao} />
            <Field label="Placa" value={lembrete.veiculo_placa} />
            <Field
              label="Cliente"
              value={`${lembrete.cliente_nome ?? "—"} (${lembrete.cliente_whatsapp_mascarado})`}
              wide
            />
            <Field
              label="Oficina"
              value={
                lembrete.oficina_id ? (
                  <Link
                    href={`/admin/oficinas/${lembrete.oficina_id}`}
                    className="text-ink hover:underline"
                  >
                    {lembrete.oficina_nome ?? lembrete.oficina_id.slice(0, 8)}
                  </Link>
                ) : null
              }
              wide
            />
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Envio
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Field
            label="Tentativas"
            value={lembrete.attempts !== null ? String(lembrete.attempts) : null}
          />
          <Field
            label="Ultima tentativa"
            value={
              lembrete.last_attempt_at ? formatDateTime(lembrete.last_attempt_at) : null
            }
          />
          <Field
            label="Enviado em"
            value={lembrete.sent_at ? formatDateTime(lembrete.sent_at) : null}
          />
          <Field label="Provider status" value={lembrete.provider_status} />
          <Field label="Provider err code" value={lembrete.provider_error_code} />
          <Field label="WhatsApp msg id" value={lembrete.whatsapp_message_id} wide />
          <Field label="Ultimo erro" value={lembrete.last_error} wide />
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Mensagens enviadas ({outbound.length})
        </h2>
        {outbound.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            Sem mensagens de envio associadas.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {outbound.map((m) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    {m.message_kind}
                    {m.template_name ? (
                      <span className="ml-1 font-mono">({m.template_name})</span>
                    ) : null}
                    {" · "}
                    <span className="font-medium">{m.status}</span>
                    {(m.attempts ?? 0) > 0 ? ` · ${m.attempts} tent.` : ""}
                  </span>
                  <span>{formatDateTime(m.sent_at ?? m.created_at)}</span>
                </div>
                {m.body ? <p className="mt-1 text-ink">{m.body}</p> : null}
                {m.provider_error_message ? (
                  <p className="mt-1 text-xs text-red">
                    Erro: {m.provider_error_code} · {m.provider_error_message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}
