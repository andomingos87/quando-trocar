import { StatusBadge, type StatusTone } from "@/components/admin/ui";
import { formatDate } from "@/lib/admin/format";
import { requireRepresentante } from "@/lib/representante/api-guard";
import { type NovidadeTag, listNovidades } from "@/lib/representante/content/novidades";

export const dynamic = "force-dynamic";

const TAG: Record<NovidadeTag, { label: string; tone: StatusTone }> = {
  produto: { label: "Produto", tone: "brand" },
  comercial: { label: "Comercial", tone: "info" },
  aviso: { label: "Aviso", tone: "atencao" },
};

export default async function RepresentanteNovidadesPage() {
  await requireRepresentante();
  const novidades = listNovidades();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Novidades</h1>
        <p className="mt-1 text-sm text-muted">Comunicados do time para a rede de representantes.</p>
      </header>

      {novidades.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-10">
          <p className="text-base font-medium text-ink">Nenhuma novidade ainda.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {novidades.map((n) => {
            const tag = TAG[n.tag];
            return (
              <li key={n.id} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex items-center gap-3">
                  <StatusBadge tone={tag.tone}>{tag.label}</StatusBadge>
                  <time dateTime={n.data} className="text-xs text-muted">
                    {formatDate(n.data)}
                  </time>
                </div>
                <h2 className="mt-2 text-base font-semibold text-ink">{n.titulo}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{n.corpo}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
