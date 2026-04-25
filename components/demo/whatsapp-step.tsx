"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { CheckCircle2, Mic, MoreVertical, Phone, Send } from "lucide-react";
import { type DemoCustomer, demoWorkshop } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  who: "shop" | "customer";
  text: string;
  time: string;
};

type RenderItem =
  | { kind: "message"; message: ChatMessage }
  | { kind: "typing"; id: string };

function buildScript(customer: DemoCustomer): ChatMessage[] {
  return [
    {
      id: "shop-reminder",
      who: "shop",
      text: `Oi ${customer.name.split(" ")[0]}, aqui e da ${demoWorkshop.name}. Ja esta na hora da sua proxima troca de oleo do ${customer.vehicle}. Quer agendar?`,
      time: "09:15",
    },
    {
      id: "customer-reply",
      who: "customer",
      text: "Opa, pode ser quinta 14h?",
      time: "09:18",
    },
    {
      id: "shop-confirm",
      who: "shop",
      text: "Pode sim. Quinta as 14h esta reservado. Te esperamos aqui!",
      time: "09:19",
    },
  ];
}

export function WhatsappStep({
  customer,
  onSchedule,
}: {
  customer: DemoCustomer;
  onSchedule: (customerId: string) => void;
}) {
  const script = useMemo(() => buildScript(customer), [customer]);
  const [items, setItems] = useState<RenderItem[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setItems([]);
    setFinished(false);

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setItems(script.map((message) => ({ kind: "message", message })));
      setFinished(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let clock = 450;

    script.forEach((message) => {
      const isCustomer = message.who === "customer";

      if (isCustomer) {
        const typingId = `typing-${message.id}`;
        timers.push(
          setTimeout(() => {
            setItems((current) => [...current, { kind: "typing", id: typingId }]);
          }, clock),
        );
        clock += 1450;
        timers.push(
          setTimeout(() => {
            setItems((current) =>
              current.filter(
                (item) => item.kind !== "typing" || item.id !== typingId,
              ),
            );
          }, clock),
        );
      }

      timers.push(
        setTimeout(() => {
          setItems((current) => [...current, { kind: "message", message }]);
        }, clock),
      );
      clock += isCustomer ? 950 : 1200;
    });

    timers.push(setTimeout(() => setFinished(true), clock + 250));
    return () => timers.forEach(clearTimeout);
  }, [script]);

  const alreadyScheduled = customer.reminderStatus === "agendado";

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[28px] bg-ink p-5 text-white sm:p-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
          momento magico
        </span>
        <h2 className="font-display mt-2 text-3xl font-black leading-tight sm:text-4xl">
          O cliente responde e agenda.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/72">
          A demo precisa mostrar que o lembrete vira uma conversa simples, sem
          explicar integracao ou tecnologia.
        </p>

        <div className="mt-6 rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
          <div className="text-[13px] text-white/55">Cliente selecionado</div>
          <div className="mt-1 text-xl font-black">{customer.name}</div>
          <div className="mt-1 text-[14px] text-white/65">{customer.vehicle}</div>
        </div>

        <button
          type="button"
          onClick={() => onSchedule(customer.id)}
          disabled={!finished || alreadyScheduled}
          className={cn(
            "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-extrabold transition",
            alreadyScheduled
              ? "bg-green-500 text-white"
              : "bg-brand text-white hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/35",
          )}
        >
          {alreadyScheduled ? (
            <>
              <CheckCircle2 className="size-4" />
              Agendado
            </>
          ) : (
            <>
              Marcar como agendado
              <Send className="size-4" />
            </>
          )}
        </button>
      </section>

      <LazyMotion features={domAnimation} strict>
        <section className="mx-auto w-full max-w-[390px] rounded-[34px] border-[9px] border-ink bg-ink shadow-[0_28px_80px_-38px_rgba(0,0,0,0.65)]">
          <div className="mx-auto h-5 w-[108px] rounded-b-[18px] bg-ink" />
          <div className="-mt-1 flex h-[620px] flex-col overflow-hidden rounded-[26px] bg-wa-bg">
            <header className="flex items-center gap-3 bg-wa-head px-3 pb-3 pt-4 text-white">
              <div className="flex size-10 items-center justify-center rounded-full bg-brand text-[13px] font-black">
                AC
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">
                  {demoWorkshop.name}
                </div>
                <div className="text-[11px] text-white/82">online</div>
              </div>
              <Phone className="size-4 opacity-85" />
              <MoreVertical className="size-4 opacity-85" />
            </header>

            <div className="chat-dots flex flex-1 flex-col justify-end gap-1.5 overflow-hidden px-3 pb-3 pt-3">
              <AnimatePresence initial={false}>
                {items.map((item) =>
                  item.kind === "typing" ? (
                    <TypingBubble key={item.id} />
                  ) : (
                    <ChatBubble key={item.message.id} message={item.message} />
                  ),
                )}
              </AnimatePresence>
            </div>

            <footer className="flex items-center gap-2 border-t border-black/5 bg-line-soft px-3 py-2">
              <div className="flex-1 rounded-full bg-white px-3.5 py-2 text-[13px] text-[#8a8a8a]">
                Mensagem
              </div>
              <div className="flex size-9 items-center justify-center rounded-full bg-wa-green text-white">
                <Mic className="size-4" />
              </div>
            </footer>
          </div>
        </section>
      </LazyMotion>
    </div>
  );
}

function TypingBubble() {
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      className="mr-auto flex max-w-[70px] gap-[3px] rounded-[10px] rounded-tl-[2px] bg-white px-3 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
      aria-label="digitando"
    >
      <span className="size-1.5 animate-typing-bounce rounded-full bg-[#999]" />
      <span
        className="size-1.5 animate-typing-bounce rounded-full bg-[#999]"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="size-1.5 animate-typing-bounce rounded-full bg-[#999]"
        style={{ animationDelay: "0.3s" }}
      />
    </m.div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isShop = message.who === "shop";

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "max-w-[84%] break-words px-3 py-2 text-[13.5px] leading-snug shadow-[0_1px_1px_rgba(0,0,0,0.08)]",
        isShop
          ? "ml-auto rounded-[10px] rounded-tr-[2px] bg-wa-me"
          : "mr-auto rounded-[10px] rounded-tl-[2px] bg-wa-them",
      )}
    >
      {message.text}
      <small className="ml-1.5 font-mono text-[9.5px] text-[#777]">
        {message.time}
        {isShop && <span className="ml-1 text-[#4fc3f7]">✓✓</span>}
      </small>
    </m.div>
  );
}
