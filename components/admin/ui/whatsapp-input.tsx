"use client";

import { forwardRef, useCallback } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { formatPhoneBR } from "@/lib/admin/format-phone-br";

interface WhatsAppInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (formatted: string) => void;
}

/**
 * WhatsApp input with Brazilian flag + +55 prefix badge and live mask.
 *
 * Visual:
 *   ┌──────────────┬─────────────────────────────┐
 *   │ 🇧🇷 +55       │ (11) 90000-0000             │
 *   └──────────────┴─────────────────────────────┘
 *
 * Value sent to onChange is the masked string (e.g. "(11) 90000-0000").
 * The backend's `normalizePhoneToE164` strips formatting and adds +55, so
 * any masked value is accepted.
 */
export const WhatsAppInput = forwardRef<HTMLInputElement, WhatsAppInputProps>(
  function WhatsAppInput({ value, onChange, className, disabled, ...props }, ref) {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneBR(e.target.value);
        onChange(formatted);
      },
      [onChange],
    );

    return (
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-lg border border-line bg-white transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20",
          disabled && "opacity-70",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center gap-1.5 border-r border-line bg-paper-soft px-3 py-2 text-sm font-medium text-ink"
        >
          <BrazilFlag className="h-4 w-5 shrink-0 rounded-[2px]" />
          <span className="tabular-nums text-muted">+55</span>
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="(11) 90000-0000"
          className="min-w-0 flex-1 bg-white px-3 py-2 text-base text-ink tabular-nums outline-none placeholder:text-muted/70 disabled:cursor-not-allowed disabled:bg-paper-soft"
          {...props}
        />
      </div>
    );
  },
);

/** Simplified inline SVG of the Brazilian flag — rendering-stable across OS/browsers. */
function BrazilFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 20"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Brasil"
    >
      <rect width="28" height="20" fill="#009C3B" />
      <polygon points="14,2.5 25.5,10 14,17.5 2.5,10" fill="#FFDF00" />
      <circle cx="14" cy="10" r="3.8" fill="#002776" />
      <path
        d="M10.6,9.4 A4,4 0 0,1 17.4,9.4"
        stroke="#FFFFFF"
        strokeWidth="0.6"
        fill="none"
      />
    </svg>
  );
}
