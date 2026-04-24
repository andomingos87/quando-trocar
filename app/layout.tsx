import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { siteConfig } from "@/lib/config";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s — ${siteConfig.name}`,
  },
  description:
    "Você manda uma mensagem. A gente cuida do resto. Quando chegar a hora da próxima troca, o cliente volta — sem você precisar lembrar de nada.",
  keywords: [
    "oficina mecânica",
    "troca de óleo",
    "retenção de clientes",
    "whatsapp marketing",
    "agendamento automático",
  ],
  authors: [{ name: siteConfig.name }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: siteConfig.siteUrl,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description:
      "Seu cliente esquece de voltar pra você. A gente resolve — pelo WhatsApp, sem instalar nada.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description:
      "Seu cliente esquece de voltar pra você. A gente resolve — pelo WhatsApp, sem instalar nada.",
    images: ["/og.png"],
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f7931e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={geist.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
