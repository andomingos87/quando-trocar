import { CheckCircle2, DollarSign, RotateCcw } from "lucide-react";
import {
  type DemoCustomer,
  type DemoMetrics,
  demoWorkshop,
  formatCurrency,
  formatDate,
} from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export function ReturnsStep({
  customers,
  selectedCustomer,
  metrics,
  onConfirm,
}: {
  customers: DemoCustomer[];
  selectedCustomer: DemoCustomer;
  metrics: DemoMetrics;
  onConfirm: (customerId: string, value?: number) => void;
}) {
  const returnedCustomers = customers.filter((customer) => customer.returned);
  const canConfirmSelected = !selectedCustomer.returned;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <section className="rounded-[28px] bg-brand p-5 text-white sm:p-6">
        <div className="bg-blueprint rounded-[24px] border border-white/20 p-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/75">
            conversao
          </span>
          <h2 className="font-display mt-3 text-3xl font-black leading-tight sm:text-4xl">
            Cliente voltou. Dinheiro entrou.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/86">
            Esse e o fechamento da demo: o lembrete nao e mensagem, e retorno
            para a oficina.
          </p>
        </div>

        <div className="mt-5 rounded-[24px] bg-white p-5 text-ink">
          <div className="text-[13px] font-bold text-muted">
            Retorno selecionado
          </div>
          <div className="mt-1 text-2xl font-black">{selectedCustomer.name}</div>
          <div className="mt-1 text-[14px] text-muted">
            {selectedCustomer.vehicle} · {formatCurrency(demoWorkshop.averageTicket)}
          </div>
          <button
            type="button"
            onClick={() =>
              onConfirm(selectedCustomer.id, demoWorkshop.averageTicket)
            }
            disabled={!canConfirmSelected}
            className={cn(
              "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-extrabold transition",
              canConfirmSelected
                ? "bg-ink text-white hover:bg-brand"
                : "bg-green-50 text-green-700",
            )}
          >
            {canConfirmSelected ? (
              <>
                Confirmar retorno
                <DollarSign className="size-4" />
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Retorno confirmado
              </>
            )}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_18px_50px_-38px_rgba(15,15,15,0.45)]">
        <div className="flex items-center justify-between gap-4 border-b border-line bg-paper-soft px-5 py-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              retornos concluidos
            </div>
            <div className="mt-1 text-lg font-black">{returnedCustomers.length} clientes</div>
          </div>
          <RotateCcw className="size-5 text-brand" />
        </div>

        <div className="divide-y divide-line">
          {returnedCustomers.map((customer) => (
            <article
              key={customer.id}
              className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <div className="font-bold">{customer.name}</div>
                <div className="mt-1 text-[13px] text-muted">
                  {customer.vehicle} · retorno em{" "}
                  {formatDate(customer.returnDate ?? customer.reminderDate)}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-green-700">
                  concluido
                </span>
                <span className="font-display text-2xl font-black text-ink">
                  {formatCurrency(
                    customer.returnValue ?? demoWorkshop.averageTicket,
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-line bg-ink px-5 py-5 text-white">
          <div className="text-[13px] font-semibold text-white/65">
            Receita gerada por lembretes este mes
          </div>
          <div className="font-display mt-1 text-[clamp(2.4rem,8vw,4.5rem)] font-black leading-none text-brand">
            {formatCurrency(metrics.generatedRevenue)}
          </div>
        </footer>
      </section>
    </div>
  );
}
