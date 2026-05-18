"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "request" | "verify";

type State =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "info"; message: string };

export function EntrarForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [whatsapp, setWhatsapp] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  const requestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/admin/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok) {
        setState({
          status: "error",
          message: data.message ?? "Erro ao enviar codigo.",
        });
        return;
      }
      setStep("verify");
      setState({
        status: "info",
        message: data.message ?? "Se este numero estiver cadastrado, enviamos um codigo.",
      });
    } catch {
      setState({
        status: "error",
        message: "Erro de conexao. Tente novamente.",
      });
    }
  };

  const verifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({ status: "submitting" });
    try {
      const res = await fetch("/api/admin/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: data.message ?? "Codigo invalido.",
        });
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "Erro de conexao. Tente novamente.",
      });
    }
  };

  const submitting = state.status === "submitting";

  return (
    <div className="space-y-4">
      {step === "request" ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">WhatsApp</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+55 11 90000-0000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              disabled={submitting}
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? "Enviando..." : "Enviar codigo"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <p className="text-xs text-slate-600">
            Codigo enviado para <strong>{whatsapp}</strong>. Valido por 5 minutos.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Codigo</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-xl tracking-[0.6em] outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              disabled={submitting}
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep("request");
                setCode("");
                setState({ status: "idle" });
              }}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? "Validando..." : "Entrar"}
            </button>
          </div>
        </form>
      )}

      {state.status === "error" ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      ) : null}
      {state.status === "info" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
