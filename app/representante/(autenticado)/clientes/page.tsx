import { StatusBadge } from "@/components/admin/ui";
import { formatBRL, formatDate } from "@/lib/admin/format";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import { requireRepresentante } from "@/lib/representante/api-guard";
import { listOficinasDoRepresentante } from "@/lib/representante/carteira";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OFICINA_STATUS } from "../status";

export const dynamic = "force-dynamic";

export default async function RepresentanteClientesPage() {
  const rep = await requireRepresentante();
  const supabase = createSupabaseAdminClient();
  const oficinas = await listOficinasDoRepresentante(supabase, rep.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Clientes</h1>
        <p className="mt-1 text-sm text-muted">
          As oficinas que você trouxe e a tração de cada uma. Sem dados dos clientes finais das oficinas.
        </p>
      </header>

      {oficinas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10">
          <p className="text-base font-medium text-ink">Nenhuma oficina ainda.</p>
          <p className="mt-1 text-sm text-muted">
            Divulgue seu link na <strong className="text-ink">Visão geral</strong> para trazer a
            primeira oficina.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {oficinas.map((o) => {
            const status = OFICINA_STATUS[o.status];
            return (
              <article key={o.id} className="rounded-2xl bg-white p-5 ring-1 ring-line">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-ink">{o.nome}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {o.cidade ?? "Cidade não informada"}
                    </p>
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-line-soft py-3">
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      Clientes
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                      {o.clientesFinaisCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      Lembretes
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                      {o.lembretesEnviados}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">
                      Respondidos
                    </dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                      {o.lembretesRespondidos}
                    </dd>
                  </div>
                </dl>

                <dl className="mt-3 space-y-1.5 text-sm">
                  <Row label="Plano">{o.planoNome ?? "—"}</Row>
                  <Row label="Mensalidade">{formatBRL(o.precoMensal)}</Row>
                  <Row label="Ativa desde">{formatDate(o.ativaDesde)}</Row>
                  {o.responsavel ? <Row label="Responsável">{o.responsavel}</Row> : null}
                  <Row label="WhatsApp">{formatPhoneBR(o.whatsapp)}</Row>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-ink">{children}</dd>
    </div>
  );
}
