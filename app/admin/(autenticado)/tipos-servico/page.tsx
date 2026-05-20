import { listTiposServico } from "@/lib/admin/tipos-servico";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TiposServicoClient } from "@/components/admin/tipos-servico-client";

export const dynamic = "force-dynamic";

export default async function TiposServicoPage() {
  const supabase = createSupabaseAdminClient();
  const tipos = await listTiposServico(supabase);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Tipos de servico</h1>
        <p className="mt-1 text-sm text-muted">
          Cadencia (dias entre cadastro e proximo lembrete) e template Meta por tipo
          de servico. Templates devem estar aprovados na Meta antes de ativar o tipo.
        </p>
      </header>

      <TiposServicoClient initialTipos={tipos} />
    </div>
  );
}
