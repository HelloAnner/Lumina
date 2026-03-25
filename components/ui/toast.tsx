"use client"

import { useEffect, useState } from "react"
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
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // 入场动画：下一帧触发
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (autoClose > 0 && onClose) {
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onClose, 200)
      }, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, onClose])

  function handleClose() {
    setVisible(false)
    setTimeout(() => onClose?.(), 200)
  }

  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning/10"
      : tone === "error"
        ? "border-error/30 bg-error/10"
        : tone === "success"
          ? "border-success/30 bg-success/10"
          : "border-border bg-surface"

  return (
    <div
      className={`fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-xl border px-5 py-3 shadow-panel backdrop-blur-sm transition-all duration-200 ${toneClass}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateX(-50%) translateY(${visible ? "0" : "-12px"})`
      }}
    >
      <div className="flex items-center gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-medium text-foreground whitespace-nowrap">{title}</div>
          {description ? <div className="text-xs leading-5 text-secondary">{description}</div> : null}
        </div>
        {onClose ? (
          <button
            className="rounded-md p-0.5 text-muted hover:bg-overlay/60 hover:text-foreground transition-colors"
            onClick={handleClose}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
