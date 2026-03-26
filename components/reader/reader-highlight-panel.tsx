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
import { PanelRightClose, Trash2 } from "lucide-react"
import { cn } from "@/src/lib/utils"

/** 高亮颜色对应的左侧彩色边条颜色 */
const STRIPE_COLORS: Record<string, string> = {
  yellow: "#E4B866",
  green: "#6BC89B",
  blue: "#6C8EEF",
  pink: "#C47090"
}

function HighlightCard({
  item,
  active,
  onClick,
  onDoubleClick,
  onDelete,
  readOnly
}: {
  item: Highlight
  active: boolean
  onClick: () => void
  onDoubleClick?: () => void
  onDelete: (e: React.MouseEvent) => void
  readOnly?: boolean
}) {
  const [showDelete, setShowDelete] = useState(false)
  const stripeColor = STRIPE_COLORS[item.color] ?? STRIPE_COLORS.yellow

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border transition",
        active
          ? "border-primary/30 bg-elevated"
          : "border-border/70 bg-reader-card hover:border-border"
      )}
      style={{ borderLeftColor: stripeColor, borderLeftWidth: 3 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className="p-3">
        {!readOnly ? (
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
        ) : null}

        {item.assetType === "image" && item.imageUrl ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.imageAlt ?? item.content}
              className="max-h-28 w-full rounded-md border border-border/50 bg-surface/40 object-cover"
            />
            <p className="text-[11px] leading-relaxed text-secondary">
              {item.imageAlt?.trim() || item.content}
            </p>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-secondary">
            &ldquo;{item.content}&rdquo;
          </p>
        )}

        {/* 批注 */}
        {item.note ? (
          <p className="mt-1.5 text-[10px] text-muted">{item.note}</p>
        ) : null}
      </div>
    </div>
  )
}

export function ReaderHighlightPanel({
  width,
  collapsed,
  items,
  currentPageIndex,
  resolvedHighlights,
  onOpenHighlight,
  onEditHighlight,
  onDeleteHighlight,
  onResizeStart,
  onToggleCollapse,
  readOnly
}: {
  width: number
  collapsed: boolean
  items: Highlight[]
  currentPageIndex?: number
  resolvedHighlights: ResolvedHighlight[]
  onOpenHighlight: (item: ResolvedHighlight) => void
  onEditHighlight?: (id: string) => void
  onDeleteHighlight: (id: string) => void
  onResizeStart: (event: React.MouseEvent) => void
  onToggleCollapse: () => void
  readOnly?: boolean
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

  if (collapsed) return null

  return (
    <aside className="relative flex-shrink-0 border-l border-border/60 bg-reader-sidebar" style={{ width }}>
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
        onMouseDown={onResizeStart}
      />
      {/* 面板头部 */}
      <div className="flex h-12 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-[0.5px] text-foreground/80">
            划线与想法
          </span>
          {items.length > 0 && (
            <span className="text-[11px] font-medium text-primary">{items.length}</span>
          )}
        </div>
        <button
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-overlay hover:text-foreground"
          onClick={onToggleCollapse}
          title="收起面板"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* 列表 */}
      <div
        ref={scrollContainerRef}
        className="h-[calc(100%-48px)] space-y-2 overflow-y-auto p-3.5"
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
                readOnly={readOnly}
                onClick={() => {
                  if (resolved) {
                    onOpenHighlight(resolved)
                  }
                }}
                onDoubleClick={() => onEditHighlight?.(item.id)}
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
