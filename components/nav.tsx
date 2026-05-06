import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const links = [
  { href: "#como", label: "Como funciona" },
  { href: "#objecoes", label: "Objeções" },
  { href: "#preco", label: "Preço" },
  { href: "#faq", label: "FAQ" },
  { href: "/demo", label: "Demo" },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-5 py-3 sm:px-8 sm:py-4">
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label="Quando Trocar by Perfect Automotive"
        >
          <Image
            src="/logo_qt_byperfect.png"
            alt="Quando Trocar by Perfect Automotive"
            width={1810}
            height={697}
            sizes="180px"
            className="h-10 w-auto sm:h-11"
            priority
          />
        </Link>
        <div className="flex-1" />
        <div className="hidden gap-7 text-[13.5px] text-muted lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative py-1 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mx-4 hidden h-5 w-px bg-line lg:block" />
        <Link
          href="#cta-final"
          className="group inline-flex items-center gap-1.5 bg-brand px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition-colors hover:bg-brand-dark"
        >
          Testar grátis
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </Link>
      </div>
    </nav>
  );
}
