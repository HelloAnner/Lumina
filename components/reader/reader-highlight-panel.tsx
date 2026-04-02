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
import { buildKnowledgeHref } from "@/components/knowledge/knowledge-url-state"
import {
  computeCenteredScrollTop,
  pickCurrentHighlightId
} from "@/components/reader/reader-panel-scroll-utils"
import type { Highlight } from "@/src/server/store/types"
import type { ResolvedHighlight } from "@/components/reader/reader-types"
import { ArrowUpRight, BookOpen, LocateFixed, PanelRightClose, Trash2, X } from "lucide-react"
import { cn } from "@/src/lib/utils"

/** 高亮颜色对应的左侧彩色边条颜色 */
const STRIPE_COLORS: Record<string, string> = {
  yellow: "#E4B866",
  green: "#6BC89B",
  blue: "#6C8EEF",
  pink: "#C47090"
}

type HighlightReference = {
  viewpointId: string
  viewpointTitle: string
  blockId: string
  blockType: "quote" | "highlight" | "image"
  blockText: string
  sourceLocation?: string
}

type HighlightReferencePayload = {
  item: Highlight
  references: HighlightReference[]
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

function HighlightDetailModal({
  item,
  loading,
  payload,
  resolvedHighlight,
  onClose,
  onJumpToReader,
  onJumpToViewpoint
}: {
  item: Highlight
  loading: boolean
  payload: HighlightReferencePayload | null
  resolvedHighlight?: ResolvedHighlight
  onClose: () => void
  onJumpToReader: () => void
  onJumpToViewpoint: (reference: HighlightReference) => void
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-base/70 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[24px] border border-border/60 bg-elevated shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border/60 px-6 py-5">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              划线详情
            </p>
            <p className="max-w-[560px] text-[14px] leading-6 text-foreground">
              这条划线已被拆解进 {payload?.references.length ?? 0} 个观点笔记块。
              你可以直接跳过去并自动定位到对应位置。
            </p>
          </div>
          <button
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-overlay/80 text-muted transition hover:text-foreground"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-border/60 bg-overlay/60 px-3 py-1 text-[11px] text-secondary">
              {item.sourceTitle || "未命名来源"}
            </div>
            {item.sourceSectionTitle ? (
              <div className="rounded-full border border-border/60 bg-overlay/60 px-3 py-1 text-[11px] text-secondary">
                {item.sourceSectionTitle}
              </div>
            ) : null}
            <div className="rounded-full border border-border/60 bg-overlay/60 px-3 py-1 text-[11px] text-secondary">
              {item.format} · {item.assetType === "image" ? "图片划线" : "文本划线"}
            </div>
          </div>

          <div className="rounded-[18px] border border-border/60 bg-overlay/40 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              原始划线
            </p>
            <p className="mt-3 text-[15px] leading-7 text-foreground">
              {item.assetType === "image"
                ? item.imageAlt?.trim() || item.content
                : `“${item.content}”`}
            </p>
            {item.note ? (
              <p className="mt-3 text-[12px] leading-6 text-secondary">
                我的想法 · {item.note}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold text-foreground">流向的观点笔记</p>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                点击后会自动打开目标观点并定位到对应块。
              </p>
            </div>
            {resolvedHighlight ? (
              <button
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border/60 bg-overlay/70 px-4 text-[12px] font-medium text-secondary transition hover:text-foreground"
                onClick={onJumpToReader}
              >
                <LocateFixed className="h-3.5 w-3.5" />
                回到原文
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-[18px] border border-border/60 bg-overlay/30 px-4 py-6 text-[12px] text-muted">
              正在读取这条划线流向了哪些观点…
            </div>
          ) : payload?.references.length ? (
            <div className="space-y-3">
              {payload.references.map((reference) => (
                <div
                  key={`${reference.viewpointId}:${reference.blockId}`}
                  className="flex items-start justify-between gap-4 rounded-[18px] border border-border/60 bg-overlay/30 px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px] text-secondary">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{reference.viewpointTitle}</span>
                      {reference.sourceLocation ? (
                        <span className="text-muted">{reference.sourceLocation}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-foreground">
                      {reference.blockText}
                    </p>
                  </div>
                  <button
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-[12px] font-medium text-primary transition hover:bg-primary/15"
                    onClick={() => onJumpToViewpoint(reference)}
                  >
                    打开观点
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-border/60 bg-overlay/30 px-4 py-6 text-[12px] leading-6 text-muted">
              这条划线还没有被汇入任何观点笔记块。
            </div>
          )}
        </div>
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
  const [detailHighlightId, setDetailHighlightId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailPayload, setDetailPayload] = useState<HighlightReferencePayload | null>(null)
  const currentHighlightId = useMemo(
    () => pickCurrentHighlightId(items, currentPageIndex),
    [currentPageIndex, items]
  )
  const detailItem = useMemo(
    () => items.find((item) => item.id === detailHighlightId) ?? null,
    [detailHighlightId, items]
  )
  const detailResolvedHighlight = useMemo(
    () =>
      resolvedHighlights.find((item) => item.id === detailHighlightId),
    [detailHighlightId, resolvedHighlights]
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

  useEffect(() => {
    if (!detailHighlightId) {
      setDetailLoading(false)
      setDetailPayload(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    void (async () => {
      try {
        const response = await fetch(`/api/highlights/${detailHighlightId}/references`)
        if (!response.ok) {
          throw new Error("failed to load highlight references")
        }
        const data = (await response.json()) as HighlightReferencePayload
        if (!cancelled) {
          setDetailPayload(data)
        }
      } catch {
        if (!cancelled) {
          setDetailPayload(null)
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailHighlightId])

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
                onClick={() => setDetailHighlightId(item.id)}
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
      {detailItem ? (
        <HighlightDetailModal
          item={detailItem}
          loading={detailLoading}
          payload={detailPayload}
          resolvedHighlight={detailResolvedHighlight}
          onClose={() => setDetailHighlightId(null)}
          onJumpToReader={() => {
            if (detailResolvedHighlight) {
              onOpenHighlight(detailResolvedHighlight)
            }
            setDetailHighlightId(null)
          }}
          onJumpToViewpoint={(reference) => {
            const url = buildKnowledgeHref(
              "/knowledge",
              new URLSearchParams(),
              {
                viewpointId: reference.viewpointId,
                blockId: reference.blockId,
                highlightId: detailItem.id
              }
            )
            window.location.assign(url)
          }}
        />
      ) : null}
    </aside>
  )
}
