import { describe, expect, test } from "vitest";

import {
  LANDING_CTA_SOURCES,
  LANDING_OFFER,
  buildLandingWhatsappLink,
  buildLandingWhatsappMessage,
  isLandingCtaSource,
  shouldShowFloatingCta,
} from "@/lib/landing-offer";
import { getStaticChatSteps, scripts } from "@/lib/chat-scripts";

describe("landing offer", () => {
  test("keeps the approved trial and monthly price in one contract", () => {
    expect(LANDING_OFFER).toMatchObject({
      trialDays: 14,
      monthlyPrice: 59,
      ctaLabel: "Começar meus 14 dias grátis",
    });
  });

  test("accepts only the six approved CTA sources", () => {
    expect(LANDING_CTA_SOURCES).toEqual([
      "landing_nav",
      "landing_hero",
      "landing_como_funciona",
      "landing_oferta",
      "landing_floating_mobile",
      "landing_cta_final",
    ]);
    expect(isLandingCtaSource("landing_hero")).toBe(true);
    expect(isLandingCtaSource("landing_unknown")).toBe(false);
  });

  test("builds a WhatsApp message with intent, trial and source", () => {
    expect(buildLandingWhatsappMessage("landing_hero")).toBe(
      "Olá! Quero começar meus 14 dias grátis no Quando Trocar para minha oficina.\nOrigem: landing_hero",
    );
  });

  test("builds a sanitized WhatsApp URL with the encoded message", () => {
    const link = buildLandingWhatsappLink("landing_oferta", "+55 (11) 98888-7777");

    expect(link).toBe(
      `https://wa.me/5511988887777?text=${encodeURIComponent(
        buildLandingWhatsappMessage("landing_oferta"),
      )}`,
    );
  });
});

describe("landing progressive enhancement", () => {
  test("keeps every chat step visible when animation is reduced", () => {
    expect(getStaticChatSteps("dono")).toEqual(scripts.dono);
    expect(getStaticChatSteps("cliente")).toEqual(scripts.cliente);
  });

  test("shows the mobile CTA only away from primary conversion areas", () => {
    expect(
      shouldShowFloatingCta({
        heroCtaVisible: false,
        offerCtaVisible: false,
        finalCtaVisible: false,
      }),
    ).toBe(true);
    expect(
      shouldShowFloatingCta({
        heroCtaVisible: true,
        offerCtaVisible: false,
        finalCtaVisible: false,
      }),
    ).toBe(false);
    expect(
      shouldShowFloatingCta({
        heroCtaVisible: false,
        offerCtaVisible: true,
        finalCtaVisible: false,
      }),
    ).toBe(false);
    expect(
      shouldShowFloatingCta({
        heroCtaVisible: false,
        offerCtaVisible: false,
        finalCtaVisible: true,
      }),
    ).toBe(false);
  });
});
