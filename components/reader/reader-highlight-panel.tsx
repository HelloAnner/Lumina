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
import {
  computeCenteredScrollTop,
  pickCurrentHighlightId
} from "@/components/reader/reader-panel-scroll-utils"
import type { Highlight } from "@/src/server/store/types"
import type { ResolvedHighlight } from "@/components/reader/reader-types"
import { Trash2 } from "lucide-react"
import { cn } from "@/src/lib/utils"

/** 高亮颜色对应的顶部彩色条纹颜色 */
const STRIPE_COLORS: Record<string, string> = {
  yellow: "#FBBF24",
  green: "#34D399",
  blue: "#60A5FA",
  pink: "#F472B6"
}

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
  const stripeColor = STRIPE_COLORS[item.color] ?? STRIPE_COLORS.yellow

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded-xl border p-3 transition",
        active
          ? "border-primary/30 bg-elevated"
          : "border-border bg-reader-card hover:border-primary/20"
      )}
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        onClick={onDelete}
        className={cn(
          "absolute right-2 top-2 rounded p-1 text-muted opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive",
          showDelete && "opacity-100"
        )}
        title="删除"
      >
        <Trash2 className="h-3 w-3" />
      </button>

      {/* 彩色顶部条纹 */}
      <div
        className="mb-2 h-[3px] w-4 rounded-full"
        style={{ backgroundColor: stripeColor }}
      />

      {/* 引用文本 */}
      <p className="text-xs leading-relaxed text-secondary">
        &ldquo;{item.content}&rdquo;
      </p>

      {/* 批注 */}
      {item.note ? (
        <p className="mt-1.5 text-[11px] text-muted">{item.note}</p>
      ) : null}
    </div>
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
    container.scrollTo({ top: container.scrollHeight, behavior: "auto" })
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
    container.scrollTo({ top: nextTop, behavior: "auto" })
  }, [currentHighlightId])

  return (
    <aside className="relative border-l border-border/60 bg-reader-sidebar" style={{ width }}>
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
        onMouseDown={onResizeStart}
      />
      {/* 面板头部 */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-4">
        <span className="text-[13px] font-semibold text-foreground">划线与想法</span>
        <span className="text-xs font-medium text-primary">{items.length}</span>
      </div>
      {/* 列表 */}
      <div
        ref={scrollContainerRef}
        className="h-[calc(100%-48px)] space-y-2 overflow-y-auto p-3"
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
