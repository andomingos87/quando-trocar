import type React from "react";
import {
  ArrowRight,
  CalendarClock,
  MessageCircle,
  RotateCcw,
  Users,
} from "lucide-react";
import { type DemoMetrics, demoWorkshop, formatCurrency } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
};

export function DashboardStep({
  metrics,
  onStart,
}: {
  metrics: DemoMetrics;
  onStart: () => void;
}) {
  const stats: Stat[] = [
    {
      label: "Clientes cadastrados",
      value: String(metrics.registeredCustomers),
      note: "base ativa para chamar de volta",
      icon: Users,
    },
    {
      label: "Lembretes enviados",
      value: String(metrics.sentReminders),
      note: "WhatsApps que sairam no prazo",
      icon: MessageCircle,
    },
    {
      label: "Clientes que voltaram",
      value: String(metrics.returnedCustomers),
      note: "retornos confirmados",
      icon: RotateCcw,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        {stats.map((stat) => (
          <MetricCard key={stat.label} stat={stat} />
        ))}
      </div>

      <section className="relative overflow-hidden rounded-[28px] bg-brand p-6 text-white shadow-[0_24px_70px_-34px_rgba(247,147,30,0.9)] sm:p-8 lg:min-h-[420px]">
        <div className="bg-blueprint absolute inset-0 opacity-35" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em]">
              <CalendarClock className="size-3.5" />
              resultado do mes
            </div>
            <p className="mt-8 max-w-[360px] text-[17px] font-semibold leading-snug text-white/88">
              Essa oficina gerou receita com clientes que voltaram depois do
              lembrete.
            </p>
          </div>

          <div>
            <div className="font-display text-[clamp(3.6rem,13vw,7rem)] font-black leading-none tracking-[-0.04em]">
              {formatCurrency(metrics.generatedRevenue)}
            </div>
            <p className="mt-4 text-[15px] font-semibold text-white/85">
              {demoWorkshop.name} · {demoWorkshop.city}
            </p>
            <button
              type="button"
              onClick={onStart}
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-[15px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-white hover:text-ink"
            >
              Comecar demonstracao
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;

  return (
    <section
      className={cn(
        "rounded-[24px] border border-line bg-white p-5 shadow-[0_18px_50px_-38px_rgba(15,15,15,0.4)]",
        "min-h-[150px]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Icon className="size-5" />
        </div>
        <span className="rounded-full bg-paper-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          agora
        </span>
      </div>
      <div className="mt-7 font-display text-5xl font-black leading-none">
        {stat.value}
      </div>
      <div className="mt-3 text-[15px] font-bold text-ink">{stat.label}</div>
      <p className="mt-1 text-[13px] leading-snug text-muted">{stat.note}</p>
    </section>
  );
}
