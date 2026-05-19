"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Field, Input, WhatsAppInput } from "@/components/admin/ui";

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
          <Field label="WhatsApp">
            <WhatsAppInput
              required
              value={whatsapp}
              onChange={setWhatsapp}
              disabled={submitting}
              autoFocus
            />
          </Field>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Enviando..." : "Enviar codigo"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <p className="text-xs text-muted">
            Codigo enviado para <strong className="text-ink">{whatsapp}</strong>. Valido por 5 minutos.
          </p>
          <Field label="Codigo">
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-xl tracking-[0.6em]"
              disabled={submitting}
              autoFocus
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setStep("request");
                setCode("");
                setState({ status: "idle" });
              }}
              disabled={submitting}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="flex-1"
            >
              {submitting ? "Validando..." : "Entrar"}
            </Button>
          </div>
        </form>
      )}

      {state.status === "error" ? (
        <p className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-sm text-red">
          {state.message}
        </p>
      ) : null}
      {state.status === "info" ? (
        <p className="rounded-lg border border-cyan/40 bg-cyan-soft px-3 py-2 text-sm text-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
