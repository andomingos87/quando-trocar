import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { LandingCtaSource } from "@/lib/landing-offer";
import { buildLandingWhatsappLink } from "@/lib/landing-offer";
import { formatRepSufixo, readIndicacao } from "@/lib/representante/indicacao";

// Server component: le o cookie de indicacao (`qt_ref`, httpOnly) e embute
// "#REP-<codigo>.<token>" no texto do wa.me. Sem indicacao ativa, o link fica
// exatamente como antes.
export async function LandingCta({
  source,
  children,
  variant = "primary",
  className,
}: {
  source: LandingCtaSource;
  children: ReactNode;
  variant?: "primary" | "white";
  className?: string;
}) {
  const indicacao = await readIndicacao();

  return (
    <Button
      href={buildLandingWhatsappLink(
        source,
        undefined,
        indicacao ? formatRepSufixo(indicacao) : null,
      )}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      className={className}
      data-landing-cta={source}
    >
      {children}
    </Button>
  );
}
