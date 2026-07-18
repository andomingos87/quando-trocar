import { StatusBadge } from "@/components/admin/ui";
import { formatDate, formatRelative } from "@/lib/admin/format";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import { requireRepresentante } from "@/lib/representante/api-guard";
import { listLeadsDoRepresentante } from "@/lib/representante/leads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAD_STATUS } from "../status";

export const dynamic = "force-dynamic";

export default async function RepresentanteLeadsPage() {
  const rep = await requireRepresentante();
  const supabase = createSupabaseAdminClient();
  const leads = await listLeadsDoRepresentante(supabase, rep.id);

  const emAberto = leads.filter((l) => l.emAberto).length;
  const convertidos = leads.filter((l) => l.convertido).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Leads</h1>
        <p className="mt-1 text-sm text-muted">
          Oficinas que chegaram pelo seu link e onde cada uma está no funil.
        </p>
      </header>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10">
          <p className="text-base font-medium text-ink">Nenhum lead ainda.</p>
          <p className="mt-1 text-sm text-muted">
            Divulgue seu link na <strong className="text-ink">Visão geral</strong>. Os leads que
            chegarem por ele aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 text-sm text-muted">
            <span>
              <strong className="text-ink tabular-nums">{emAberto}</strong> em aberto
            </span>
            <span aria-hidden>·</span>
            <span>
              <strong className="text-ink tabular-nums">{convertidos}</strong> convertidos
            </span>
          </div>

          <ul className="space-y-3">
            {leads.map((l) => {
              const status = LEAD_STATUS[l.status];
              return (
                <li key={l.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {l.nomeOficina ?? "Oficina sem nome"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {l.responsavel ? `${l.responsavel} · ` : ""}
                        {l.cidade ?? "Cidade não informada"}
                      </p>
                    </div>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{formatPhoneBR(l.whatsapp)}</span>
                    <span>
                      Última mensagem:{" "}
                      {l.lastMessageAt ? formatRelative(l.lastMessageAt) : "—"}
                    </span>
                    <span>Entrou em {formatDate(l.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
