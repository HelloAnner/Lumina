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
        "min-h-[100px] w-full rounded-lg border border-border bg-elevated px-4 py-3 text-sm text-foreground outline-none transition-all duration-200 placeholder:text-muted/60 focus:border-primary/60 focus:bg-surface focus:ring-2 focus:ring-primary/10",
        className
      )}
      {...props}
    />
  )
})

Textarea.displayName = "Textarea"
