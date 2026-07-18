"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Card "Seu link": mostra o codigo do rep e o link wa.me pronto (frase-gatilho +
// #REP-codigo, montado no servidor) com botao copiar. Client so pelo clipboard.
export function CopyLinkCard({ codigo, link }: { codigo: string; link: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponivel — ignora silenciosamente.
    }
  };

  return (
    <div className="rounded-2xl bg-ink-deep p-5 text-paper ring-1 ring-ink/40">
      <p className="text-[10px] font-medium uppercase tracking-widest text-paper/50">
        Seu link de divulgação
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="rounded-md bg-white/10 px-2 py-1 text-sm font-semibold tracking-wide text-paper">
          #REP-{codigo}
        </code>
      </div>
      <p className="mt-3 break-all text-xs text-paper/70">{link}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark sm:w-auto"
      >
        {copied ? (
          <>
            <Check size={16} aria-hidden /> Copiado!
          </>
        ) : (
          <>
            <Copy size={16} aria-hidden /> Copiar link
          </>
        )}
      </button>
      <p className="mt-3 text-xs text-paper/60">
        A oficina que abrir este link já entra atribuída a você. Não altere o trecho{" "}
        <span className="font-medium text-paper/80">#REP-{codigo}</span>.
      </p>
    </div>
  );
}
