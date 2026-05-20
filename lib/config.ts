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

export function whatsappLink(message: string): string;
export function whatsappLink(input: { message?: string; phone?: string }): string;
export function whatsappLink(input: string | { message?: string; phone?: string }) {
  const message = typeof input === "string" ? input : input.message ?? "";
  const rawPhone = typeof input === "string" ? siteConfig.whatsappNumber : input.phone ?? siteConfig.whatsappNumber;
  const phone = rawPhone.replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return text ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/${phone}`;
}
