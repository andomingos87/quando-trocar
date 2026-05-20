import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate, formatDateTime } from "@/lib/admin/format";
import {
  getClienteById,
  getClienteLembretes,
  getClienteMessages,
  getClienteVeiculos,
} from "@/lib/admin/clientes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ClienteDetailActions } from "@/components/admin/cliente-detail-actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  ativo: "bg-cyan-soft text-ink",
  opt_out: "bg-line text-muted",
  numero_errado: "bg-orange-soft text-[#8a5a00]",
};

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const cliente = await getClienteById(supabase, id);
  if (!cliente) notFound();

  const [veiculos, lembretes, messages] = await Promise.all([
    getClienteVeiculos(supabase, id),
    getClienteLembretes(supabase, id, 20),
    getClienteMessages(supabase, id, 20),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{cliente.nome_mascarado}</h1>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_BADGE[cliente.status] ?? ""
              }`}
            >
              {cliente.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {cliente.whatsapp_mascarado} · criado em {formatDate(cliente.created_at)}
          </p>
        </div>
        <ClienteDetailActions cliente={cliente} />
      </header>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Consentimento & oficina
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Field
            label="Consentimento"
            value={
              cliente.consentimento_whatsapp === true
                ? "sim"
                : cliente.consentimento_whatsapp === false
                ? "nao"
                : null
            }
          />
          <Field label="Origem consent." value={cliente.origem_consentimento} />
          <Field
            label="Data consent."
            value={
              cliente.data_consentimento
                ? formatDateTime(cliente.data_consentimento)
                : null
            }
          />
          <Field
            label="Opt-out em"
            value={cliente.opt_out_at ? formatDateTime(cliente.opt_out_at) : null}
          />
          <Field
            label="Oficina"
            value={
              cliente.oficina_id ? (
                <Link
                  href={`/admin/oficinas/${cliente.oficina_id}`}
                  className="text-ink hover:underline"
                >
                  {cliente.oficina_nome ?? cliente.oficina_id.slice(0, 8)}
                </Link>
              ) : null
            }
            wide
          />
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Veiculos ({veiculos.length})
        </h2>
        {veiculos.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sem veiculos.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {veiculos.map((v) => (
              <li key={v.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">
                    {v.descricao ?? "(sem descricao)"}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {v.placa ?? "—"}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Adicionado em {formatDate(v.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Lembretes ({lembretes.length})
        </h2>
        {lembretes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sem lembretes.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {lembretes.map((l) => (
              <li key={l.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/lembretes/${l.id}`}
                      className="font-medium text-ink hover:underline"
                    >
                      {l.servico_tipo ?? "lembrete"}
                    </Link>
                    <span className="ml-2 text-xs text-muted">
                      {l.veiculo_descricao ?? ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {l.status} · {formatDateTime(l.scheduled_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line-soft px-5 py-3 text-sm font-medium uppercase tracking-wide text-muted">
          Ultimas mensagens ({messages.length}) · truncadas
        </h2>
        {messages.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Sem mensagens.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {messages.map((m) => (
              <li key={m.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span>{m.direction === "inbound" ? "↓ in" : "↑ out"}</span>
                  <span>{formatDateTime(m.created_at)}</span>
                </div>
                <p className="mt-1 text-ink">{m.body_truncado}</p>
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
