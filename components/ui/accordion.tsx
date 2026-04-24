"use client";

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "overflow-hidden rounded-xl border border-line bg-white transition-colors data-[state=open]:border-ink/20",
      className,
    )}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

type TriggerProps = React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> & { quote?: boolean };

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  TriggerProps
>(({ className, children, quote, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-4 px-6 py-5 text-left text-[15.5px] font-semibold [&[data-state=open]>svg]:rotate-45 [&[data-state=open]>svg]:text-brand [&[data-state=open]>span:first-child]:text-brand",
        className,
      )}
      {...props}
    >
      {quote && (
        <span className="font-display flex-none text-[2rem] font-bold leading-none text-ink/20 transition-colors">
          “
        </span>
      )}
      <span className="flex-1">{children}</span>
      <Plus
        className="size-5 flex-none text-muted transition-all duration-300"
        strokeWidth={2.25}
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-[15px] leading-relaxed text-muted data-[state=closed]:animate-[accordion-up_0.22s_ease-out] data-[state=open]:animate-[accordion-down_0.22s_ease-out]"
    {...props}
  >
    <div className={cn("px-6 pb-6 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";
