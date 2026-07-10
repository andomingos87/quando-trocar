import { getConfiguracoesVendedor } from "@/lib/admin/configuracoes-vendedor";
import { listRepresentantes } from "@/lib/admin/representantes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RepresentantesClient } from "@/components/admin/representantes-client";

export const dynamic = "force-dynamic";

export default async function RepresentantesPage() {
  const supabase = createSupabaseAdminClient();
  const [representantes, configVendedor] = await Promise.all([
    listRepresentantes(supabase),
    getConfiguracoesVendedor(supabase),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Representantes</h1>
        <p className="mt-1 text-sm text-muted">
          Rede comercial que distribui o Quando Trocar. Cada representante tem um
          link proprio — leads que chegam por ele ficam atribuidos e geram comissao
          quando a oficina paga.
        </p>
      </header>

      <RepresentantesClient
        initial={representantes}
        fraseLanding={configVendedor.frases_landing[0] ?? "oi quero testar o quando trocar"}
      />
    </div>
  );
}
