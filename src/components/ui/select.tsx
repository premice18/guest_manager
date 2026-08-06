"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Select({
  value,
  onChange,
  onValueChange,
  children,
  placeholder,
  className,
  ...props
}: {
  children: React.ReactNode;
  placeholder?: string;
  onValueChange?: (value: string) => void;
} & React.ComponentProps<"select">) {
  const items = React.Children.toArray(children).filter(
    (child): child is React.ReactElement =>
      React.isValidElement(child) && child.type === SelectItem
  );

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => {
          onChange?.(e);
          onValueChange?.(e.target.value);
        }}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-input bg-transparent px-3 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {items.map((item) => {
          const itemProps = item.props as {
            value?: string;
            children?: React.ReactNode;
          };
          return (
            <option key={itemProps.value} value={itemProps.value ?? ""}>
              {itemProps.children}
            </option>
          );
        })}
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