import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps extends CheckboxPrimitive.Root.Props {
  label?: string
}

/** Composant de case à cocher avec label et état indéterminé */
function Checkbox({
  className,
  label,
  id,
  ...props
}: CheckboxProps) {
  return (
    <label className="group/checkbox inline-flex items-center gap-2">
      <CheckboxPrimitive.Root
        id={id}
        className={cn(
          "group/root flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="group-data-[indeterminate]/root:hidden">
          <Check className="size-3" />
        </CheckboxPrimitive.Indicator>
        <span className="hidden group-data-[indeterminate]/root:flex">
          <Minus className="size-3" />
        </span>
      </CheckboxPrimitive.Root>
      {label && (
        <span className="text-sm font-medium select-none">{label}</span>
      )}
    </label>
  )
}

export { Checkbox }
