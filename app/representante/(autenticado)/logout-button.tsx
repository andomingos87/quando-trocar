"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/representante/auth/logout", { method: "POST" });
    } finally {
      router.replace("/representante/entrar");
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-red transition hover:bg-red-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut size={16} aria-hidden />
      {loggingOut ? "Saindo..." : "Sair"}
    </button>
  );
}
