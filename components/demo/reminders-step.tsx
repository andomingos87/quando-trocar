import { ArrowRight, CheckCircle2, Clock3, Send } from "lucide-react";
import {
  type DemoCustomer,
  type ReminderStatus,
  formatDate,
} from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const statusLabel: Record<ReminderStatus, string> = {
  pendente: "pendente",
  enviado: "enviado",
  agendado: "agendado",
};

export function RemindersStep({
  customers,
  selectedCustomerId,
  onSend,
}: {
  customers: DemoCustomer[];
  selectedCustomerId: string;
  onSend: (customerId: string) => void;
}) {
  return (
    <section className="rounded-[28px] border border-line bg-white p-4 shadow-[0_18px_50px_-38px_rgba(15,15,15,0.45)] sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
            fila de retorno
          </span>
          <h2 className="font-display mt-2 text-3xl font-black leading-tight sm:text-4xl">
            Quem precisa receber lembrete hoje.
          </h2>
        </div>
        <div className="rounded-2xl bg-brand-soft px-4 py-3 text-[13px] font-bold text-brand-deep">
          {customers.filter((customer) => customer.reminderStatus === "pendente").length}{" "}
          pendentes
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
        <table className="w-full border-collapse text-left">
          <thead className="bg-paper-soft text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Veiculo</th>
              <th className="px-4 py-3">Ultima troca</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className={cn(
                  "text-[14px]",
                  customer.id === selectedCustomerId && "bg-brand-soft/45",
                )}
              >
                <td className="px-4 py-3 font-bold">{customer.name}</td>
                <td className="px-4 py-3 text-muted">{customer.vehicle}</td>
                <td className="px-4 py-3 text-muted">
                  {customer.daysSinceExchange} dias
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={customer.reminderStatus} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReminderAction customer={customer} onSend={onSend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {customers.map((customer) => (
          <article
            key={customer.id}
            className={cn(
              "rounded-2xl border border-line bg-paper p-4",
              customer.id === selectedCustomerId && "border-brand bg-brand-soft",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{customer.name}</h3>
                <p className="mt-1 text-[13px] text-muted">
                  {customer.vehicle} · {formatDate(customer.exchangeDate)}
                </p>
              </div>
              <StatusPill status={customer.reminderStatus} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted">
                <Clock3 className="size-4" />
                {customer.daysSinceExchange} dias
              </span>
              <ReminderAction customer={customer} onSend={onSend} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: ReminderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em]",
        status === "pendente" && "bg-paper-soft text-muted",
        status === "enviado" && "bg-blue-50 text-blue-700",
        status === "agendado" && "bg-green-50 text-green-700",
      )}
    >
      {status === "pendente" ? (
        <Clock3 className="size-3" />
      ) : (
        <CheckCircle2 className="size-3" />
      )}
      {statusLabel[status]}
    </span>
  );
}

function ReminderAction({
  customer,
  onSend,
}: {
  customer: DemoCustomer;
  onSend: (customerId: string) => void;
}) {
  if (customer.reminderStatus !== "pendente") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-muted">
        Ver conversa
        <ArrowRight className="size-3.5" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSend(customer.id)}
      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-[12px] font-extrabold text-white transition hover:bg-brand"
    >
      <Send className="size-3.5" />
      Enviar lembrete
    </button>
  );
}
