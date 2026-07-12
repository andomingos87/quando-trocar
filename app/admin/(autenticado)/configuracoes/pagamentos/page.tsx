import Link from "next/link";

import { ConfiguracoesPagamentoForm } from "@/components/admin/configuracoes-pagamento-form";
import { getConfiguracoesPagamento } from "@/lib/admin/configuracoes-pagamento";
import { requireAdmin } from "@/lib/admin/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPagamentoPage() {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const configuracoes = await getConfiguracoesPagamento(supabase);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://quandotrocar.com.br";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Gateway de pagamento</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha o provedor que gera as cobrancas das oficinas e gerencie as
          credenciais. Segredos ficam cifrados no cofre (Vault) — nunca sao
          exibidos de volta. Mudancas sao auditadas.{" "}
          <Link href="/admin/pagamentos" className="text-brand hover:underline">
            Ver pagamentos
          </Link>
          .
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <ConfiguracoesPagamentoForm initial={configuracoes} siteUrl={siteUrl} />
      </section>
    </div>
  );
}
