import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "white";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_6px_0_var(--color-brand-dark)] hover:-translate-y-0.5 hover:shadow-[0_8px_0_var(--color-brand-dark)] active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-brand-dark)]",
  ghost:
    "bg-transparent text-ink border-2 border-ink hover:bg-ink hover:text-white",
  white:
    "bg-white text-brand shadow-[0_6px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5",
};

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base font-extrabold transition-[transform,background,box-shadow] duration-150 cursor-pointer";

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

type AnchorProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
  };

type ButtonElProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

export type ButtonProps = AnchorProps | ButtonElProps;

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variantClass[variant], className);

  if (typeof rest.href === "string") {
    return (
      <a className={classes} {...(rest as AnchorProps)}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} {...(rest as ButtonElProps)}>
      {children}
    </button>
  );
}
