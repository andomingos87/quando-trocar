import { listPerguntasAbertas } from "@/lib/admin/perguntas-sem-resposta";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PerguntasSemRespostaClient } from "@/components/admin/perguntas-sem-resposta-client";

export const dynamic = "force-dynamic";

export default async function PerguntasSemRespostaPage() {
  const supabase = createSupabaseAdminClient();
  const perguntas = await listPerguntasAbertas(supabase);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Perguntas sem resposta</h1>
        <p className="mt-1 text-sm text-muted">
          Volante de aprendizado: o que o bot não soube responder, agrupado por
          frequência. Clique em <strong>Virar FAQ</strong> pra ensinar o bot (o
          formulário já vem preenchido) — ele passa a saber sem precisar de
          deploy. Ou <strong>Ignorar</strong> se não fizer sentido.
        </p>
      </header>

      <PerguntasSemRespostaClient initialPerguntas={perguntas} />
    </div>
  );
}
