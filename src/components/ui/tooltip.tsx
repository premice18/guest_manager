import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  delay?: number
  className?: string
}

/** Composant d'infobulle positionnée en dessous de l'élément cible */
function Tooltip({
  children,
  content,
  delay = 400,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delay={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner
            side="bottom"
            sideOffset={4}
          >
            <TooltipPrimitive.Popup
              className={cn(
                "z-50 rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
                className
              )}
            >
              {content}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

export { Tooltip }
