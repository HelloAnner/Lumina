import * as React from "react"
import { cn } from "@/src/lib/utils"

const buttonVariants = {
  primary:
    "bg-primary text-white shadow-[0_1px_2px_rgba(139,92,246,0.3)] hover:bg-primary-dark hover:shadow-[0_2px_4px_rgba(139,92,246,0.4)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/40",
  secondary:
    "bg-surface border border-border text-secondary shadow-sm hover:bg-elevated hover:text-foreground hover:border-border/80 active:scale-[0.98]",
  ghost: "bg-transparent text-secondary hover:bg-overlay/80 hover:text-foreground active:scale-[0.98]",
  destructive:
    "bg-red-500/90 text-white shadow-sm hover:bg-red-500 hover:shadow-[0_2px_4px_rgba(239,68,68,0.3)] active:scale-[0.98]"
}

const buttonSizes = {
  default: "h-9 px-4 text-sm",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-5 text-sm"
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
          buttonVariants[variant],
          buttonSizes[size],
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
