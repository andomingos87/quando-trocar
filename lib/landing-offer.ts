import { whatsappLink } from "@/lib/config";

export const LANDING_CTA_SOURCES = [
  "landing_nav",
  "landing_hero",
  "landing_como_funciona",
  "landing_oferta",
  "landing_floating_mobile",
  "landing_cta_final",
] as const;

export type LandingCtaSource = (typeof LANDING_CTA_SOURCES)[number];

export const LANDING_OFFER = {
  trialDays: 14,
  monthlyPrice: 59,
  monthlyPriceLabel: "R$ 59/mês",
  /** Preço do teste. A âncora exibida é o mensal; o teste é o modificador. */
  trialPriceLabel: "R$ 0",
  ctaLabel: "Começar meus 14 dias grátis",
  microcopy: "Sem cartão · depois, R$ 59/mês · cancele quando quiser",
  closingMicrocopy: "Sem cartão · sem fidelidade · cancele quando quiser",
  benefits: [
    "14 dias grátis",
    "Sem cartão no teste",
    "Sem cobrança automática",
    "R$ 59 por mês depois do teste",
    "Sem fidelidade",
    "Cancelamento a qualquer momento",
    "Serviço pausado quando não houver pagamento",
  ],
} as const;

export function isLandingCtaSource(value: string): value is LandingCtaSource {
  return (LANDING_CTA_SOURCES as readonly string[]).includes(value);
}

export function buildLandingWhatsappMessage(source: LandingCtaSource) {
  return `Olá! Quero começar meus ${LANDING_OFFER.trialDays} dias grátis no Quando Trocar para minha oficina.\nOrigem: ${source}`;
}

export function buildLandingWhatsappLink(
  source: LandingCtaSource,
  phone?: string,
) {
  return whatsappLink({
    message: buildLandingWhatsappMessage(source),
    phone,
  });
}

export function shouldShowFloatingCta({
  heroCtaVisible,
  offerCtaVisible,
  finalCtaVisible,
}: {
  heroCtaVisible: boolean;
  offerCtaVisible: boolean;
  finalCtaVisible: boolean;
}) {
  return !heroCtaVisible && !offerCtaVisible && !finalCtaVisible;
}
