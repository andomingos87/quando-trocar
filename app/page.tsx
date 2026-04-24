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

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Dor />
        <ComoFunciona />
        <Objecoes />
        <Preco />
        <Faq />
        <CtaFinal />
      </main>
      <Footer />
      <FloatingCta />
    </>
  );
}
