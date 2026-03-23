import { cn } from "@/src/lib/utils"

export function Progress({
  value,
  className
}: {
  value: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-elevated",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 shadow-md transition-all duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
