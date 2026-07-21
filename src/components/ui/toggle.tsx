import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

interface ToggleProps extends SwitchPrimitive.Root.Props {
  label?: string
}

/** Composant d'interrupteur (toggle switch) avec rôle switch et aria-checked */
function Toggle({
  className,
  label,
  ...props
}: ToggleProps) {
  return (
    <label className="group/toggle inline-flex items-center gap-2">
      <SwitchPrimitive.Root
        className={cn(
          "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary",
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform data-[checked]:translate-x-4"
          )}
        />
      </SwitchPrimitive.Root>
      {label && (
        <span className="text-sm font-medium select-none">{label}</span>
      )}
    </label>
  )
}

export { Toggle }
