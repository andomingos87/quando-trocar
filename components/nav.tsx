import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const links = [
  { href: "#como", label: "Como funciona" },
  { href: "#objecoes", label: "Objeções" },
  { href: "#preco", label: "Preço" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1200px] items-center gap-4 px-5 py-3 sm:px-8 sm:py-4">
        <Link
          href="/"
          className="flex items-center transition-transform hover:-rotate-2"
          aria-label="Quando Trocar"
        >
          <Image
            src="/logo.png"
            alt="Quando Trocar"
            width={240}
            height={106}
            sizes="100px"
            className="h-8 w-auto sm:h-9"
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
          className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-brand"
        >
          Testar grátis
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </Link>
      </div>
    </nav>
  );
}
