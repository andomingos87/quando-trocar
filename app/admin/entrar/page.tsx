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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
            Quando Trocar
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Painel admin</h1>
          <p className="mt-2 text-sm text-slate-600">
            Acesso restrito. Enviaremos um codigo via WhatsApp para confirmar.
          </p>
        </header>
        <EntrarForm />
      </div>
    </main>
  );
}
