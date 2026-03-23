/**
 * PDF 划线侧栏
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type React from "react"
import { useEffect, useMemo, useRef } from "react"
import { Card } from "@/components/ui/card"
import { computeCenteredScrollTop } from "@/components/reader/reader-panel-scroll-utils"
import { pickPdfCurrentHighlightId } from "@/components/reader/pdf-reader-utils"
import type { Highlight } from "@/src/server/store/types"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

export function PdfHighlightPanel({
  width,
  items,
  currentPageIndex,
  onOpenHighlight,
  onResizeStart
}: {
  width: number
  items: Highlight[]
  currentPageIndex: number
  onOpenHighlight: (item: Highlight) => void
  onResizeStart: (event: React.MouseEvent) => void
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const initializedRef = useRef(false)
  const currentHighlightId = useMemo(
    () => pickPdfCurrentHighlightId(items, currentPageIndex),
    [currentPageIndex, items]
  )

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || initializedRef.current) {
      return
    }
    container.scrollTo({ top: container.scrollHeight, behavior: "auto" })
    initializedRef.current = true
  }, [items.length])

  useEffect(() => {
    const container = scrollContainerRef.current
    const activeItem = itemRefs.current[currentHighlightId]
    if (!container || !activeItem || !initializedRef.current) {
      return
    }
    container.scrollTo({
      top: computeCenteredScrollTop({
        containerHeight: container.clientHeight,
        contentHeight: container.scrollHeight,
        itemTop: activeItem.offsetTop,
        itemHeight: activeItem.offsetHeight
      }),
      behavior: "auto"
    })
  }, [currentHighlightId])

  return (
    <aside className="relative border-l border-border bg-surface" style={{ width }}>
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
        onMouseDown={onResizeStart}
      />
      <div className="flex h-12 items-center justify-between border-b border-border px-4 text-sm">
        <span>PDF 划线</span>
        <span>{items.length}</span>
      </div>
      <div ref={scrollContainerRef} className="h-[calc(100%-48px)] space-y-3 overflow-y-auto p-4">
        {items.map((item) => {
          const active = item.id === currentHighlightId
          return (
            <div
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element
              }}
            >
              <Card
                className={`cursor-pointer space-y-3 p-4 transition ${
                  active ? "border-primary/30 bg-elevated/70" : "border-border"
                }`}
                onClick={() => onOpenHighlight(item)}
              >
                <div
                  className="rounded-md px-3 py-2 text-sm leading-6 text-foreground"
                  style={{ backgroundColor: COLORS[item.color] }}
                >
                  {item.content}
                </div>
                <div className="text-[11px] text-muted">第 {item.pageIndex ?? 1} 页</div>
                {item.note ? <div className="text-sm leading-6 text-secondary">{item.note}</div> : null}
              </Card>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
