"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Select({
  value,
  onValueChange,
  children,
  placeholder,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
}) {
  const items = React.Children.toArray(children).filter(
    (c: any) => c.type === SelectItem
  );
  const selected = items.find((i: any) => i.props.value === value);

  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onValueChange?.(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-3 pr-8 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {items.map((item: any) => (
          <option key={item.props.value} value={item.props.value}>
            {item.props.children}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function SelectTrigger({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm flex items-center justify-between cursor-pointer", className)} {...props} />;
}

function SelectValue({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) {
  return <span className="text-muted-foreground">{children ?? placeholder}</span>;
}

function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectItem({ value, children, ...props }: { value: string; children: React.ReactNode } & React.OptionHTMLAttributes<HTMLOptionElement>) {
  return <option value={value} {...props}>{children}</option>;
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
