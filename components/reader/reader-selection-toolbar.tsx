/**
 * 阅读器选区操作浮层
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import { Highlighter, Lightbulb } from "lucide-react"

export function ReaderSelectionToolbar({
  selectionRect,
  onHighlight,
  onNote
}: {
  selectionRect: { top: number; left: number } | null
  onHighlight: () => void
  onNote: () => void
}) {
  if (!selectionRect) {
    return null
  }

  return (
    <div
      className="absolute z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-2 shadow-panel"
      style={{ top: selectionRect.top, left: selectionRect.left }}
    >
      <button
        className="rounded-full bg-primary/15 p-2 text-primary transition hover:bg-primary/20"
        onClick={onHighlight}
        title="高亮"
      >
        <Highlighter className="h-4 w-4" />
      </button>
      <button
        className="rounded-full bg-elevated p-2 text-foreground transition hover:bg-overlay"
        onClick={onNote}
        title="想法"
      >
        <Lightbulb className="h-4 w-4" />
      </button>
    </div>
  )
}
