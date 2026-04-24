"use client";

import { useEffect, useRef, useState } from "react";

export function CountUp({
  to,
  from = 0,
  duration = 1.6,
  suffix = "",
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(from);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let started = false;
    let raf = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    const start = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const delta = to - from;
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / (duration * 1000));
        setDisplay(Math.round(from + delta * ease(p)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            start();
            obs.disconnect();
          }
        });
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, from, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}
