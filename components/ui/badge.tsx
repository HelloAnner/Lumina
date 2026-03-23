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
        "inline-flex items-center rounded-md border border-border/60 bg-elevated/80 px-2.5 py-1 text-xs font-medium text-secondary transition-colors hover:border-border hover:text-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}
