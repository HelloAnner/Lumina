import { cn } from "@/src/lib/utils"

export function Badge({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-elevated px-2 py-1 text-xs text-secondary",
        className
      )}
    >
      {children}
    </span>
  )
}
