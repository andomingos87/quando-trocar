import { formatDateTime } from "@/lib/admin/format";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";
import { requireRepresentante } from "@/lib/representante/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LogoutButton } from "../logout-button";

export const dynamic = "force-dynamic";

export default async function RepresentantePerfilPage() {
  const rep = await requireRepresentante();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("representantes")
    .select("ultimo_acesso_em, created_at")
    .eq("id", rep.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Perfil</h1>
        <p className="mt-1 text-sm text-muted">Seus dados de representante.</p>
      </header>

      <dl className="max-w-md space-y-1 rounded-2xl border border-line bg-white p-5 text-sm">
        <Row label="Nome">{rep.nome}</Row>
        <Row label="WhatsApp">{formatPhoneBR(rep.whatsapp)}</Row>
        <Row label="Código">#REP-{rep.codigo}</Row>
        {data?.created_at ? (
          <Row label="Representante desde">{formatDateTime(data.created_at)}</Row>
        ) : null}
        {data?.ultimo_acesso_em ? (
          <Row label="Último acesso">{formatDateTime(data.ultimo_acesso_em)}</Row>
        ) : null}
      </dl>

      <p className="max-w-md text-xs text-muted">
        Para atualizar seus dados (nome, WhatsApp ou código), fale com o time — o cadastro é
        gerenciado internamente.
      </p>

      <LogoutButton />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}
