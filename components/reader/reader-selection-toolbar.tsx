/**
 * 阅读器选区操作浮层
 * 自动测量宽高，智能定位在选区上方或下方
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 * Updated on 2026/3/25 - 重写定位逻辑，支持上下翻转
 */
"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { Highlighter, Lightbulb } from "lucide-react"

export interface SelectionRect {
  selectionTop: number
  selectionBottom: number
  selectionCenterX: number
  containerWidth: number
}

const EDGE_PADDING = 12
const GAP = 8

export function ReaderSelectionToolbar({
  selectionRect,
  onHighlight,
  onNote
}: {
  selectionRect: SelectionRect | null
  onHighlight: () => void
  onNote: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const computePosition = useCallback(() => {
    if (!selectionRect || !ref.current) {
      setPosition(null)
      return
    }
    const { offsetWidth: w, offsetHeight: h } = ref.current
    const { selectionTop, selectionBottom, selectionCenterX, containerWidth } = selectionRect

    // 水平居中，夹紧到容器边界
    const left = Math.min(
      Math.max(EDGE_PADDING, selectionCenterX - w / 2),
      containerWidth - w - EDGE_PADDING
    )

    // 优先放在选区上方
    const aboveTop = selectionTop - h - GAP
    const top = aboveTop >= EDGE_PADDING
      ? aboveTop
      : selectionBottom + GAP

    setPosition({ top, left })
  }, [selectionRect])

  useLayoutEffect(() => {
    computePosition()
  }, [computePosition])

  if (!selectionRect) {
    return null
  }

  return (
    <div
      ref={ref}
      data-reader-selection-toolbar
      className="absolute z-30 flex items-center gap-2 rounded-full border border-border/40 bg-surface/95 px-3 py-2 shadow-panel backdrop-blur-sm transition-opacity duration-120"
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        opacity: position ? 1 : 0
      }}
    >
      <button
        className="rounded-full bg-primary/15 p-2 text-primary transition hover:bg-primary/20"
        onClick={onHighlight}
        title="高亮 (1)"
      >
        <Highlighter className="h-4 w-4" />
      </button>
      <button
        className="rounded-full bg-elevated p-2 text-foreground transition hover:bg-overlay"
        onClick={onNote}
        title="想法 (N)"
      >
        <Lightbulb className="h-4 w-4" />
      </button>
    </div>
  )
}
