export const siteConfig = {
  name: "Quando Trocar",
  tagline: "seu cliente volta pra próxima troca",
  whatsappNumber:
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "5511999999999",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "contato@quandotrocar.com.br",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://quandotrocar.com.br",
} as const;

export function whatsappLink(message: string) {
  const text = encodeURIComponent(message);
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${text}`;
}
