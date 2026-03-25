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
import { Lightbulb } from "lucide-react"
import type { HighlightColor } from "@/src/server/store/types"

const COLOR_MAP: { color: HighlightColor; bg: string; ring: string; label: string }[] = [
  { color: "yellow", bg: "bg-yellow-400", ring: "ring-yellow-400/40", label: "黄色 (1)" },
  { color: "green", bg: "bg-emerald-400", ring: "ring-emerald-400/40", label: "绿色 (2)" },
  { color: "blue", bg: "bg-blue-400", ring: "ring-blue-400/40", label: "蓝色 (3)" },
  { color: "pink", bg: "bg-pink-400", ring: "ring-pink-400/40", label: "粉色 (4)" }
]

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
  onHighlight: (color: HighlightColor) => void
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
      {COLOR_MAP.map(({ color, bg, ring, label }) => (
        <button
          key={color}
          className={`h-6 w-6 rounded-full ${bg} transition hover:ring-2 ${ring} hover:scale-110`}
          onClick={() => onHighlight(color)}
          title={label}
        />
      ))}
      <span className="mx-0.5 h-4 w-px bg-border/40" />
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
