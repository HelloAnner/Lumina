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
        "inline-flex items-center rounded-md border border-border bg-elevated px-2.5 py-1 text-xs font-medium text-secondary transition-colors",
        "hover:border-secondary/50 hover:text-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}
