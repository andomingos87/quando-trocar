import { listPlanos } from "@/lib/admin/planos";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PlanosClient } from "@/components/admin/planos-client";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const supabase = createSupabaseAdminClient();
  const planos = await listPlanos(supabase);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planos</h1>
          <p className="mt-1 text-sm text-muted">
            Plano unico do MVP. Use <strong>preco_base</strong> como default e
            ajuste por oficina via <code>preco_negociado</code>.
          </p>
        </div>
      </header>

      <PlanosClient initialPlanos={planos} />
    </div>
  );
}
