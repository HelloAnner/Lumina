"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

export function Toast({
  title,
  description,
  tone = "default",
  onClose,
  autoClose = 3000
}: {
  title: string
  description?: string
  tone?: "default" | "warning" | "success" | "error"
  onClose?: () => void
  autoClose?: number
}) {
  useEffect(() => {
    if (autoClose > 0 && onClose) {
      const timer = setTimeout(onClose, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, onClose])

  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning/10 shadow-lg"
      : tone === "error"
        ? "border-error/30 bg-error/10 shadow-lg"
        : tone === "success"
          ? "border-success/30 bg-success/10 shadow-lg"
          : "border-border bg-surface shadow-lg"

  return (
    <div className={`fixed right-6 top-6 z-50 w-[360px] rounded-xl border p-4 shadow-panel ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {description ? <div className="text-sm leading-6 text-secondary">{description}</div> : null}
        </div>
        {onClose ? (
          <button className="rounded-md p-0.5 text-muted hover:bg-overlay/60 hover:text-foreground transition-colors" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
