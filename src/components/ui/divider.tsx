import * as React from "react"
import { Separator } from "@base-ui/react/separator"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const dividerVariants = cva("shrink-0", {
  variants: {
    variant: {
      default: "bg-border",
      muted: "bg-muted",
      gold: "bg-amber-500/30",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface DividerProps
  extends React.ComponentProps<typeof Separator>,
    VariantProps<typeof dividerVariants> {
  label?: string
  orientation?: "horizontal" | "vertical"
}

/** Composant de séparation horizontale ou verticale avec variantes */
function Divider({
  className,
  variant,
  label,
  orientation = "horizontal",
  ...props
}: DividerProps) {
  if (label && orientation === "horizontal") {
    return (
      <div className="flex items-center gap-3" role="separator" aria-orientation="horizontal">
        <Separator
          className={cn("flex-1", dividerVariants({ variant }), className)}
          {...props}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {label}
        </span>
        <Separator
          className={cn("flex-1", dividerVariants({ variant }), className)}
          {...props}
        />
      </div>
    )
  }

  return (
    <Separator
      orientation={orientation}
      className={cn(
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        dividerVariants({ variant }),
        className
      )}
      {...props}
    />
  )
}

export { Divider, dividerVariants }
