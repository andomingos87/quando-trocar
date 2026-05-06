"use client";

import { useEffect, useState } from "react";

const SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
];

export function KonamiEasterEgg() {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let index = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const expected = SEQUENCE[index];
      if (e.code === expected) {
        index += 1;
        if (index === SEQUENCE.length) {
          index = 0;
          setPlaying(true);
          if (resetTimer) clearTimeout(resetTimer);
          resetTimer = setTimeout(() => setPlaying(false), 1700);
        }
      } else {
        // restart, but if the current key matches the first key of the sequence, count it
        index = e.code === SEQUENCE[0] ? 1 : 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, []);

  if (!playing) return null;

  // Three diagonal stripes sweeping across viewport.
  // Stagger via animation-delay; each stripe rotates -20deg per spec.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden motion-reduce:hidden"
    >
      <span
        className="absolute left-0 top-[30%] block h-20 w-[140vw] bg-red"
        style={{
          transform: "translateX(-120vw) rotate(-20deg)",
          animation: "stripe-sweep 1.5s ease-out forwards",
          animationDelay: "0ms",
          willChange: "transform",
        }}
      />
      <span
        className="absolute left-0 top-[45%] block h-20 w-[140vw] bg-brand"
        style={{
          transform: "translateX(-120vw) rotate(-20deg)",
          animation: "stripe-sweep 1.5s ease-out forwards",
          animationDelay: "80ms",
          willChange: "transform",
        }}
      />
      <span
        className="absolute left-0 top-[60%] block h-20 w-[140vw] bg-cyan"
        style={{
          transform: "translateX(-120vw) rotate(-20deg)",
          animation: "stripe-sweep 1.5s ease-out forwards",
          animationDelay: "160ms",
          willChange: "transform",
        }}
      />
    </div>
  );
}
