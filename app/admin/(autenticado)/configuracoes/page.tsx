import { requireAdmin } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Configuracoes</h1>
        <p className="mt-1 text-sm text-muted">
          Preferencias do painel e integracoes.
        </p>
      </header>

      <section className="rounded-2xl border border-dashed border-line bg-white px-5 py-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Em breve
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink">
          <li>Tema do painel (claro/escuro).</li>
          <li>Notificacoes por email para eventos criticos.</li>
          <li>Webhooks de auditoria.</li>
          <li>Cron de cobrancas e lembretes.</li>
        </ul>
      </section>
    </div>
  );
}
