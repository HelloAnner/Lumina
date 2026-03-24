/**
 * 阅读器划线侧栏
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import {
  computeCenteredScrollTop,
  pickCurrentHighlightId
} from "@/components/reader/reader-panel-scroll-utils"
import type { Highlight } from "@/src/server/store/types"
import type { ResolvedHighlight } from "@/components/reader/reader-types"
import { Trash2 } from "lucide-react"
import { cn } from "@/src/lib/utils"

const COLORS = {
  yellow: "rgba(251,191,36,0.35)",
  green: "rgba(52,211,153,0.35)",
  blue: "rgba(96,165,250,0.35)",
  pink: "rgba(244,114,182,0.35)"
} as const

function HighlightCard({
  item,
  active,
  onClick,
  onDelete
}: {
  item: Highlight
  active: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const [showDelete, setShowDelete] = useState(false)

  return (
    <Card
      className={cn(
        "group relative cursor-pointer space-y-3 p-4 transition",
        active ? "border-primary/30 bg-elevated/70" : "border-border hover:border-border/80"
      )}
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        onClick={onDelete}
        className={cn(
          "absolute right-2 top-2 rounded p-1.5 text-muted opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive",
          showDelete && "opacity-100"
        )}
        title="删除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <div
        className="rounded-md px-3 py-2 text-sm leading-6 text-foreground"
        style={{ backgroundColor: COLORS[item.color] }}
      >
        {item.content}
      </div>
      <div className="text-[11px] text-muted">第 {item.pageIndex ?? 0} 节</div>
      {item.note ? <div className="text-sm leading-6 text-secondary">{item.note}</div> : null}
    </Card>
  )
}

export function ReaderHighlightPanel({
  width,
  items,
  currentPageIndex,
  resolvedHighlights,
  onOpenHighlight,
  onDeleteHighlight,
  onResizeStart
}: {
  width: number
  items: Highlight[]
  currentPageIndex?: number
  resolvedHighlights: ResolvedHighlight[]
  onOpenHighlight: (item: ResolvedHighlight) => void
  onDeleteHighlight: (id: string) => void
  onResizeStart: (event: React.MouseEvent) => void
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const initializedRef = useRef(false)
  const currentHighlightId = useMemo(
    () => pickCurrentHighlightId(items, currentPageIndex),
    [currentPageIndex, items]
  )

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || initializedRef.current) {
      return
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "auto"
    })
    initializedRef.current = true
  }, [items.length])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !initializedRef.current || !currentHighlightId) {
      return
    }
    const activeItem = itemRefs.current[currentHighlightId]
    if (!activeItem) {
      return
    }
    const nextTop = computeCenteredScrollTop({
      containerHeight: container.clientHeight,
      contentHeight: container.scrollHeight,
      itemTop: activeItem.offsetTop,
      itemHeight: activeItem.offsetHeight
    })
    container.scrollTo({
      top: nextTop,
      behavior: "auto"
    })
  }, [currentHighlightId])

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
      <div
        ref={scrollContainerRef}
        className="h-[calc(100%-48px)] space-y-3 overflow-y-auto p-4"
      >
        {items.map((item) => {
          const resolved = resolvedHighlights.find((entry) => entry.id === item.id)
          const active = item.id === currentHighlightId
          return (
            <div
              key={item.id}
              ref={(element) => {
                itemRefs.current[item.id] = element
              }}
            >
              <HighlightCard
                item={item}
                active={active}
                onClick={() => {
                  if (resolved) {
                    onOpenHighlight(resolved)
                  }
                }}
                onDelete={(e) => {
                  e.stopPropagation()
                  onDeleteHighlight(item.id)
                }}
              />
            </div>
          )
        })}
      </div>
    </aside>
  )
}
