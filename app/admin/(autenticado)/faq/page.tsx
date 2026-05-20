import { listFaqs } from "@/lib/admin/faq";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FaqClient } from "@/components/admin/faq-client";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const supabase = createSupabaseAdminClient();
  const faqs = await listFaqs(supabase);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">FAQ do vendedor</h1>
        <p className="mt-1 text-sm text-muted">
          Perguntas que o bot responde automaticamente. As palavras-chave decidem
          o match — adicione variacoes comuns (com/sem acento) pra cobrir mais
          mensagens. Mudancas demoram ate 1 minuto pra refletir no bot (cache).
        </p>
      </header>

      <FaqClient initialFaqs={faqs} />
    </div>
  );
}
