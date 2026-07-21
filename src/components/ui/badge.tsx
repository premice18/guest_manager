import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border text-xs font-medium whitespace-nowrap transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline:
          "border-border text-foreground",
        gold:
          "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-400/15 text-amber-600 dark:text-amber-400",
        error:
          "border-transparent bg-red-500/15 text-red-600 dark:text-red-400",
        info:
          "border-transparent bg-sky-500/15 text-sky-600 dark:text-sky-400",
      },
      size: {
        default: "h-5 px-2 gap-1 text-[0.75rem]",
        sm: "h-4 px-1.5 gap-0.5 text-[0.625rem]",
        lg: "h-6 px-2.5 gap-1 text-[0.8125rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

/** Composant d'affichage de badge pour les statuts (présent, arrivé, VIP, etc.) */
function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
