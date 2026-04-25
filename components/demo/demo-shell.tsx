"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { DashboardStep } from "@/components/demo/dashboard-step";
import { RegisterStep } from "@/components/demo/register-step";
import { RemindersStep } from "@/components/demo/reminders-step";
import { ReturnsStep } from "@/components/demo/returns-step";
import { WhatsappStep } from "@/components/demo/whatsapp-step";
import { useDemoStore } from "@/lib/demo-store";
import { cn } from "@/lib/utils";

const steps = [
  { id: "dashboard", label: "Receita" },
  { id: "register", label: "Cadastro" },
  { id: "reminders", label: "Lembrete" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "returns", label: "Retorno" },
] as const;

type StepId = (typeof steps)[number]["id"];

export function DemoShell() {
  const [activeStep, setActiveStep] = useState<StepId>("dashboard");
  const {
    state,
    metrics,
    selectedCustomer,
    registerCustomer,
    sendReminder,
    scheduleCustomer,
    confirmReturn,
    resetDemo,
  } = useDemoStore();

  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  const canGoBack = activeIndex > 0;
  const canGoForward = activeIndex < steps.length - 1;

  function goToIndex(index: number) {
    const next = steps[index];
    if (next) setActiveStep(next.id);
  }

  function handleRegister(
    input: Parameters<typeof registerCustomer>[0],
  ): ReturnType<typeof registerCustomer> {
    return registerCustomer(input);
  }

  function handleSendReminder(customerId: string) {
    sendReminder(customerId);
    setActiveStep("whatsapp");
  }

  function handleSchedule(customerId: string) {
    scheduleCustomer(customerId);
    setActiveStep("returns");
  }

  function handleReset() {
    resetDemo();
    setActiveStep("dashboard");
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="bg-grain fixed inset-0 -z-10 opacity-40" />
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Quando Trocar" className="flex items-center">
            <Image
              src="/logo.png"
              alt="Quando Trocar"
              width={220}
              height={98}
              sizes="96px"
              className="h-8 w-auto"
              priority
            />
          </Link>
          <div className="hidden h-5 w-px bg-line sm:block" />
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-muted sm:inline">
            demo comercial
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[12px] font-bold text-muted transition hover:border-brand hover:text-ink"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reiniciar demo</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-4 py-5 sm:px-6 sm:py-8">
        <section className="mb-5 rounded-[28px] border border-line bg-white p-3 shadow-[0_14px_44px_-38px_rgba(15,15,15,0.45)] sm:p-4">
          <div className="grid grid-cols-5 gap-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => goToIndex(index)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 text-center transition",
                  index === activeIndex
                    ? "bg-ink text-white"
                    : index < activeIndex
                      ? "bg-brand-soft text-brand-deep"
                      : "bg-paper-soft text-muted hover:text-ink",
                )}
              >
                <span className="font-mono text-[10px] font-black">
                  {index + 1}
                </span>
                <span className="text-[11px] font-extrabold sm:text-[13px]">
                  {step.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5">
          {activeStep === "dashboard" && (
            <DashboardStep
              metrics={metrics}
              onStart={() => setActiveStep("register")}
            />
          )}
          {activeStep === "register" && (
            <RegisterStep
              onRegister={handleRegister}
              onComplete={() => setActiveStep("reminders")}
            />
          )}
          {activeStep === "reminders" && (
            <RemindersStep
              customers={state.customers}
              selectedCustomerId={state.selectedCustomerId}
              onSend={handleSendReminder}
            />
          )}
          {activeStep === "whatsapp" && selectedCustomer && (
            <WhatsappStep customer={selectedCustomer} onSchedule={handleSchedule} />
          )}
          {activeStep === "returns" && selectedCustomer && (
            <ReturnsStep
              customers={state.customers}
              selectedCustomer={selectedCustomer}
              metrics={metrics}
              onConfirm={confirmReturn}
            />
          )}
        </section>

        <nav className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goToIndex(activeIndex - 1)}
            disabled={!canGoBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-[13px] font-extrabold text-ink transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </button>
          <button
            type="button"
            onClick={() => goToIndex(activeIndex + 1)}
            disabled={!canGoForward}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-[13px] font-extrabold text-white transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-35"
          >
            Proximo
            <ArrowRight className="size-4" />
          </button>
        </nav>
      </div>
    </main>
  );
}
