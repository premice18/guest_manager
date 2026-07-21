import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const tagVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-border bg-muted text-muted-foreground",
        gold:
          "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning:
          "border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-400",
        error:
          "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface TagProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof tagVariants> {
  removable?: boolean
  onRemove?: () => void
}

/** Composant d'étiquette/chip pour les catégories et groupes d'invités */
function Tag({
  className,
  variant,
  removable,
  onRemove,
  children,
  ...props
}: TagProps) {
  return (
    <span
      data-slot="tag"
      className={cn(tagVariants({ variant, className }))}
      {...props}
    >
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-0.5 inline-flex size-3.5 items-center justify-center rounded-full hover:bg-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Retirer"
        >
          <X className="size-2.5" />
        </button>
      )}
    </span>
  )
}

export { Tag, tagVariants }
