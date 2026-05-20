import Link from "next/link";

import { getConfiguracoesVendedor } from "@/lib/admin/configuracoes-vendedor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/session";
import { ConfiguracoesVendedorForm } from "@/components/admin/configuracoes-vendedor-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const configuracoes = await getConfiguracoesVendedor(supabase);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Configuracoes</h1>
        <p className="mt-1 text-sm text-muted">
          Ajustes do agente vendedor que atende leads no WhatsApp.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-ink">Agente vendedor</h2>
          <p className="mt-1 text-sm text-muted">
            Mudancas sao auditadas e refletem no bot em ate 1 minuto.
          </p>
        </header>

        <ConfiguracoesVendedorForm initial={configuracoes} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Outros ajustes</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink">
          <li>
            <Link
              href="/admin/planos"
              className="text-brand hover:underline"
            >
              Preco de partida do plano
            </Link>
            <span className="text-muted">
              {" "}
              — edite em <code>preco_base</code> do plano &ldquo;Quando Trocar
              Mensal&rdquo;. O bot fala &ldquo;a partir de R$ X&rdquo;.
            </span>
          </li>
          <li>
            <Link href="/admin/faq" className="text-brand hover:underline">
              FAQ do vendedor
            </Link>
            <span className="text-muted"> — perguntas que o bot responde automaticamente.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
