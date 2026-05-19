import Image from "next/image";
import { redirect } from "next/navigation";

import { getAdminFromCookie } from "@/lib/admin/session";
import { EntrarForm } from "./entrar-form";

export const dynamic = "force-dynamic";

export default async function EntrarPage() {
  const admin = await getAdminFromCookie();
  if (admin) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6">
          <Image
            src="/logo_qt_byperfect.png"
            alt="Quando Trocar"
            width={160}
            height={40}
            priority
            className="h-10 w-auto"
          />
          <p className="mt-5 text-[10px] font-medium uppercase tracking-widest text-muted">
            Painel admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Entrar</h1>
          <p className="mt-2 text-sm text-muted">
            Acesso restrito. Enviaremos um codigo via WhatsApp para confirmar.
          </p>
        </header>
        <EntrarForm />
      </div>
    </main>
  );
}
