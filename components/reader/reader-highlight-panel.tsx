/**
 * 阅读器划线侧栏
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type React from "react"
import { Card } from "@/components/ui/card"
import type { Highlight } from "@/src/server/store/types"
import type { ResolvedHighlight } from "@/components/reader/reader-types"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

export function ReaderHighlightPanel({
  width,
  items,
  currentPageIndex,
  resolvedHighlights,
  onOpenHighlight,
  onResizeStart
}: {
  width: number
  items: Highlight[]
  currentPageIndex?: number
  resolvedHighlights: ResolvedHighlight[]
  onOpenHighlight: (item: ResolvedHighlight) => void
  onResizeStart: (event: React.MouseEvent) => void
}) {
  return (
    <aside
      className="relative border-l border-border bg-surface"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
        onMouseDown={onResizeStart}
      />
      <div className="flex h-12 items-center justify-between border-b border-border px-4 text-sm">
        <span>划线与想法</span>
        <span>{items.length}</span>
      </div>
      <div className="h-[calc(100%-48px)] space-y-3 overflow-y-auto p-4">
        {items.map((item) => {
          const resolved = resolvedHighlights.find((entry) => entry.id === item.id)
          return (
            <Card
              key={item.id}
              className={`cursor-pointer space-y-3 p-4 transition ${
                item.pageIndex === currentPageIndex ? "border-primary/20" : "border-border"
              }`}
              onClick={() => {
                if (resolved) {
                  onOpenHighlight(resolved)
                }
              }}
            >
              <div
                className="rounded-md px-3 py-2 text-sm leading-6 text-foreground"
                style={{ backgroundColor: COLORS[item.color] }}
              >
                {item.content}
              </div>
              <div className="text-[11px] text-muted">第 {item.pageIndex ?? 0} 节</div>
              {item.note ? (
                <div className="text-sm leading-6 text-secondary">{item.note}</div>
              ) : null}
            </Card>
          )
        })}
      </div>
    </aside>
  )
}
