import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio } from "@base-ui/react/radio"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"

interface RadioGroupProps<T = string> extends RadioGroupPrimitive.Props<T> {
  className?: string
}

/** Groupe de boutons radio */
function RadioGroup<T = string>({
  className,
  ...props
}: RadioGroupProps<T>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

interface RadioItemProps extends Radio.Root.Props {
  label?: string
}

/** Élément radio individuel avec label */
function RadioItem({
  className,
  label,
  ...props
}: RadioItemProps) {
  return (
    <label className="group/radio inline-flex items-center gap-2">
      <Radio.Root
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:text-primary",
          className
        )}
        {...props}
      >
        <Radio.Indicator className="flex items-center justify-center">
          <Circle className="size-2.5 fill-current" />
        </Radio.Indicator>
      </Radio.Root>
      {label && (
        <span className="text-sm font-medium select-none">{label}</span>
      )}
    </label>
  )
}

export { RadioGroup, RadioItem }
