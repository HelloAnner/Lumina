import * as React from "react"
import { cn } from "@/src/lib/utils"

const buttonVariants = {
  primary:
    "bg-primary text-white hover:bg-primary-dark focus-visible:ring-2 focus-visible:ring-primary/50",
  secondary:
    "bg-elevated text-secondary hover:bg-overlay hover:text-foreground",
  ghost: "bg-transparent text-secondary hover:bg-overlay hover:text-foreground",
  destructive:
    "bg-red-500/15 text-red-300 hover:bg-red-500/20 hover:text-red-200"
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
          buttonVariants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
