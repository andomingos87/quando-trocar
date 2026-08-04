"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard bloqueado (contexto nao seguro / permissao): o link fica
      // visivel em texto para o rep selecionar e copiar na mao.
      setCopiado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      aria-live="polite"
    >
      {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copiado ? "Link copiado" : "Copiar meu link"}
    </button>
  );
}
