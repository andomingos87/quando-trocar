"use client";

import { forwardRef, useCallback } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { formatCep, formatCpfCnpj } from "@/lib/admin/documento-br";

const FIELD_BASE =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink tabular-nums outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-paper-soft disabled:opacity-70";

interface MaskedInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (formatted: string) => void;
}

/** CPF ou CNPJ com mascara dinamica (o backend guarda so digitos). */
export const CpfCnpjInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  function CpfCnpjInput({ value, onChange, className, ...props }, ref) {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => onChange(formatCpfCnpj(e.target.value)),
      [onChange],
    );
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        placeholder="CPF ou CNPJ"
        className={cn(FIELD_BASE, className)}
        {...props}
      />
    );
  },
);

/** CEP com mascara 00000-000. */
export const CepInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  function CepInput({ value, onChange, className, ...props }, ref) {
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => onChange(formatCep(e.target.value)),
      [onChange],
    );
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        value={value}
        onChange={handleChange}
        placeholder="00000-000"
        className={cn(FIELD_BASE, className)}
        {...props}
      />
    );
  },
);
