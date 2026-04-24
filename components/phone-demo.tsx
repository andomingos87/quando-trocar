"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { Mic, MoreVertical, Phone as PhoneIcon, Play } from "lucide-react";
import {
  type ChatCard,
  type ChatPerspective,
  type ChatStep,
  contacts,
  scripts,
} from "@/lib/chat-scripts";
import { cn } from "@/lib/utils";

type RenderItem =
  | { kind: "msg"; step: ChatStep; key: string }
  | { kind: "typing"; key: string };

const AUTO_SWITCH_HOLD_MS = 5000; // wait 5s after last message before switching

const WAVEFORM_HEIGHTS = [4, 8, 12, 6, 10, 4, 8, 12, 6, 10];
const WAVEFORM_BARS = Array.from({ length: 30 }, (_, i) => {
  const h = WAVEFORM_HEIGHTS[i % 10];
  return { x: i * 4, y: (14 - h) / 2, h, played: i < 10 };
});

function scheduleSequence(
  perspective: ChatPerspective,
  onUpdate: (items: RenderItem[]) => void,
  onDone: () => void,
) {
  const script = scripts[perspective];
  const items: RenderItem[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  let clock = 0;

  script.forEach((step, i) => {
    const pause = step.pauseBefore ?? (step.who === "me" ? 1800 : 900);
    clock += pause;

    const isThem = step.who === "them";
    const typingMs = isThem ? (step.typing ?? 2200) : 0;

    if (typingMs > 0) {
      const typingKey = `${perspective}-typing-${i}`;
      const showTyping = setTimeout(() => {
        items.push({ kind: "typing", key: typingKey });
        onUpdate([...items]);
      }, clock);
      timers.push(showTyping);
      clock += typingMs;

      const hideTyping = setTimeout(() => {
        const idx = items.findIndex(
          (it) => it.kind === "typing" && it.key === typingKey,
        );
        if (idx >= 0) items.splice(idx, 1);
      }, clock);
      timers.push(hideTyping);
    }

    const msgKey = `${perspective}-msg-${i}`;
    const showMsg = setTimeout(() => {
      items.push({ kind: "msg", step, key: msgKey });
      onUpdate([...items]);
    }, clock);
    timers.push(showMsg);
  });

  const finish = setTimeout(onDone, clock + AUTO_SWITCH_HOLD_MS);
  timers.push(finish);

  return () => timers.forEach(clearTimeout);
}

export function PhoneDemo() {
  const [perspective, setPerspective] = useState<ChatPerspective>("dono");
  const [items, setItems] = useState<RenderItem[]>([]);
  const [autoAlternate, setAutoAlternate] = useState(true);
  const autoRef = useRef(autoAlternate);
  autoRef.current = autoAlternate;

  const contact = contacts[perspective];

  useEffect(() => {
    setItems([]);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const script = scripts[perspective];
      setItems(
        script.map((step, i) => ({
          kind: "msg",
          step,
          key: `${perspective}-msg-${i}`,
        })),
      );
      return;
    }
    const cleanup = scheduleSequence(
      perspective,
      (next) => setItems(next),
      () => {
        if (autoRef.current && !document.hidden) {
          setPerspective((prev) => (prev === "dono" ? "cliente" : "dono"));
        }
      },
    );
    return cleanup;
  }, [perspective]);

  const handleTabClick = useCallback(
    (v: ChatPerspective) => {
      if (v === perspective) return;
      setAutoAlternate(false);
      setPerspective(v);
    },
    [perspective],
  );

  const tabs = useMemo(
    () => [
      { v: "dono" as const, emoji: "🔧", label: "dono" },
      { v: "cliente" as const, emoji: "🚗", label: "cliente" },
    ],
    [],
  );

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="relative flex justify-center">
      <div className="glow-brand absolute -inset-10 -z-10 rounded-full" />

      <div className="relative w-[min(340px,92vw)] rounded-[44px] border-[10px] border-ink bg-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.4),_0_12px_40px_-12px_rgba(0,0,0,0.25)]">
        <div className="mx-auto -mt-1 h-6 w-[110px] rounded-b-[18px] bg-ink" />

        <div
          className="absolute left-1/2 top-[58px] z-10 flex -translate-x-1/2 gap-0.5 rounded-full border border-line bg-white/95 p-[3px] text-[11px] font-semibold shadow-[0_6px_20px_-6px_rgba(0,0,0,0.2)] backdrop-blur"
          role="tablist"
          aria-label="Trocar perspectiva"
        >
          {tabs.map((t) => (
            <button
              key={t.v}
              role="tab"
              aria-selected={perspective === t.v}
              onClick={() => handleTabClick(t.v)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1.5 transition-all duration-300",
                perspective === t.v
                  ? "bg-ink text-white"
                  : "bg-transparent text-muted hover:text-ink",
              )}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative -mt-3 flex h-[580px] flex-col overflow-hidden rounded-[34px] bg-wa-bg">
          <div className="flex flex-none items-center gap-2.5 bg-wa-head px-3 pb-2.5 pt-4 text-white">
            <div className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-brand text-[13px] font-bold">
              {contact.avatar}
            </div>
            <div className="flex-1 leading-tight">
              <div className="text-[14px] font-semibold">{contact.name}</div>
              <div className="text-[11px] opacity-85">{contact.status}</div>
            </div>
            <div className="flex gap-3 opacity-85">
              <PhoneIcon className="size-4" />
              <MoreVertical className="size-4" />
            </div>
          </div>

          <div className="chat-dots flex flex-1 flex-col justify-end gap-1.5 overflow-hidden px-2.5 pb-3 pt-3">
            <AnimatePresence initial={false}>
              {items.map((item) =>
                item.kind === "typing" ? (
                  <TypingBubble key={item.key} />
                ) : (
                  <ChatBubble key={item.key} step={item.step} />
                ),
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-none items-center gap-2 border-t border-black/5 bg-line-soft px-2.5 py-2">
            <div className="flex-1 rounded-full bg-white px-3.5 py-2 text-[13px] text-[#9a9a9a]">
              Mensagem
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-wa-green text-white">
              <Mic className="size-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
    </LazyMotion>
  );
}

function TypingBubble() {
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex max-w-[70px] gap-[3px] self-start rounded-[10px] rounded-bl-[2px] bg-white px-3 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
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

function ChatBubble({ step }: { step: ChatStep }) {
  const isMe = step.who === "me";
  const hasCard = "card" in step && step.card;

  const base = cn(
    "max-w-[82%] break-words px-2.5 py-1.5 text-[13.5px] leading-snug shadow-[0_1px_1px_rgba(0,0,0,0.08)]",
    isMe
      ? "ml-auto rounded-[10px] rounded-tr-[2px] bg-wa-me"
      : "mr-auto rounded-[10px] rounded-tl-[2px] bg-wa-them",
  );

  return (
    <m.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={
        hasCard ? cn(base, "max-w-[88%] overflow-hidden bg-white p-0") : base
      }
    >
      {"audio" in step && step.audio ? (
        <AudioBubble duration={step.audio} t={step.t} />
      ) : "card" in step && step.card ? (
        <CardBubble card={step.card} t={step.t} />
      ) : "text" in step && step.text ? (
        <>
          {step.text}
          <TimeStamp t={step.t} isMe={isMe} />
        </>
      ) : null}
    </m.div>
  );
}

function AudioBubble({ duration, t }: { duration: string; t: string }) {
  return (
    <div className="flex min-w-[180px] items-center gap-2">
      <div className="flex size-7 flex-none items-center justify-center rounded-full bg-wa-green text-white">
        <Play className="size-3 fill-white" />
      </div>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm">
        <svg
          viewBox="0 0 120 14"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <pattern id="wave" x="0" y="0" width="4" height="14">
              <rect
                x="0"
                y="5"
                width="2"
                height="4"
                className="fill-[#9ca3af]"
              />
            </pattern>
          </defs>
          {WAVEFORM_BARS.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width="2"
              height={b.h}
              className={b.played ? "fill-[#25d366]" : "fill-[#bbb]"}
            />
          ))}
        </svg>
      </div>
      <div className="flex-none text-[10px] text-[#666]">{duration}</div>
      <TimeStamp t={t} isMe />
    </div>
  );
}

function CardBubble({ card, t }: { card: ChatCard; t: string }) {
  return (
    <>
      <div className="bg-brand px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
        {card.title}
      </div>
      <div className="px-3 py-2 text-[13px]">
        {card.rows.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between gap-2.5 border-b border-dashed border-black/5 py-1 last:border-b-0"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#777]">
              {k}
            </span>
            <span className="text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1 px-3 pb-2 pt-1.5">
        {card.actions.map((a) => (
          <div
            key={a.label}
            className={cn(
              "flex-1 rounded-lg border px-2 py-1.5 text-center text-[11px] font-bold",
              a.ok
                ? "border-brand bg-brand text-white"
                : "border-line bg-white",
            )}
          >
            {a.label}
          </div>
        ))}
      </div>
      <div className="px-3 pb-2 text-right font-mono text-[10px] text-[#777]">
        {t}
      </div>
    </>
  );
}

function TimeStamp({ t, isMe }: { t: string; isMe: boolean }) {
  return (
    <small className="ml-1.5 font-mono text-[9.5px] text-[#777]">
      {t}
      {isMe && <span className="ml-1 text-[#4fc3f7]">✓✓</span>}
    </small>
  );
}
