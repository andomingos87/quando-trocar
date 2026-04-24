import Link from "next/link";
import { siteConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink px-5 py-10 text-[13px] text-white/60 sm:px-8">
      <div className="mx-auto max-w-[1080px]">
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-[15px] font-bold tracking-tight text-white"
          >
            <span>QUANDO</span>
            <span className="text-brand">TROCAR?</span>
          </Link>
          <div className="flex-1" />
          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="font-mono text-[12px] transition-colors hover:text-white"
          >
            {siteConfig.contactEmail}
          </a>
        </div>

        <div className="hairline-dark my-6" />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
          <span>
            © {new Date().getFullYear()} {siteConfig.name}
          </span>
          <span className="text-white/20">/</span>
          <Link href="/termos" className="transition-colors hover:text-white">
            Termos
          </Link>
          <span className="text-white/20">/</span>
          <Link
            href="/privacidade"
            className="transition-colors hover:text-white"
          >
            Privacidade
          </Link>
          <span className="ml-auto text-white/30">feito com 🔧 no Brasil</span>
        </div>
      </div>
    </footer>
  );
}
