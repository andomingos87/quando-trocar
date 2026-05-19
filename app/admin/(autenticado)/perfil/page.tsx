import { Card, CardHint, CardLabel, CardValue } from "@/components/admin/ui";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import { getAdminProfile } from "@/lib/admin/admins";
import { requireAdmin } from "@/lib/admin/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await requireAdmin();
  const supabase = createSupabaseAdminClient();
  const profile = await getAdminProfile(supabase, session.adminId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Perfil</h1>
        <p className="mt-1 text-sm text-muted">
          Suas informacoes de acesso ao painel admin.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardLabel>Nome</CardLabel>
          <CardValue>{profile?.nome ?? "—"}</CardValue>
          <CardHint>Visivel para outros admins na lista de usuarios.</CardHint>
        </Card>
        <Card>
          <CardLabel>WhatsApp</CardLabel>
          <CardValue>{formatPhoneBR(profile?.whatsapp ?? "")}</CardValue>
          <CardHint>Usado para enviar o codigo de login. Nao pode ser alterado por aqui.</CardHint>
        </Card>
      </section>

      <section className="rounded-2xl border border-dashed border-line bg-white px-5 py-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Em breve
        </h2>
        <p className="mt-2 text-sm text-ink">
          Alteracao de nome, troca de WhatsApp e gestao de sessoes ativas.
        </p>
      </section>
    </div>
  );
}
