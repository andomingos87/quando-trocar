import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { Dor } from "@/components/dor";
import { ComoFunciona } from "@/components/como-funciona";
import { Objecoes } from "@/components/objecoes";
import { Preco } from "@/components/preco";
import { Faq } from "@/components/faq";
import { CtaFinal } from "@/components/cta-final";
import { Footer } from "@/components/footer";
import { FloatingCta } from "@/components/floating-cta";
import { Transparencia } from "@/components/transparencia";
import { Beneficios } from "@/components/beneficios";
import { formatRepSufixo, readIndicacao } from "@/lib/representante/indicacao";

// Dinamica por causa do cookie de indicacao do representante (`qt_ref`): o
// texto do wa.me muda por visitante.
export const dynamic = "force-dynamic";

export default async function Home() {
  const indicacao = await readIndicacao();
  const repSufixo = indicacao ? formatRepSufixo(indicacao) : null;

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Transparencia />
        <Dor />
        <ComoFunciona />
        <Beneficios />
        <Preco />
        <Objecoes />
        <Faq />
        <CtaFinal />
      </main>
      <Footer />
      <FloatingCta repSufixo={repSufixo} />
    </>
  );
}
