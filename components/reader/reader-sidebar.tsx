/**
 * 阅读器目录侧栏
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type React from "react"
import { memo, useEffect, useRef } from "react"
import { cn } from "@/src/lib/utils"
import { computeCenteredScrollTop } from "@/components/reader/reader-panel-scroll-utils"
import type { SidebarNode } from "@/components/reader/reader-types"

const SidebarTreeNode = memo(function SidebarTreeNode({
  node,
  depth,
  activeIndex,
  onNavigate,
  itemRefs
}: {
  node: SidebarNode
  depth: number
  activeIndex: number
  onNavigate: (index: number) => void
  itemRefs: React.MutableRefObject<Record<number, HTMLButtonElement | null>>
}) {
  const active = node.sourceIndex === activeIndex
  return (
    <div>
      <button
        ref={(element) => {
          itemRefs.current[node.sourceIndex] = element
        }}
        className={cn(
          "group relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all duration-200",
          active
            ? "bg-primary/10 text-foreground font-medium"
            : "text-secondary hover:bg-overlay/70 hover:text-foreground"
        )}
        style={{ paddingLeft: `${12 + depth * 18}px` }}
        onClick={() => onNavigate(node.sourceIndex)}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-primary" />
        )}
        <span className={cn("truncate", depth > 0 && "text-[13px]")}>
          {depth > 0 ? "· " : ""}
          {node.title}
        </span>
        <span className={cn("ml-2 text-xs", active ? "text-primary/70" : "text-muted")}>
          {node.sourceIndex + 1}
        </span>
      </button>
      {node.children.length > 0 ? (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {node.children.map((child) => (
            <SidebarTreeNode
              key={`${child.id}-${child.sourceIndex}`}
              node={child}
              depth={depth + 1}
              activeIndex={activeIndex}
              onNavigate={onNavigate}
              itemRefs={itemRefs}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
})

export function ReaderSidebar({
  width,
  nodes,
  activeIndex,
  onNavigate,
  onResizeStart,
  itemRefs
}: {
  width: number
  nodes: SidebarNode[]
  activeIndex: number
  onNavigate: (index: number) => void
  onResizeStart: (event: React.MouseEvent) => void
  itemRefs: React.MutableRefObject<Record<number, HTMLButtonElement | null>>
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    const activeItem = itemRefs.current[activeIndex]
    if (!container || !activeItem) {
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
  }, [activeIndex, itemRefs])

  return (
    <aside
      className="relative border-r border-border/60 bg-surface"
      style={{ width }}
    >
      <div className="flex h-12 items-center border-b border-border/60 px-4">
        <span className="text-[13px] font-semibold text-foreground">目录</span>
      </div>
      <div
        ref={scrollContainerRef}
        className="h-[calc(100%-48px)] overflow-y-auto p-2"
      >
        <div className="space-y-0.5">
          {nodes.map((node) => (
            <SidebarTreeNode
              key={`${node.id}-${node.sourceIndex}`}
              node={node}
              depth={0}
              activeIndex={activeIndex}
              onNavigate={onNavigate}
              itemRefs={itemRefs}
            />
          ))}
        </div>
      </div>
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-secondary/30"
        onMouseDown={onResizeStart}
      />
    </aside>
  )
}
