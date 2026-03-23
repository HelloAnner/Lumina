import * as React from "react"
import { cn } from "@/src/lib/utils"

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[100px] w-full rounded-lg border border-[#2d2d3d] bg-elevated px-4 py-3 text-sm text-foreground outline-none transition-all duration-200",
        "placeholder:text-muted/50",
        "focus:border-primary/50 focus:bg-surface focus:ring-2 focus:ring-primary/10",
        "hover:border-[#3a3a4a]",
        className
      )}
      {...props}
    />
  )
})

Textarea.displayName = "Textarea"
