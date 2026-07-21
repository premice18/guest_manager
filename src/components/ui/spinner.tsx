import { cn } from "@/lib/utils"

interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  variant?: "default" | "gold"
  className?: string
}

const sizeMap: Record<string, string> = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-8 border-[3px]",
}

const variantMap: Record<string, string> = {
  default: "border-foreground/20 border-t-foreground",
  gold: "border-amber-500/20 border-t-amber-500",
}

/** Composant de chargement avec animation de rotation */
function Spinner({
  size = "md",
  variant = "default",
  className,
}: SpinnerProps) {
  return (
    <div
      data-slot="spinner"
      role="status"
      aria-label="Chargement"
      className={cn(
        "animate-spin rounded-full",
        sizeMap[size],
        variantMap[variant],
        className
      )}
    >
      <span className="sr-only">Chargement...</span>
    </div>
  )
}

export { Spinner }
