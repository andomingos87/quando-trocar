import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { LandingCtaSource } from "@/lib/landing-offer";
import { buildLandingWhatsappLink } from "@/lib/landing-offer";

export function LandingCta({
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
  return (
    <Button
      href={buildLandingWhatsappLink(source)}
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
