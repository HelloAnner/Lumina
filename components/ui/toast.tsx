"use client"

import { X } from "lucide-react"

export function Toast({
  title,
  description,
  tone = "default",
  onClose
}: {
  title: string
  description?: string
  tone?: "default" | "warning" | "success"
  onClose?: () => void
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/40 bg-amber-500/15 shadow-lg"
      : tone === "success"
        ? "border-emerald-500/40 bg-emerald-500/15 shadow-lg"
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
