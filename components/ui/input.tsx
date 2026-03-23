import * as React from "react"
import { cn } from "@/src/lib/utils"

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-[#2d2d3d] bg-elevated px-4 text-sm text-foreground outline-none transition-all duration-200",
        "placeholder:text-muted/50",
        "focus:border-primary/50 focus:bg-surface focus:ring-2 focus:ring-primary/10",
        "hover:border-[#3a3a4a]",
        className
      )}
      {...props}
    />
  )
})

Input.displayName = "Input"
