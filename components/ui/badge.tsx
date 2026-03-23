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
        "inline-flex items-center rounded-md border border-[#3a3a4a] bg-elevated px-2.5 py-1 text-xs font-medium text-secondary transition-colors",
        "hover:border-[#4a4a5a] hover:text-foreground",
        className
      )}
    >
      {children}
    </span>
  )
}
