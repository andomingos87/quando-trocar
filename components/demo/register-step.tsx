"use client";

import type React from "react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  type DemoCustomer,
  type NewDemoCustomer,
  addDaysIso,
  formatDate,
  todayIso,
} from "@/lib/demo-data";

const defaultService = "Troca de oleo";

export function RegisterStep({
  onRegister,
  onComplete,
}: {
  onRegister: (input: NewDemoCustomer) => DemoCustomer;
  onComplete: () => void;
}) {
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<NewDemoCustomer>({
    name: "",
    whatsapp: "",
    vehicle: "",
    service: defaultService,
    exchangeDate: todayIso(),
  });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const reminderPreview = useMemo(
    () => formatDate(addDaysIso(form.exchangeDate || todayIso(), 90)),
    [form.exchangeDate],
  );

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  function updateField(name: keyof NewDemoCustomer, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim() || !form.whatsapp.trim() || !form.vehicle.trim()) {
      setError("Preencha nome, WhatsApp e veiculo para registrar a troca.");
      return;
    }

    onRegister(form);
    setToast("Cliente cadastrado! Proximo lembrete em 90 dias.");
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(onComplete, 900);
    setForm({
      name: "",
      whatsapp: "",
      vehicle: "",
      service: defaultService,
      exchangeDate: todayIso(),
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[28px] border border-line bg-white p-5 shadow-[0_18px_50px_-38px_rgba(15,15,15,0.45)] sm:p-6">
        <div className="mb-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
            cadastro em 10 segundos
          </span>
          <h2 className="font-display mt-2 text-3xl font-black leading-tight sm:text-4xl">
            Cliente chegou. Registra a troca.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            A oficina preenche o basico e o sistema ja agenda o lembrete de
            retorno.
          </p>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DemoInput
            label="Nome"
            value={form.name}
            onChange={(value) => updateField("name", value)}
            placeholder="Ex: Roberto Almeida"
          />
          <DemoInput
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(value) => updateField("whatsapp", value)}
            placeholder="(41) 99999-0000"
            inputMode="tel"
          />
          <DemoInput
            label="Veiculo"
            value={form.vehicle}
            onChange={(value) => updateField("vehicle", value)}
            placeholder="Ex: Gol 2018"
          />
          <DemoInput
            label="Servico"
            value={form.service}
            onChange={(value) => updateField("service", value)}
            placeholder={defaultService}
          />
          <DemoInput
            label="Data da troca"
            value={form.exchangeDate}
            onChange={(value) => updateField("exchangeDate", value)}
            type="date"
          />

          {error && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-1 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-4 text-base font-extrabold text-white shadow-[0_6px_0_var(--color-brand-dark)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_0_var(--color-brand-dark)] active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-brand-dark)]"
          >
            Registrar troca
            <ArrowRight className="size-4" />
          </button>
        </form>
      </section>

      <aside className="rounded-[28px] bg-ink p-5 text-white sm:p-6">
        <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
            lembrete gerado
          </div>
          <div className="mt-5 text-[15px] text-white/70">Proxima mensagem</div>
          <div className="font-display mt-2 text-5xl font-black leading-none text-brand">
            {reminderPreview}
          </div>
          <p className="mt-5 text-[15px] leading-relaxed text-white/72">
            O sistema guarda a troca de hoje e chama o cliente no momento certo,
            sem depender da memoria da recepcao.
          </p>
        </div>

        {toast && (
          <div className="mt-4 flex items-start gap-3 rounded-[22px] bg-white p-4 text-ink shadow-[0_20px_50px_-30px_rgba(255,255,255,0.8)]">
            <CheckCircle2 className="mt-0.5 size-5 flex-none text-brand" />
            <div>
              <div className="font-bold">Pronto.</div>
              <p className="text-[14px] leading-snug text-muted">{toast}</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function DemoInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[13px] font-bold text-ink">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        className="min-h-12 rounded-2xl border border-line bg-paper-soft px-4 text-[15px] font-semibold outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/15"
      />
    </label>
  );
}
