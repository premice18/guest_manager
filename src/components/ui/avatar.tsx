import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

type Shape = "circle" | "square"
type Size = "sm" | "md" | "lg" | "xl"

interface AvatarProps {
  src?: string
  alt?: string
  fallback?: string
  size?: Size
  shape?: Shape
  className?: string
}

const sizeClasses: Record<Size, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
}

const shapeClasses: Record<Shape, string> = {
  circle: "rounded-full",
  square: "rounded-lg",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** Composant d'avatar avec image et fallback aux initiales */
function Avatar({
  src,
  alt = "",
  fallback = "?",
  size = "md",
  shape = "circle",
  className,
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden bg-muted text-muted-foreground ring-1 ring-foreground/10",
        sizeClasses[size],
        shapeClasses[shape],
        className
      )}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={alt}
          className="size-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center font-medium">
        {fallback ? getInitials(fallback) : "?"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

export { Avatar }
