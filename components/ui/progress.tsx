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
        className="h-full rounded-full bg-gradient-to-r from-primary to-[#a78bfa] shadow-[0_0_8px_rgba(139,92,246,0.4)] transition-all duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
