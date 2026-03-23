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
        "h-10 w-full rounded-lg border border-border bg-elevated px-4 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-primary/60 focus:bg-surface focus:ring-2 focus:ring-primary/10",
        className
      )}
      {...props}
    />
  )
})

Input.displayName = "Input"
