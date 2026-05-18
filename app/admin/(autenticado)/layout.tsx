import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/admin/session";
import { LogoutButton } from "./logout-button";

const NAV_ITEMS = [
  { href: "/admin", label: "Visao geral" },
  { href: "/admin/oficinas", label: "Oficinas" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
  { href: "/admin/admins", label: "Admins" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

export default async function AdminAuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="px-5 py-6">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
            Quando Trocar
          </p>
          <p className="text-base font-semibold">Admin</p>
        </div>
        <nav className="flex-1 px-2 pb-4">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm text-slate-600">
            Logado como <span className="font-medium text-slate-900">{admin.whatsapp}</span>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
