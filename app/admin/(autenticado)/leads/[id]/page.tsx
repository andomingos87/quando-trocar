import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate, formatDateTime } from "@/lib/admin/format";
import {
  getLeadById,
  getLeadConversa,
  getLeadMessages,
  getLeadToolCalls,
} from "@/lib/admin/leads";
import { listPlanos } from "@/lib/admin/planos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LeadDetailActions } from "@/components/admin/lead-detail-actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  novo: "bg-line-soft text-ink",
  em_conversa: "bg-brand-soft text-brand-deep",
  qualificado: "bg-brand-soft text-brand-deep",
  interessado: "bg-brand-soft text-brand-deep",
  teste_aceito: "bg-orange-soft text-[#8a5a00]",
  convertido: "bg-cyan-soft text-ink",
  perdido: "bg-line text-muted",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const lead = await getLeadById(supabase, id);
  if (!lead) notFound();

  const [conversa, toolCalls, planos] = await Promise.all([
    getLeadConversa(supabase, id),
    getLeadToolCalls(supabase, id, 50),
    listPlanos(supabase),
  ]);
  const messages = await getLeadMessages(supabase, id, 500);
  const planosForActions = planos.map((p) => ({
    id: p.id,
    nome: p.nome,
    preco_base: p.preco_base,
    ativo: p.ativo,
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {lead.nome ?? lead.nome_responsavel ?? "(sem nome)"}
            </h1>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_BADGE[lead.status] ?? ""
              }`}
            >
              {lead.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {lead.whatsapp} · origem {lead.origem} · criado em {formatDate(lead.created_at)}
          </p>
        </div>
        <LeadDetailActions lead={lead} planos={planosForActions} />
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Dados do lead
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Field label="Responsavel" value={lead.nome_responsavel} />
            <Field label="Oficina (declarada)" value={lead.nome_oficina} />
            <Field label="Cidade" value={lead.cidade} />
            <Field label="Volume trocas/mes" value={lead.volume_trocas_mes} />
            <Field
              label="Ticket medio"
              value={lead.ticket_medio !== null ? `R$ ${lead.ticket_medio}` : null}
            />
            <Field label="Melhor horario" value={lead.melhor_horario_contato} />
            <Field label="Principal dor" value={lead.principal_dor} wide />
            <Field
              label="Interesse declarado em"
              value={
                lead.interesse_declarado_at
                  ? formatDateTime(lead.interesse_declarado_at)
                  : null
              }
            />
            <Field
              label="Convertido em"
              value={lead.converted_at ? formatDateTime(lead.converted_at) : null}
            />
            <Field label="Motivo perda" value={lead.motivo_perda} wide />
          </dl>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Conversa
          </h2>
          {conversa ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Field label="Agent mode" value={conversa.agent_mode} />
              <Field label="Participant type" value={conversa.participant_type} />
              <Field
                label="Handoff requerido"
                value={conversa.handoff_required ? "sim" : "nao"}
              />
              <Field label="Motivo handoff" value={conversa.handoff_reason} wide />
              <Field
                label="Ultima msg"
                value={
                  conversa.last_message_at
                    ? formatDateTime(conversa.last_message_at)
                    : null
                }
              />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">Sem conversa vinculada.</p>
          )}
          {lead.oficina_id ? (
            <div className="mt-4 rounded-lg bg-cyan-soft p-3 text-sm text-ink">
              Lead convertido em oficina:{" "}
              <Link
                href={`/admin/oficinas/${lead.oficina_id}`}
                className="font-medium hover:underline"
              >
                ver oficina
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Thread de mensagens ({messages.length})
        </h2>
        {messages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sem mensagens.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span className="font-medium">
                    {m.direction === "inbound" ? "↓ in" : "↑ out"}
                    {m.provider_status ? (
                      <span className="ml-2 text-muted">
                        ({m.provider_status})
                      </span>
                    ) : null}
                  </span>
                  <span>{formatDateTime(m.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-ink">
                  {m.body ?? <span className="text-muted">(sem corpo)</span>}
                </p>
                {m.provider_error_message ? (
                  <p className="mt-1 text-xs text-red">
                    Erro: {m.provider_error_message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Tool calls do agente ({toolCalls.length})
        </h2>
        {toolCalls.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sem tool calls.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {toolCalls.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <span className="font-mono text-xs">{t.tool_name}</span>
                  <span
                    className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.is_error
                        ? "bg-red-soft text-red"
                        : "bg-cyan-soft text-ink"
                    }`}
                  >
                    {t.is_error ? "erro" : "ok"}
                  </span>
                </div>
                <span className="text-xs text-muted">
                  {formatDateTime(t.created_at)}
                </span>
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
  value: string | number | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </dd>
    </div>
  );
}
